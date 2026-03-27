import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { LinkedInSearchPayload, LinkedInWindow, exportLinkedInJobsCsv, searchLinkedInJobs } from "../services/api";

type JobCard = {
  id: string;
  title: string;
  company: string;
  location: string;
  date: string;
  url: string;
  salary?: string;
  raw: Record<string, any>;
};

type SavedFilter = {
  id: string;
  name: string;
  payload: LinkedInSearchPayload;
  savedAt: string;
};

type TrackerStatus = "idle" | "running" | "complete" | "error";

const windows: Array<{ label: string; value: LinkedInWindow }> = [
  { label: "Past 24 hours", value: "24h" },
  { label: "Past week", value: "7d" },
  { label: "Past 6 months", value: "6m" },
];

const sortOptions = [
  { label: "Most recent", value: "desc" },
  { label: "Least recent", value: "asc" },
] as const;

const workplaceOptions = ["On-site", "Hybrid", "Remote"] as const;
const experienceOptions = ["Internship", "Entry level", "Associate", "Mid-Senior level", "Director", "Executive"] as const;
const jobTypeOptions = ["Full-time", "Part-time", "Contract", "Temporary", "Internship"] as const;

const FILTERS_KEY = "hiresense.linkedin.saved_filters";
const FORM_KEY = "hiresense.linkedin.form_state";
const DASHBOARD_STATE_KEY = "hiresense.dashboard.state";

const parseJobs = (payload: any): JobCard[] => {
  let data = payload;

  if (typeof payload === "string") {
    try {
      data = JSON.parse(payload);
    } catch {
      return [];
    }
  }

  if (Array.isArray(data)) {
    return data.map((job: any, idx: number) => ({
      id: job.id || `job-${idx}`,
      title: job.title || "Unknown Title",
      company: job.organization || job.company || "Unknown Company",
      location:
        job.locations_derived?.[0] ||
        job.countries_derived?.[0] ||
        job.locations_raw?.[0]?.address?.addressLocality ||
        job.locations_raw?.[0]?.address?.addressCountry ||
        "Unknown Location",
      date: job.date_posted || job.date_created || "N/A",
      url: job.url || "#",
      salary: job.salary_raw?.value
        ? `${job.salary_raw.value.minValue || ""} - ${job.salary_raw.value.maxValue || ""} ${job.salary_raw.currency || ""}`.trim()
        : undefined,
      raw: job,
    }));
  }

  if (data?.data && Array.isArray(data.data)) {
    return parseJobs(data.data);
  }

  if (data?.jobs && Array.isArray(data.jobs)) {
    return parseJobs(data.jobs);
  }

  return [];
};

const prettifyValue = (value: any) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const normalize = (value: string) => value.trim() || undefined;
const normalizeNumber = (value: string) => (value.trim() === "" ? undefined : Number(value));
const normalizeArray = (values: string[]) => (values.length ? values : undefined);
const splitCsv = (value: string | undefined) => value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];

const mapWindowToLinkedInTpr = (value: LinkedInWindow) => {
  if (value === "24h") return "r86400";
  if (value === "7d") return "r604800";
  return "r15552000";
};

const JOB_TYPE_MAP: Record<string, string> = {
  "Full-time": "F",
  "Part-time": "P",
  "Contract": "C",
  "Temporary": "T",
  Internship: "I",
};

const EXPERIENCE_MAP: Record<string, string> = {
  Internship: "1",
  "Entry level": "2",
  Associate: "3",
  "Mid-Senior level": "4",
  Director: "5",
  Executive: "6",
};

const WORKPLACE_MAP: Record<string, string> = {
  "On-site": "1",
  Remote: "2",
  Hybrid: "3",
};

const mapToLinkedInCodes = (values: string[] | string | undefined, map: Record<string, string>) => {
  if (!values) return undefined;
  const normalizedValues = Array.isArray(values)
    ? values
    : values.split(",").map((value) => value.trim()).filter(Boolean);

  return normalizedValues
    .map((value) => map[value])
    .filter(Boolean)
    .join(",");
};

const buildLinkedInJobSearchUrl = (payload: LinkedInSearchPayload) => {
  const params = new URLSearchParams();

  const keywords = [payload.title_filter, payload.description_filter, payload.organization_filter]
    .filter(Boolean)
    .join(" ");

  if (keywords) params.set("keywords", keywords);
  if (payload.location_filter) params.set("location", payload.location_filter);
  if (payload.window) params.set("f_TPR", mapWindowToLinkedInTpr(payload.window));

  const jobTypeCodes = mapToLinkedInCodes(payload.type_filter, JOB_TYPE_MAP);
  if (jobTypeCodes) params.set("f_JT", jobTypeCodes);

  const expCodes = mapToLinkedInCodes(payload.ai_experience_level_filter, EXPERIENCE_MAP);
  if (expCodes) params.set("f_E", expCodes);

  const workplaceCodes = mapToLinkedInCodes(payload.ai_work_arrangement_filter, WORKPLACE_MAP);
  if (workplaceCodes) params.set("f_WT", workplaceCodes);

  if (payload.remote) params.set("f_WT", "2");
  if (payload.directapply) params.set("f_AL", "true");

  params.set("sortBy", payload.order === "asc" ? "R" : "DD");
  params.set("start", String(payload.offset || 0));

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
};

export default function LinkedinPage() {
  const router = useRouter();
  const [windowFilter, setWindowFilter] = useState<LinkedInWindow>("24h");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [titleFilters, setTitleFilters] = useState<string[]>([]);
  const [locationFilters, setLocationFilters] = useState<string[]>([]);
  const [organizationFilters, setOrganizationFilters] = useState<string[]>([]);
  const [descriptionFilters, setDescriptionFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [experienceLevels, setExperienceLevels] = useState<string[]>([]);
  const [workplaceFilters, setWorkplaceFilters] = useState<string[]>([]);
  const [industryFilters, setIndustryFilters] = useState<string[]>([]);

  const [remoteOnly, setRemoteOnly] = useState(false);
  const [directApply, setDirectApply] = useState(false);
  const [showSalary, setShowSalary] = useState(false);

  const [employeesGte, setEmployeesGte] = useState("");
  const [employeesLte, setEmployeesLte] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const [activeTab, setActiveTab] = useState("Search Builder");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [streamedJobs, setStreamedJobs] = useState<JobCard[]>([]);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>("idle");
  const [trackerMessage, setTrackerMessage] = useState("No scraping task running.");
  const [trackerProgress, setTrackerProgress] = useState(0);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  const payloadPreview = useMemo<LinkedInSearchPayload>(
    () => ({
      window: windowFilter,
      limit,
      offset,
      title_filter: normalize(titleFilters.join(", ")),
      location_filter: normalize(locationFilters.join(", ")),
      organization_filter: normalize(organizationFilters.join(", ")),
      description_filter: normalize(descriptionFilters.join(", ")),
      type_filter: normalizeArray(typeFilters),
      ai_experience_level_filter: normalizeArray(experienceLevels),
      ai_work_arrangement_filter: normalizeArray(workplaceFilters),
      industry_filter: normalizeArray(industryFilters),
      remote: remoteOnly || workplaceFilters.includes("Remote") || undefined,
      directapply: directApply || undefined,
      ai_has_salary: showSalary || undefined,
      employees_gte: normalizeNumber(employeesGte),
      employees_lte: normalizeNumber(employeesLte),
      order: order === "asc" ? "asc" : undefined,
    }),
    [
      windowFilter,
      limit,
      offset,
      titleFilters,
      locationFilters,
      organizationFilters,
      descriptionFilters,
      typeFilters,
      experienceLevels,
      workplaceFilters,
      industryFilters,
      remoteOnly,
      directApply,
      showSalary,
      employeesGte,
      employeesLte,
      order,
    ]
  );

  const queryUrl = useMemo(() => buildLinkedInJobSearchUrl(payloadPreview), [payloadPreview]);
  const dynamicColumns = useMemo(() => {
    const keys = new Set<string>();
    streamedJobs.forEach((job) => {
      Object.keys(job.raw || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [streamedJobs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = window.localStorage.getItem(FILTERS_KEY);
    const persistedForm = window.sessionStorage.getItem(FORM_KEY);
    if (persisted) {
      try {
        setSavedFilters(JSON.parse(persisted));
      } catch {
        setSavedFilters([]);
      }
    }
    if (persistedForm) {
      try {
        const data = JSON.parse(persistedForm);
        setWindowFilter(data.windowFilter || "24h");
        setLimit(data.limit || 50);
        setOffset(data.offset || 0);
        setTitleFilters(data.titleFilters || splitCsv(data.titleFilter));
        setLocationFilters(data.locationFilters || splitCsv(data.locationFilter));
        setOrganizationFilters(data.organizationFilters || splitCsv(data.organizationFilter));
        setDescriptionFilters(data.descriptionFilters || splitCsv(data.descriptionFilter));
        setTypeFilters(data.typeFilters || splitCsv(data.typeFilter));
        setExperienceLevels(data.experienceLevels || splitCsv(data.aiExperienceLevelFilter || data.seniorityFilter));
        setWorkplaceFilters(data.workplaceFilters || splitCsv(data.aiWorkArrangementFilter));
        setIndustryFilters(data.industryFilters || splitCsv(data.industryFilter));
        setRemoteOnly(Boolean(data.remoteOnly));
        setDirectApply(Boolean(data.directApply));
        setShowSalary(Boolean(data.showSalary));
        setEmployeesGte(data.employeesGte || "");
        setEmployeesLte(data.employeesLte || "");
        setOrder(data.order || "desc");
      } catch {
        // no-op
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      FORM_KEY,
      JSON.stringify({
        windowFilter,
        limit,
        offset,
        titleFilters,
        locationFilters,
        organizationFilters,
        descriptionFilters,
        typeFilters,
        experienceLevels,
        workplaceFilters,
        industryFilters,
        remoteOnly,
        directApply,
        showSalary,
        employeesGte,
        employeesLte,
        order,
      })
    );
  }, [windowFilter, limit, offset, titleFilters, locationFilters, organizationFilters, descriptionFilters, typeFilters, experienceLevels, workplaceFilters, industryFilters, remoteOnly, directApply, showSalary, employeesGte, employeesLte, order]);

  const saveCurrentSearch = () => {
    const name = `${titleFilters[0] || "Search"} • ${new Date().toLocaleString()}`;
    const item: SavedFilter = {
      id: String(Date.now()),
      name,
      payload: payloadPreview,
      savedAt: new Date().toISOString(),
    };
    const next = [item, ...savedFilters].slice(0, 20);
    setSavedFilters(next);
    if (typeof window !== "undefined") window.localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
  };

  const applySavedFilter = (id: string) => {
    const selected = savedFilters.find((f) => f.id === id);
    if (!selected) return;
    const p = selected.payload;
    setWindowFilter(p.window || "24h");
    setLimit(p.limit || 50);
    setOffset(p.offset || 0);
    setTitleFilters(splitCsv(p.title_filter));
    setLocationFilters(splitCsv(p.location_filter));
    setOrganizationFilters(splitCsv(p.organization_filter));
    setDescriptionFilters(splitCsv(p.description_filter));
    setTypeFilters(Array.isArray(p.type_filter) ? p.type_filter : splitCsv(p.type_filter));
    setExperienceLevels(Array.isArray(p.ai_experience_level_filter) ? p.ai_experience_level_filter : splitCsv(p.ai_experience_level_filter));
    setWorkplaceFilters(Array.isArray(p.ai_work_arrangement_filter) ? p.ai_work_arrangement_filter : splitCsv(p.ai_work_arrangement_filter));
    setIndustryFilters(Array.isArray(p.industry_filter) ? p.industry_filter : splitCsv(p.industry_filter));
    setRemoteOnly(Boolean(p.remote));
    setDirectApply(Boolean(p.directapply));
    setShowSalary(Boolean(p.ai_has_salary));
    setEmployeesGte(p.employees_gte?.toString() || "");
    setEmployeesLte(p.employees_lte?.toString() || "");
    setOrder(p.order === "asc" ? "asc" : "desc");
  };

  const removeSavedFilter = (id: string) => {
    const next = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(next);
    if (typeof window !== "undefined") window.localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
  };

  const exportFilters = () => {
    const blob = new Blob([JSON.stringify(payloadPreview, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkedin-filters.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJobsCsv = async () => {
    try {
      const blob = await exportLinkedInJobsCsv(payloadPreview);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "linkedin-jobs.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Unable to export CSV");
    }
  };

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setJobs([]);
    setStreamedJobs([]);
    setTrackerStatus("running");
    setTrackerProgress(8);
    setTrackerMessage("Queued live LinkedIn scrape task…");
    setCompletedAt(null);

    const heartbeat = window.setInterval(() => {
      setTrackerProgress((current) => {
        if (current >= 78) return current;
        return current + 6;
      });
    }, 600);

    try {
      setTrackerMessage("Fetching jobs from RapidAPI LinkedIn endpoint…");
      const response = await searchLinkedInJobs(payloadPreview);
      const parsedJobs = parseJobs(Array.isArray(response) ? response : response?.data);
      setTrackerMessage("Parsing and streaming live job updates…");
      setTrackerProgress(84);
      setJobs(parsedJobs);
      if (!parsedJobs.length) {
        const hasAnyPayload = Boolean(
          response &&
          ((typeof response === "object" && Object.keys(response).length > 0) ||
            (Array.isArray(response) && response.length > 0))
        );
        setTrackerProgress(100);
        setTrackerStatus("complete");
        setTrackerMessage(
          hasAnyPayload
            ? "Scraping complete. API returned JSON, but no recognizable job rows were found."
            : "Scraping complete. No jobs matched this search."
        );
        setCompletedAt(new Date().toISOString());
      }
    } catch (err: any) {
      setError(err?.message || "Unable to fetch jobs");
      setTrackerStatus("error");
      setTrackerMessage("Live scrape failed. Review error details and retry.");
    } finally {
      window.clearInterval(heartbeat);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trackerStatus !== "running") return;
    if (!jobs.length) {
      setStreamedJobs([]);
      return;
    }

    let index = 0;
    setStreamedJobs([]);
    const timer = window.setInterval(() => {
      index += 1;
      setStreamedJobs(jobs.slice(0, index));
      const renderedProgress = Math.min(98, 84 + Math.round((index / jobs.length) * 14));
      setTrackerProgress(renderedProgress);
      setTrackerMessage(`Live tracker: rendered ${Math.min(index, jobs.length)} of ${jobs.length} scraped jobs.`);
      if (index >= jobs.length) {
        window.clearInterval(timer);
        setTrackerProgress(100);
        setTrackerStatus("complete");
        setTrackerMessage(`Scraping complete. ${jobs.length} jobs are ready.`);
        setCompletedAt(new Date().toISOString());
      }
    }, 70);

    return () => window.clearInterval(timer);
  }, [jobs, trackerStatus]);

  const backToDashboard = () => {
    if (typeof window !== "undefined") {
      try {
        const persisted = window.sessionStorage.getItem(DASHBOARD_STATE_KEY);
        const parsed = persisted ? JSON.parse(persisted) : {};
        window.sessionStorage.setItem(
          DASHBOARD_STATE_KEY,
          JSON.stringify({ ...parsed, activeView: "overview" })
        );
      } catch {
        window.sessionStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify({ activeView: "overview" }));
      }
    }
    router.push("/");
  };

  return (
    <>
      <Head>
        <title>LinkedIn Job Search Dashboard | HireSense</title>
      </Head>

      <main style={shellStyle}>
        <aside style={sidebarStyle}>
          <h2 style={logoStyle}>HireSense</h2>
          {["Dashboard", "Search", "Pipelines", "Campaigns", "Exports"].map((item) => (
            <motion.button key={item} whileHover={{ scale: 1.04 }} style={sideItemStyle} type="button">
              {item}
            </motion.button>
          ))}
        </aside>

        <section style={contentStyle}>
          <motion.header style={navbarStyle} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div>
              <button type="button" style={backBtnStyle} onClick={backToDashboard}>← Back to main dashboard</button>
              <h2 style={{ margin: "8px 0 0", fontSize: "1.1rem" }}>LinkedIn Job Search Query Builder</h2>
            </div>
            <div style={navActionsStyle}>
              <button type="button" style={navBtnStyle} onClick={saveCurrentSearch}>Save search</button>
              <button type="button" style={navBtnStyle} onClick={exportFilters}>Export filters</button>
            </div>
          </motion.header>

          <div style={menuRowStyle}>
            {["Search Builder", "Saved Filters", "Campaigns", "Talent Pipelines", "Exports"].map((item) => (
              <motion.button key={item} whileHover={{ y: -2 }} type="button" onClick={() => setActiveTab(item)} style={{ ...tabBtnStyle, ...(activeTab === item ? tabBtnActiveStyle : {}) }}>
                {item}
              </motion.button>
            ))}
          </div>

          <div style={kpiGridStyle}>
            <KpiCard label="Fetched Jobs" value={String(jobs.length)} />
            <KpiCard label="Current Limit" value={String(limit)} />
            <KpiCard label="Offset" value={String(offset)} />
            <KpiCard label="Date Window" value={windows.find((w) => w.value === windowFilter)?.label || "-"} />
          </div>

          {activeTab === "Search Builder" && (
            <>
              <motion.form onSubmit={onSearch} style={panelStyle} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
                <h3 style={sectionTitle}>Core LinkedIn search filters</h3>
                <div style={gridStyle}>
                  <Field label="Role keywords"><MultiValueInput values={titleFilters} onChange={setTitleFilters} placeholder="Add role and press Enter (e.g., Product Manager)" /></Field>
                  <Field label="Location"><MultiValueInput values={locationFilters} onChange={setLocationFilters} placeholder="Add location and press Enter (e.g., United States)" /></Field>
                  <Field label="Company"><MultiValueInput values={organizationFilters} onChange={setOrganizationFilters} placeholder="Add company and press Enter (e.g., Google)" /></Field>
                  <Field label="Description keywords"><MultiValueInput values={descriptionFilters} onChange={setDescriptionFilters} placeholder="Add keyword and press Enter (e.g., GTM)" /></Field>

                  <Field label="Time window">
                    <select value={windowFilter} onChange={(e) => setWindowFilter(e.target.value as LinkedInWindow)} style={inputStyle}>
                      {windows.map((w) => (
                        <option key={w.value} value={w.value}>{w.label}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Sort order">
                    <select value={order} onChange={(e) => setOrder(e.target.value as "desc" | "asc")} style={inputStyle}>
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Job type">
                    <MultiSelectChips options={jobTypeOptions} values={typeFilters} onChange={setTypeFilters} />
                  </Field>

                  <Field label="Experience level">
                    <MultiSelectChips options={experienceOptions} values={experienceLevels} onChange={setExperienceLevels} />
                  </Field>

                  <Field label="Industry"><MultiValueInput values={industryFilters} onChange={setIndustryFilters} placeholder="Add industry and press Enter (e.g., FinTech)" /></Field>
                  <Field label="Limit">
                    <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={inputStyle}>
                      {[25, 50, 75, 100].map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Offset"><input type="number" min={0} value={offset} onChange={(e) => setOffset(Number(e.target.value || 0))} style={inputStyle} /></Field>
                </div>

                <h3 style={sectionTitle}>Additional filters</h3>
                <div style={gridStyle}>
                  <Field label="Min employees"><input type="number" min={0} value={employeesGte} onChange={(e) => setEmployeesGte(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Max employees"><input type="number" min={0} value={employeesLte} onChange={(e) => setEmployeesLte(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Workplace preset">
                    <MultiSelectChips options={workplaceOptions} values={workplaceFilters} onChange={setWorkplaceFilters} />
                  </Field>
                </div>

                <div style={checkboxRowStyle}>
                  <label><input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote only</label>
                  <label><input type="checkbox" checked={directApply} onChange={(e) => setDirectApply(e.target.checked)} /> Easy apply only</label>
                  <label><input type="checkbox" checked={showSalary} onChange={(e) => setShowSalary(e.target.checked)} /> Salary listed</label>
                </div>

                <button type="submit" disabled={loading} style={submitStyle}>{loading ? "Searching..." : "Search"}</button>
              </motion.form>

              <motion.section style={panelStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 style={sectionTitle}>Preview LinkedIn URL (manual use only)</h3>
                <p style={{ margin: "0 0 10px", color: "#93c5fd", fontSize: "0.9rem" }}>
                  This URL is display-only for manual review. Job fetches use the backend RapidAPI endpoint.
                </p>
                <code style={queryStyle}>{queryUrl}</code>
                {error && <p style={{ color: "#fca5a5", marginTop: 12 }}>{error}</p>}
              </motion.section>

              <motion.section style={panelStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 style={sectionTitle}>Task Live Tracker</h3>
                <p style={metaStyle}>{trackerMessage}</p>
                <div style={trackerBarWrapStyle}>
                  <div style={{ ...trackerBarFillStyle, width: `${trackerProgress}%` }} />
                </div>
                <div style={{ ...navActionsStyle, justifyContent: "space-between", flexWrap: "wrap", marginTop: 10 }}>
                  <span style={metaStyle}>
                    Status: <strong>{trackerStatus === "running" ? "Running" : trackerStatus === "complete" ? "Complete" : trackerStatus === "error" ? "Error" : "Idle"}</strong>
                    {completedAt ? ` • Completed ${new Date(completedAt).toLocaleTimeString()}` : ""}
                  </span>
                  <button
                    type="button"
                    style={{ ...navBtnStyle, opacity: trackerStatus === "complete" ? 1 : 0.5, cursor: trackerStatus === "complete" ? "pointer" : "not-allowed" }}
                    onClick={exportJobsCsv}
                    disabled={trackerStatus !== "complete"}
                  >
                    Download CSV
                  </button>
                </div>
              </motion.section>
            </>
          )}

          {activeTab === "Saved Filters" && (
            <section style={panelStyle}>
              <h3 style={sectionTitle}>Saved Filters ({savedFilters.length})</h3>
              {savedFilters.length === 0 && <p style={emptyTextStyle}>No saved filters yet. Use “Save search” to store one.</p>}
              {savedFilters.map((item) => (
                <div key={item.id} style={savedRowStyle}>
                  <div>
                    <strong>{item.name}</strong>
                    <p style={metaStyle}>Saved: {new Date(item.savedAt).toLocaleString()}</p>
                  </div>
                  <div style={navActionsStyle}>
                    <button style={navBtnStyle} onClick={() => applySavedFilter(item.id)}>Apply</button>
                    <button style={navBtnStyle} onClick={() => removeSavedFilter(item.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {activeTab === "Campaigns" && (
            <section style={panelStyle}>
              <h3 style={sectionTitle}>Campaigns</h3>
              <p style={metaStyle}>Active campaign is generated from your current filters and job results.</p>
              <ul>
                <li>Campaign Name: {titleFilters.join(", ") || "General LinkedIn Search"}</li>
                <li>Target Location: {locationFilters.join(", ") || "Any"}</li>
                <li>Current Reach: {jobs.length} jobs</li>
              </ul>
            </section>
          )}

          {activeTab === "Talent Pipelines" && (
            <section style={panelStyle}>
              <h3 style={sectionTitle}>Talent Pipelines</h3>
              <p style={metaStyle}>Pipeline groups update from the latest fetched jobs.</p>
              <ul>
                <li>Hot Leads: {Math.floor(jobs.length * 0.4)}</li>
                <li>Review Queue: {Math.floor(jobs.length * 0.35)}</li>
                <li>Long-term Nurture: {Math.ceil(jobs.length * 0.25)}</li>
              </ul>
            </section>
          )}

          {activeTab === "Exports" && (
            <section style={panelStyle}>
              <h3 style={sectionTitle}>Exports</h3>
              <div style={navActionsStyle}>
                <button type="button" style={navBtnStyle} onClick={exportFilters}>Export filters JSON</button>
                <button type="button" style={navBtnStyle} onClick={exportJobsCsv}>Export jobs CSV</button>
              </div>
            </section>
          )}

          <section style={panelStyle}>
            <h3 style={sectionTitle}>Live JSON Output ({streamedJobs.length})</h3>
            {!streamedJobs.length && <p style={emptyTextStyle}>No rows streamed yet.</p>}
            {streamedJobs.length > 0 && (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {dynamicColumns.map((column) => (
                        <th key={column} style={tableHeadCellStyle}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {streamedJobs.map((job) => (
                      <tr key={job.id}>
                        {dynamicColumns.map((column) => (
                          <td key={`${job.id}-${column}`} style={tableCellStyle}>
                            {prettifyValue(job.raw?.[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </main>
    </>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <motion.article style={kpiCardStyle} whileHover={{ y: -5 }}>
      <p style={{ margin: 0, color: "#93c5fd", fontSize: "0.82rem" }}>{label}</p>
      <strong style={{ fontSize: "1.15rem" }}>{value}</strong>
    </motion.article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "#bfdbfe", fontSize: "0.85rem" }}>{label}</span>
      {children}
    </label>
  );
}

function MultiValueInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const addValue = (raw: string) => {
    const value = raw.trim();
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
  };

  const removeValue = (value: string) => onChange(values.filter((item) => item !== value));

  return (
    <div style={chipInputWrapStyle}>
      <div style={chipListStyle}>
        {values.map((value) => (
          <span key={value} style={chipStyle}>
            {value}
            <button type="button" style={chipCloseStyle} onClick={() => removeValue(value)} aria-label={`Remove ${value}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addValue(draft.replace(/,$/, ""));
            setDraft("");
          }
          if (e.key === "Backspace" && !draft && values.length) {
            removeValue(values[values.length - 1]);
          }
        }}
        onBlur={() => {
          if (!draft.trim()) return;
          addValue(draft);
          setDraft("");
        }}
        style={chipInputStyle}
        placeholder={placeholder}
      />
    </div>
  );
}

function MultiSelectChips({
  options,
  values,
  onChange,
}: {
  options: readonly string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  };

  return (
    <div style={chipWrapStyle}>
      {options.map((option) => {
        const active = values.includes(option);
        return (
          <motion.button
            key={option}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => toggle(option)}
            style={{ ...chipSelectorStyle, ...(active ? chipSelectorActiveStyle : {}) }}
          >
            {option}
          </motion.button>
        );
      })}
    </div>
  );
}

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  background: "#020617",
  color: "#e2e8f0",
};

const sidebarStyle: CSSProperties = {
  width: 220,
  borderRight: "1px solid #1e293b",
  background: "#020617",
  padding: 20,
};

const logoStyle: CSSProperties = {
  margin: "0 0 24px",
  fontSize: "1.3rem",
};

const sideItemStyle: CSSProperties = {
  width: "100%",
  border: "1px solid transparent",
  textAlign: "left",
  color: "#cbd5e1",
  background: "transparent",
  padding: "10px 12px",
  borderRadius: 8,
  cursor: "pointer",
  marginBottom: 10,
};

const contentStyle: CSSProperties = {
  flex: 1,
  padding: "28px 24px 40px",
  maxWidth: 1200,
  margin: "0 auto 0 0",
};

const navbarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  border: "1px solid #334155",
  borderRadius: 14,
  padding: "16px 18px",
  background: "rgba(15, 23, 42, 0.65)",
  marginBottom: 18,
};

const menuRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 18,
};

const tabBtnStyle: CSSProperties = {
  ...({
    textAlign: "left",
    background: "#0f172a",
    border: "1px solid #1e293b",
    color: "#e2e8f0",
    borderRadius: 10,
    padding: "8px 12px",
    cursor: "pointer",
  } as CSSProperties),
};

const tabBtnActiveStyle: CSSProperties = {
  borderColor: "#3b82f6",
  background: "rgba(59, 130, 246, 0.16)",
};

const backBtnStyle: CSSProperties = {
  background: "transparent",
  color: "#93c5fd",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
};

const navActionsStyle: CSSProperties = {
  display: "flex",
  gap: 10,
};

const navBtnStyle: CSSProperties = {
  background: "#0f172a",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "8px 10px",
  cursor: "pointer",
};

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const kpiCardStyle: CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 12,
  background: "rgba(15, 23, 42, 0.72)",
  padding: 12,
  display: "grid",
  gap: 8,
};

const panelStyle: CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 14,
  padding: 18,
  marginBottom: 18,
  background: "rgba(15, 23, 42, 0.72)",
};

const sectionTitle: CSSProperties = {
  margin: "0 0 10px",
  fontSize: "1rem",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  background: "#0b1222",
  color: "#e2e8f0",
  border: "1px solid #475569",
  borderRadius: 10,
  padding: "10px 12px",
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  gap: 18,
  margin: "14px 0",
  flexWrap: "wrap",
};

const submitStyle: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "10px 16px",
  background: "linear-gradient(90deg, #2563eb, #7c3aed)",
  color: "white",
  cursor: "pointer",
};

const queryStyle: CSSProperties = {
  display: "block",
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: 10,
  color: "#7dd3fc",
  overflowWrap: "anywhere",
};

const trackerBarWrapStyle: CSSProperties = {
  width: "100%",
  height: 10,
  borderRadius: 999,
  overflow: "hidden",
  border: "1px solid #334155",
  background: "#020617",
};

const trackerBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg,#22c55e,#3b82f6)",
  transition: "width 220ms ease",
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid #334155",
  borderRadius: 12,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 800,
};

const tableHeadCellStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #334155",
  color: "#bfdbfe",
  background: "#0b1222",
  position: "sticky",
  top: 0,
};

const tableCellStyle: CSSProperties = {
  padding: "8px",
  borderBottom: "1px solid #1e293b",
  color: "#cbd5e1",
  verticalAlign: "top",
  wordBreak: "break-word",
  maxWidth: 360,
};

const metaStyle: CSSProperties = {
  margin: "4px 0",
  color: "#cbd5e1",
};

const emptyTextStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#93c5fd",
};

const savedRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  border: "1px solid #334155",
  borderRadius: 10,
  padding: 12,
  marginBottom: 10,
};

const chipInputWrapStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  background: "#0b1222",
  color: "#e2e8f0",
  border: "1px solid #475569",
  borderRadius: 10,
  padding: 8,
  display: "grid",
  gap: 8,
};

const chipListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(59, 130, 246, 0.2)",
  color: "#bfdbfe",
  fontSize: "0.8rem",
};

const chipCloseStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#93c5fd",
  cursor: "pointer",
  lineHeight: 1,
  padding: 0,
};

const chipInputStyle: CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#e2e8f0",
  fontSize: "0.9rem",
  width: "100%",
};

const chipWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  minHeight: 42,
  background: "#0b1222",
  border: "1px solid #475569",
  borderRadius: 10,
  padding: 8,
};

const chipSelectorStyle: CSSProperties = {
  border: "1px solid #334155",
  background: "#020617",
  color: "#cbd5e1",
  borderRadius: 999,
  padding: "6px 14px",
  cursor: "pointer",
};

const chipSelectorActiveStyle: CSSProperties = {
  border: "none",
  color: "white",
  background: "linear-gradient(90deg,#2563eb,#7c3aed)",
  boxShadow: "0 0 12px rgba(99,102,241,0.5)",
};
