import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { exportLinkedInErpAnalyzedCsv, LinkedInSearchPayload, LinkedInWindow, searchLinkedInJobs } from "../services/api";

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
const CSV_EXPORT_COLUMNS = [
  "id",
  "companyName",
  "title",
  "seniorityLevel",
  "employmentType",
  "jobFunction",
  "location",
  "link",
  "postedAt",
  "postedAtTimestamp",
  "descriptionText",
  "descriptionHtml",
  "scraped_timestamp",
] as const;

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

const uniqueJobs = (jobs: JobCard[]) => {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = [job.raw?.id || job.id, job.raw?.trackingId || "", job.raw?.link || job.url, job.raw?.title || job.title, job.raw?.companyName || job.company, job.raw?.location || job.location]
      .join("|")
      .toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, "\"\"")}"`;
};

const buildCsvFromJobs = (jobs: JobCard[]) => {
  const now = new Date().toISOString();
  const lines: string[] = [CSV_EXPORT_COLUMNS.join(",")];
  for (const job of jobs) {
    const row = CSV_EXPORT_COLUMNS.map((column) => {
      if (column === "scraped_timestamp") return csvCell(now);
      return csvCell(job.raw?.[column] ?? "");
    });
    lines.push(row.join(","));
  }
  return lines.join("\n");
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
const splitCsv = (value: string | undefined) => {
  if (!value) return [];

  const quotedMatches = Array.from(value.matchAll(/"([^"]+)"/g)).map((match) => match[1].trim()).filter(Boolean);
  if (quotedMatches.length) return quotedMatches;

  return value
    .split(/\s+OR\s+|,/i)
    .map((item) => item.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
};

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
  const [viewportWidth, setViewportWidth] = useState(1200);
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
  const [erpKeyword, setErpKeyword] = useState("");
  const [erpLocation, setErpLocation] = useState("");
  const [erpPagesToScrape, setErpPagesToScrape] = useState(3);
  const [erpLoading, setErpLoading] = useState(false);
  const [erpStatus, setErpStatus] = useState("No ERP analyzer job running.");

  const payloadPreview = useMemo<LinkedInSearchPayload>(
    () => ({
      window: windowFilter,
      limit,
      offset,
      title_filter: titleFilters.length ? `"${titleFilters.join('" OR "')}"` : undefined,
      location_filter: locationFilters.length ? locationFilters.map((loc) => `"${loc}"`).join(" OR ") : undefined,
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

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const queryUrl = useMemo(() => buildLinkedInJobSearchUrl(payloadPreview), [payloadPreview]);
  const isTablet = viewportWidth <= 1024;
  const isMobile = viewportWidth <= 768;
  const dynamicColumns = useMemo(() => {
    const keys = new Set<string>();
    streamedJobs.forEach((job) => {
      CSV_EXPORT_COLUMNS.forEach((key) => keys.add(key));
    });
    return Array.from(keys);
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

  const exportJobsCsv = () => {
    if (!jobs.length) {
      setError("Run a search first to download CSV.");
      return;
    }
    try {
      const csvText = buildCsvFromJobs(jobs);
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
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
      setTrackerMessage("Fetching jobs from  LinkedIn…");
      const response = await searchLinkedInJobs(payloadPreview);

      console.log("====== DEBUG START ======");
      console.log("RAW RESPONSE:", response);
      console.log("TYPE:", typeof response);
      console.log("IS ARRAY:", Array.isArray(response));
      console.log("RESPONSE.DATA:", response?.data);
      console.log("IS DATA ARRAY:", Array.isArray(response?.data));
      console.log("====== DEBUG END ======");

      let normalized = response;

      // 🔥 unwrap .data if exists
      if (normalized?.data) {
        normalized = normalized.data;
      }

      // 🔥 parse string JSON (VERY IMPORTANT)
      if (typeof normalized === "string") {
        try {
          normalized = JSON.parse(normalized);
        } catch (e) {
          console.error("JSON parse failed:", e);
          normalized = [];
        }
      }

      // 🔥 final parse
      const parsedJobs = uniqueJobs(parseJobs(normalized));
      setTrackerMessage("Parsing and streaming live job updates…");
      setTrackerProgress(84);
      setJobs(parsedJobs);
      if (!parsedJobs.length) {
        const hasAnyPayload = Boolean(
          normalized &&
          ((typeof normalized === "object" && Object.keys(normalized).length > 0) ||
            (Array.isArray(normalized) && normalized.length > 0))
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

      <main style={{ ...shellStyle, flexDirection: isTablet ? "column" : "row" }}>
        <section style={{ ...contentStyle, padding: isMobile ? "18px 12px 28px" : contentStyle.padding, maxWidth: isTablet ? "100%" : contentStyle.maxWidth, margin: "0 auto" }}>
          <motion.header style={{ ...navbarStyle, padding: isMobile ? "12px" : navbarStyle.padding }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div>
              <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} type="button" style={backBtnStyle} onClick={backToDashboard}>← Back to main dashboard</motion.button>
              <h2 style={{ margin: "8px 0 0", fontSize: "1.1rem" }}>LinkedIn Job Search Query Builder</h2>
            </div>
            <div style={{ ...navActionsStyle, flexWrap: "wrap" }}>
              <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} type="button" style={navBtnStyle} onClick={saveCurrentSearch}>Save search</motion.button>
              <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} type="button" style={navBtnStyle} onClick={exportFilters}>Export filters</motion.button>
            </div>
          </motion.header>

          <div style={menuRowStyle}>
            {["Search Builder", "ERP Analyzer", "Saved Filters", "Exports"].map((item) => (
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

                <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} type="submit" disabled={loading} style={submitStyle}>{loading ? "Searching..." : "Search"}</motion.button>
              </motion.form>

              <motion.section style={panelStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 style={sectionTitle}>Preview LinkedIn URL (manual use only)</h3>
                <p style={{ margin: "0 0 10px", color: "#A14A2F", fontSize: "0.9rem" }}>
                  This URL is display-only for manual review.
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
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ y: -1 }}
                    type="button"
                    style={{ ...navBtnStyle, opacity: trackerStatus === "complete" ? 1 : 0.5, cursor: trackerStatus === "complete" ? "pointer" : "not-allowed" }}
                    onClick={exportJobsCsv}
                    disabled={trackerStatus !== "complete"}
                  >
                    Download CSV
                  </motion.button>
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
                    <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} style={navBtnStyle} onClick={() => applySavedFilter(item.id)}>Apply</motion.button>
                    <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} style={navBtnStyle} onClick={() => removeSavedFilter(item.id)}>Delete</motion.button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {activeTab === "ERP Analyzer" && (
            <section style={panelStyle}>
              <h3 style={sectionTitle}>ERP Job Description Analyzer (CSV)</h3>
              <p style={metaStyle}>
                Scrapes all requested LinkedIn pages first, then classifies each job description with Groq (Llama 3.3 70B Versatile) and appends <code>erp_specific</code> and <code>erp_reason</code> columns.
              </p>
              <div style={{ ...gridStyle, marginBottom: 12 }}>
                <Field label="Keyword">
                  <input
                    value={erpKeyword}
                    onChange={(e) => setErpKeyword(e.target.value)}
                    placeholder="e.g., SAP FICO"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Location">
                  <input
                    value={erpLocation}
                    onChange={(e) => setErpLocation(e.target.value)}
                    placeholder="e.g., United Kingdom"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Pages to Scrape">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={erpPagesToScrape}
                    onChange={(e) => setErpPagesToScrape(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                    placeholder="e.g., 3"
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div style={navActionsStyle}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ y: -1 }}
                  type="button"
                  style={navBtnStyle}
                  disabled={erpLoading}
                  onClick={async () => {
                    if (!erpKeyword.trim() || !erpLocation.trim()) {
                      setError("ERP analyzer requires keyword and location.");
                      return;
                    }
                    setError("");
                    setErpLoading(true);
                    setErpStatus(`Background task started: scraping ${erpPagesToScrape} page(s), then running ERP analysis with Groq…`);
                    try {
                      const blob = await exportLinkedInErpAnalyzedCsv({
                        keyword: erpKeyword.trim(),
                        location: erpLocation.trim(),
                        window: windowFilter,
                        limit,
                        offset,
                        pages_to_scrape: erpPagesToScrape,
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "linkedin-jobs-erp-analyzed.csv";
                      a.click();
                      URL.revokeObjectURL(url);
                      setErpStatus("Complete: analyzed CSV downloaded.");
                    } catch (err: any) {
                      setError(err?.message || "ERP analyzed CSV export failed.");
                      setErpStatus("Failed: review error details and retry.");
                    } finally {
                      setErpLoading(false);
                    }
                  }}
                >
                  {erpLoading ? "Running in background..." : "Run & Download ERP Analyzed CSV"}
                </motion.button>
              </div>
              <p style={{ ...metaStyle, marginTop: 10 }}>{erpStatus}</p>
            </section>
          )}

          {activeTab === "Exports" && (
            <section style={panelStyle}>
              <h3 style={sectionTitle}>Exports</h3>
              <div style={navActionsStyle}>
                <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} type="button" style={navBtnStyle} onClick={exportFilters}>Export filters JSON</motion.button>
                <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} type="button" style={navBtnStyle} onClick={exportJobsCsv}>Export jobs CSV</motion.button>
              </div>
            </section>
          )}

          <section style={panelStyle}>
            <h3 style={sectionTitle}>Live JSON Output ({streamedJobs.length})</h3>
            {!streamedJobs.length && <p style={emptyTextStyle}>No rows streamed yet.</p>}
            {streamedJobs.length > 0 && (
                  <div style={tableWrapStyle}>
                <table style={{ ...tableStyle, minWidth: isMobile ? 620 : tableStyle.minWidth }}>
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
      <p style={{ margin: 0, color: "#A14A2F", fontSize: "0.82rem" }}>{label}</p>
      <strong style={{ fontSize: "1.15rem" }}>{value}</strong>
    </motion.article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "#A14A2F", fontSize: "0.85rem" }}>{label}</span>
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
  background: "#FFFFFF",
  color: "#3D322D",
};

const sidebarStyle: CSSProperties = {
  width: 220,
  borderRight: "1px solid #E5DED1",
  background: "#FFFFFF",
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
  color: "#5B4F49",
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
  border: "1px solid #D8D2C6",
  borderRadius: 14,
  padding: "16px 18px",
  background: "#FAF9F5",
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
    background: "#F4F3EE",
    border: "1px solid #E5DED1",
    color: "#3D322D",
    borderRadius: 10,
    padding: "8px 12px",
    cursor: "pointer",
  } as CSSProperties),
};

const tabBtnActiveStyle: CSSProperties = {
  borderColor: "#3b82f6",
  background: "rgba(193,95,60,0.14)",
};

const backBtnStyle: CSSProperties = {
  background: "transparent",
  color: "#A14A2F",
  border: "1px solid #D8D2C6",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
};

const navActionsStyle: CSSProperties = {
  display: "flex",
  gap: 10,
};

const navBtnStyle: CSSProperties = {
  background: "#F4F3EE",
  color: "#3D322D",
  border: "1px solid #D8D2C6",
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
  border: "1px solid #D8D2C6",
  borderRadius: 12,
  background: "#FAF9F5",
  padding: 12,
  display: "grid",
  gap: 8,
};

const panelStyle: CSSProperties = {
  border: "1px solid #D8D2C6",
  borderRadius: 14,
  padding: 18,
  marginBottom: 18,
  background: "#FAF9F5",
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
  background: "#FAF9F5",
  color: "#3D322D",
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
  background: "#C15F3C",
  color: "white",
  cursor: "pointer",
};

const queryStyle: CSSProperties = {
  display: "block",
  background: "#FFFFFF",
  border: "1px solid #D8D2C6",
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
  border: "1px solid #D8D2C6",
  background: "#FFFFFF",
};

const trackerBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "#C4A584",
  transition: "width 220ms ease",
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid #D8D2C6",
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
  borderBottom: "1px solid #D8D2C6",
  color: "#A14A2F",
  background: "#FAF9F5",
  position: "sticky",
  top: 0,
};

const tableCellStyle: CSSProperties = {
  padding: "8px",
  borderBottom: "1px solid #E5DED1",
  color: "#5B4F49",
  verticalAlign: "top",
  wordBreak: "break-word",
  maxWidth: 360,
};

const metaStyle: CSSProperties = {
  margin: "4px 0",
  color: "#5B4F49",
};

const emptyTextStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#A14A2F",
};

const savedRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  border: "1px solid #D8D2C6",
  borderRadius: 10,
  padding: 12,
  marginBottom: 10,
};

const chipInputWrapStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  background: "#FAF9F5",
  color: "#3D322D",
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
  background: "#E9D8CF",
  color: "#A14A2F",
  fontSize: "0.8rem",
};

const chipCloseStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#A14A2F",
  cursor: "pointer",
  lineHeight: 1,
  padding: 0,
};

const chipInputStyle: CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#3D322D",
  fontSize: "0.9rem",
  width: "100%",
};

const chipWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  minHeight: 42,
  background: "#FAF9F5",
  border: "1px solid #475569",
  borderRadius: 10,
  padding: 8,
};

const chipSelectorStyle: CSSProperties = {
  border: "1px solid #D8D2C6",
  background: "#FFFFFF",
  color: "#5B4F49",
  borderRadius: 999,
  padding: "6px 14px",
  cursor: "pointer",
};

const chipSelectorActiveStyle: CSSProperties = {
  border: "none",
  color: "white",
  background: "#C15F3C",
  boxShadow: "0 0 12px rgba(193,95,60,0.3)",
};
