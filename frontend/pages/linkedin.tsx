import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { LinkedInSearchPayload, LinkedInWindow, searchLinkedInJobs } from "../services/api";

type JobCard = {
  id: string;
  title: string;
  company: string;
  location: string;
  date: string;
  url: string;
  salary?: string;
};

type SavedFilter = {
  id: string;
  name: string;
  payload: LinkedInSearchPayload;
  savedAt: string;
};

const windows: Array<{ label: string; value: LinkedInWindow }> = [
  { label: "Past 24 hours", value: "24h" },
  { label: "Past week", value: "7d" },
  { label: "Past 6 months", value: "6m" },
];

const sortOptions = [
  { label: "Most recent", value: "desc" },
  { label: "Least recent", value: "asc" },
] as const;

const workplaceOptions = ["On-site", "Hybrid", "Remote"];
const experienceOptions = ["Internship", "Entry level", "Associate", "Mid-Senior", "Director", "Executive"];
const seniorityOptions = ["Entry level", "Associate", "Mid-Senior level", "Director", "Executive"];

const experienceToSeniority: Record<string, string> = {
  Internship: "Entry level",
  "Entry level": "Entry level",
  Associate: "Associate",
  "Mid-Senior": "Mid-Senior level",
  Director: "Director",
  Executive: "Executive",
};

const FILTERS_KEY = "hiresense.linkedin.saved_filters";
const FORM_KEY = "hiresense.linkedin.form_state";

const parseJobs = (payload: any): JobCard[] => {
  const raw = payload?.data;
  const candidates = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.jobs)
      ? raw.jobs
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

  return candidates.map((job: any, idx: number) => ({
    id: job.id || job.job_id || `${job.organization || "job"}-${idx}`,
    title: job.title || job.job_title || "Unknown Title",
    company: job.organization || job.company || job.company_name || "Unknown Company",
    location: job.location || "Unknown Location",
    date: job.date_posted || job.posted_date || "N/A",
    url: job.url || job.linkedin_url || job.source_url || "#",
    salary: job.salary_raw || job.salary || undefined,
  }));
};

const normalize = (value: string) => value.trim() || undefined;
const normalizeNumber = (value: string) => (value.trim() === "" ? undefined : Number(value));

const mapWindowToLinkedInTpr = (value: LinkedInWindow) => {
  if (value === "24h") return "r86400";
  if (value === "7d") return "r604800";
  return "r15552000";
};

const boolToLinkedIn = (value: boolean | undefined, token: string) => (value ? token : "");

const buildLinkedInJobSearchUrl = (payload: LinkedInSearchPayload) => {
  const keywords = [payload.title_filter, payload.description_filter, payload.organization_filter].filter(Boolean).join(" ");
  const params = new URLSearchParams();

  if (keywords) params.set("keywords", keywords);
  if (payload.location_filter) params.set("location", payload.location_filter);
  if (payload.window) params.set("f_TPR", mapWindowToLinkedInTpr(payload.window));
  if (payload.remote) params.set("f_WT", "2");
  if (payload.type_filter) params.set("f_JT", payload.type_filter);
  if (payload.seniority_filter) params.set("f_E", payload.seniority_filter);
  if (payload.industry_filter) params.set("f_I", payload.industry_filter);

  const easyApplyToken = boolToLinkedIn(payload.directapply, "2");
  if (easyApplyToken) params.set("f_AL", easyApplyToken);

  const salaryToken = boolToLinkedIn(payload.ai_has_salary, "true");
  if (salaryToken) params.set("salary", salaryToken);

  params.set("sortBy", payload.order === "asc" ? "R" : "DD");
  params.set("start", String(payload.offset || 0));

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
};

export default function LinkedinPage() {
  const router = useRouter();
  const [windowFilter, setWindowFilter] = useState<LinkedInWindow>("24h");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [titleFilter, setTitleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [seniorityFilter, setSeniorityFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");

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

  const payloadPreview = useMemo<LinkedInSearchPayload>(
    () => ({
      window: windowFilter,
      limit,
      offset,
      title_filter: normalize(titleFilter),
      location_filter: normalize(locationFilter),
      organization_filter: normalize(organizationFilter),
      description_filter: normalize(descriptionFilter),
      type_filter: normalize(typeFilter),
      seniority_filter: normalize(seniorityFilter),
      ai_experience_level_filter: normalize(seniorityFilter),
      industry_filter: normalize(industryFilter),
      remote: remoteOnly || undefined,
      directapply: directApply || undefined,
      ai_has_salary: showSalary || undefined,
      employees_gte: normalizeNumber(employeesGte),
      employees_lte: normalizeNumber(employeesLte),
      order: order === "asc" ? "asc" : undefined,
      extra_query_params: {
        linkedin_query: buildLinkedInJobSearchUrl({
          window: windowFilter,
          limit,
          offset,
          title_filter: normalize(titleFilter),
          location_filter: normalize(locationFilter),
          organization_filter: normalize(organizationFilter),
          description_filter: normalize(descriptionFilter),
          type_filter: normalize(typeFilter),
          seniority_filter: normalize(seniorityFilter),
          industry_filter: normalize(industryFilter),
          remote: remoteOnly || undefined,
          directapply: directApply || undefined,
          ai_has_salary: showSalary || undefined,
          employees_gte: normalizeNumber(employeesGte),
          employees_lte: normalizeNumber(employeesLte),
          order: order === "asc" ? "asc" : undefined,
        }),
      },
    }),
    [
      windowFilter,
      limit,
      offset,
      titleFilter,
      locationFilter,
      organizationFilter,
      descriptionFilter,
      typeFilter,
      seniorityFilter,
      industryFilter,
      remoteOnly,
      directApply,
      showSalary,
      employeesGte,
      employeesLte,
      order,
    ]
  );

  const queryUrl = useMemo(() => buildLinkedInJobSearchUrl(payloadPreview), [payloadPreview]);

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
        setTitleFilter(data.titleFilter || "");
        setLocationFilter(data.locationFilter || "");
        setOrganizationFilter(data.organizationFilter || "");
        setDescriptionFilter(data.descriptionFilter || "");
        setTypeFilter(data.typeFilter || "");
        setSeniorityFilter(data.seniorityFilter || "");
        setIndustryFilter(data.industryFilter || "");
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
        titleFilter,
        locationFilter,
        organizationFilter,
        descriptionFilter,
        typeFilter,
        seniorityFilter,
        industryFilter,
        remoteOnly,
        directApply,
        showSalary,
        employeesGte,
        employeesLte,
        order,
      })
    );
  }, [windowFilter, limit, offset, titleFilter, locationFilter, organizationFilter, descriptionFilter, typeFilter, seniorityFilter, industryFilter, remoteOnly, directApply, showSalary, employeesGte, employeesLte, order]);

  const saveCurrentSearch = () => {
    const name = `${titleFilter || "Search"} • ${new Date().toLocaleString()}`;
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
    setTitleFilter(p.title_filter || "");
    setLocationFilter(p.location_filter || "");
    setOrganizationFilter(p.organization_filter || "");
    setDescriptionFilter(p.description_filter || "");
    setTypeFilter(p.type_filter || "");
    setSeniorityFilter(p.seniority_filter || p.ai_experience_level_filter || "");
    setIndustryFilter(p.industry_filter || "");
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
    const header = "Title,Company,Location,Posted,Url,Salary\n";
    const rows = jobs
      .map((j) => [j.title, j.company, j.location, j.date, j.url, j.salary || ""].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkedin-jobs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await searchLinkedInJobs(payloadPreview);
      setJobs(parseJobs(response));
    } catch (err: any) {
      setError(err?.message || "Unable to fetch jobs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>LinkedIn Job Search Dashboard | HireSense</title>
      </Head>

      <main style={shellStyle}>
        <section style={contentStyle}>
          <header style={navbarStyle}>
            <div>
              <button type="button" style={backBtnStyle} onClick={() => router.push("/")}>← Back to dashboard</button>
              <h2 style={{ margin: "8px 0 0", fontSize: "1.1rem" }}>LinkedIn Job Search Query Builder</h2>
            </div>
            <div style={navActionsStyle}>
              <button type="button" style={navBtnStyle} onClick={saveCurrentSearch}>Save search</button>
              <button type="button" style={navBtnStyle} onClick={exportFilters}>Export filters</button>
            </div>
          </header>

          <div style={menuRowStyle}>
            {["Search Builder", "Saved Filters", "Campaigns", "Talent Pipelines", "Exports"].map((item) => (
              <button key={item} type="button" onClick={() => setActiveTab(item)} style={{ ...tabBtnStyle, ...(activeTab === item ? tabBtnActiveStyle : {}) }}>
                {item}
              </button>
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
              <form onSubmit={onSearch} style={panelStyle}>
                <h3 style={sectionTitle}>Core LinkedIn search filters</h3>
                <div style={gridStyle}>
                  <Field label="Role keywords"><input value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} style={inputStyle} placeholder="Product Manager, Data Engineer" /></Field>
                  <Field label="Location"><input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} style={inputStyle} placeholder="United States, Bengaluru, Remote" /></Field>
                  <Field label="Company"><input value={organizationFilter} onChange={(e) => setOrganizationFilter(e.target.value)} style={inputStyle} placeholder="Google, Stripe" /></Field>
                  <Field label="Description keywords"><input value={descriptionFilter} onChange={(e) => setDescriptionFilter(e.target.value)} style={inputStyle} placeholder="NLP, GTM, B2B SaaS" /></Field>

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
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={inputStyle}>
                      <option value="">Any</option>
                      {["Full-time", "Part-time", "Contract", "Temporary", "Internship"].map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Seniority">
                    <select value={seniorityFilter} onChange={(e) => setSeniorityFilter(e.target.value)} style={inputStyle}>
                      <option value="">Any</option>
                      {seniorityOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Industry"><input value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} style={inputStyle} placeholder="Fintech, AI, Healthcare" /></Field>
                  <Field label="Limit"><input type="number" min={10} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value || 10))} style={inputStyle} /></Field>
                  <Field label="Offset"><input type="number" min={0} value={offset} onChange={(e) => setOffset(Number(e.target.value || 0))} style={inputStyle} /></Field>
                </div>

                <h3 style={sectionTitle}>Additional filters</h3>
                <div style={gridStyle}>
                  <Field label="Min employees"><input type="number" min={0} value={employeesGte} onChange={(e) => setEmployeesGte(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Max employees"><input type="number" min={0} value={employeesLte} onChange={(e) => setEmployeesLte(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Workplace preset">
                    <select value={remoteOnly ? "Remote" : ""} onChange={(e) => setRemoteOnly(e.target.value === "Remote")} style={inputStyle}>
                      <option value="">Any</option>
                      {workplaceOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Experience preset">
                    <select value={Object.keys(experienceToSeniority).find((k) => experienceToSeniority[k] === seniorityFilter) || ""} onChange={(e) => setSeniorityFilter(experienceToSeniority[e.target.value] || "")} style={inputStyle}>
                      <option value="">Any</option>
                      {experienceOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div style={checkboxRowStyle}>
                  <label><input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote only</label>
                  <label><input type="checkbox" checked={directApply} onChange={(e) => setDirectApply(e.target.checked)} /> Easy apply only</label>
                  <label><input type="checkbox" checked={showSalary} onChange={(e) => setShowSalary(e.target.checked)} /> Salary listed</label>
                </div>

                <button type="submit" disabled={loading} style={submitStyle}>{loading ? "Searching..." : "Search"}</button>
              </form>

              <section style={panelStyle}>
                <h3 style={sectionTitle}>Generated LinkedIn search query</h3>
                <p style={{ margin: "0 0 10px", color: "#93c5fd", fontSize: "0.9rem" }}>
                  This URL updates live as you choose filters.
                </p>
                <code style={queryStyle}>{queryUrl}</code>
                {error && <p style={{ color: "#fca5a5", marginTop: 12 }}>{error}</p>}
              </section>
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
                <li>Campaign Name: {titleFilter || "General LinkedIn Search"}</li>
                <li>Target Location: {locationFilter || "Any"}</li>
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

          <section style={resultsGridStyle}>
            {jobs.map((job) => (
              <article key={job.id} style={jobCardStyle}>
                <h4 style={{ margin: "0 0 8px" }}>{job.title}</h4>
                <p style={metaStyle}><strong>Company:</strong> {job.company}</p>
                <p style={metaStyle}><strong>Location:</strong> {job.location}</p>
                <p style={metaStyle}><strong>Posted:</strong> {job.date}</p>
                {job.salary && <p style={metaStyle}><strong>Salary:</strong> {job.salary}</p>}
                <a href={job.url} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>Open job ↗</a>
              </article>
            ))}
          </section>
        </section>
      </main>
    </>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <article style={kpiCardStyle}>
      <p style={{ margin: 0, color: "#93c5fd", fontSize: "0.82rem" }}>{label}</p>
      <strong style={{ fontSize: "1.15rem" }}>{value}</strong>
    </article>
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

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #172554, #020617 60%)",
  color: "#e2e8f0",
};

const contentStyle: CSSProperties = {
  padding: "18px 22px",
  maxWidth: 1200,
  margin: "0 auto",
};

const navbarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid #334155",
  borderRadius: 14,
  padding: "14px 16px",
  background: "rgba(15, 23, 42, 0.65)",
  marginBottom: 14,
};

const menuRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 14,
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
  gap: 10,
  marginBottom: 14,
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
  padding: 16,
  marginBottom: 14,
  background: "rgba(15, 23, 42, 0.72)",
};

const sectionTitle: CSSProperties = {
  margin: "0 0 10px",
  fontSize: "1rem",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#020617",
  color: "#e2e8f0",
  border: "1px solid #334155",
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

const resultsGridStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const jobCardStyle: CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 12,
  background: "rgba(15, 23, 42, 0.85)",
  padding: 12,
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
