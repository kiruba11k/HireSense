import { CSSProperties, FormEvent, useMemo, useState } from "react";
import Head from "next/head";
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

const defaultBackend = "https://hiresense-backend-75hd.onrender.com";

const windows: Array<{ label: string; value: LinkedInWindow }> = [
  { label: "Last 24 Hours", value: "24h" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 6 Months", value: "6m" },
];

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

export default function LinkedinPage() {
  const [backendUrl, setBackendUrl] = useState(process.env.NEXT_PUBLIC_API_URL || defaultBackend);
  const [windowFilter, setWindowFilter] = useState<LinkedInWindow>("24h");
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  const [titleFilter, setTitleFilter] = useState("");
  const [advancedTitleFilter, setAdvancedTitleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [organizationSlugFilter, setOrganizationSlugFilter] = useState("");
  const [advancedOrganizationFilter, setAdvancedOrganizationFilter] = useState("");
  const [organizationDescriptionFilter, setOrganizationDescriptionFilter] = useState("");
  const [organizationSpecialtiesFilter, setOrganizationSpecialtiesFilter] = useState("");

  const [typeFilter, setTypeFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [seniorityFilter, setSeniorityFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [descriptionType, setDescriptionType] = useState<"text" | "html" | "">("text");

  const [aiWorkArrangementFilter, setAiWorkArrangementFilter] = useState("");
  const [aiExperienceLevelFilter, setAiExperienceLevelFilter] = useState("");
  const [aiTaxonomiesAFilter, setAiTaxonomiesAFilter] = useState("");
  const [aiTaxonomiesAPrimaryFilter, setAiTaxonomiesAPrimaryFilter] = useState("");
  const [aiTaxonomiesAExclusionFilter, setAiTaxonomiesAExclusionFilter] = useState("");

  const [employeesGte, setEmployeesGte] = useState("");
  const [employeesLte, setEmployeesLte] = useState("");

  const [remoteOnly, setRemoteOnly] = useState(false);
  const [remoteOnlyEnabled, setRemoteOnlyEnabled] = useState(false);
  const [agency, setAgency] = useState(false);
  const [agencyEnabled, setAgencyEnabled] = useState(false);
  const [includeAi, setIncludeAi] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [externalApplyUrl, setExternalApplyUrl] = useState(false);
  const [externalApplyUrlEnabled, setExternalApplyUrlEnabled] = useState(false);
  const [directApply, setDirectApply] = useState(false);
  const [directApplyEnabled, setDirectApplyEnabled] = useState(false);
  const [excludeAtsDuplicate, setExcludeAtsDuplicate] = useState(false);
  const [excludeAtsDuplicateEnabled, setExcludeAtsDuplicateEnabled] = useState(false);
  const [aiVisaSponsorshipFilter, setAiVisaSponsorshipFilter] = useState(false);
  const [aiVisaSponsorshipEnabled, setAiVisaSponsorshipEnabled] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [lastPath, setLastPath] = useState("");

  const payloadPreview = useMemo<LinkedInSearchPayload>(() => {
    const extraQueryParams: NonNullable<LinkedInSearchPayload["extra_query_params"]> = {};

    const mappedExtras = {
      organization_description_filter: normalize(organizationDescriptionFilter),
      organization_specialties_filter: normalize(organizationSpecialtiesFilter),
      advanced_organization_filter: normalize(advancedOrganizationFilter),
      ai_taxonomies_a_primary_filter: normalize(aiTaxonomiesAPrimaryFilter),
      ai_taxonomies_a_exclusion_filter: normalize(aiTaxonomiesAExclusionFilter),
      exclude_ats_duplicate: excludeAtsDuplicateEnabled ? excludeAtsDuplicate : undefined,
      ai_visa_sponsorship_filter: aiVisaSponsorshipEnabled ? aiVisaSponsorshipFilter : undefined,
    };

    Object.entries(mappedExtras).forEach(([key, value]) => {
      if (value !== undefined) {
        extraQueryParams[key] = value;
      }
    });

    return {
      window: windowFilter,
      limit,
      offset,
      title_filter: normalize(titleFilter),
      advanced_title_filter: normalize(advancedTitleFilter),
      location_filter: normalize(locationFilter),
      description_filter: normalize(descriptionFilter),
      organization_filter: normalize(organizationFilter),
      organization_slug_filter: normalize(organizationSlugFilter),
      type_filter: normalize(typeFilter),
      remote: remoteOnlyEnabled ? remoteOnly : undefined,
      agency: agencyEnabled ? agency : undefined,
      seniority_filter: normalize(seniorityFilter),
      industry_filter: normalize(industryFilter),
      include_ai: includeAi || undefined,
      ai_work_arrangement_filter: normalize(aiWorkArrangementFilter),
      ai_experience_level_filter: normalize(aiExperienceLevelFilter),
      ai_taxonomies_a_filter: normalize(aiTaxonomiesAFilter),
      ai_has_salary: showSalary || undefined,
      date_filter: normalize(dateFilter),
      order: order === "asc" ? "asc" : undefined,
      description_type: normalize(descriptionType) as "text" | "html" | undefined,
      external_apply_url: externalApplyUrlEnabled ? externalApplyUrl : undefined,
      directapply: directApplyEnabled ? directApply : undefined,
      employees_gte: normalizeNumber(employeesGte),
      employees_lte: normalizeNumber(employeesLte),
      extra_query_params: Object.keys(extraQueryParams).length ? extraQueryParams : undefined,
    };
  }, [
    windowFilter,
    limit,
    offset,
    titleFilter,
    advancedTitleFilter,
    locationFilter,
    descriptionFilter,
    organizationFilter,
    organizationSlugFilter,
    typeFilter,
    remoteOnlyEnabled,
    remoteOnly,
    agencyEnabled,
    agency,
    seniorityFilter,
    industryFilter,
    includeAi,
    aiWorkArrangementFilter,
    aiExperienceLevelFilter,
    aiTaxonomiesAFilter,
    showSalary,
    dateFilter,
    order,
    descriptionType,
    externalApplyUrlEnabled,
    externalApplyUrl,
    directApplyEnabled,
    directApply,
    employeesGte,
    employeesLte,
    organizationDescriptionFilter,
    organizationSpecialtiesFilter,
    advancedOrganizationFilter,
    aiTaxonomiesAPrimaryFilter,
    aiTaxonomiesAExclusionFilter,
    excludeAtsDuplicate,
    excludeAtsDuplicateEnabled,
    aiVisaSponsorshipFilter,
    aiVisaSponsorshipEnabled,
  ]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await searchLinkedInJobs(payloadPreview, backendUrl);
      setLastPath(response.path || "");
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
        <title>LinkedIn Job Scraper | HireSense</title>
      </Head>
      <main style={pageStyle}>
        <section style={containerStyle}>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>LinkedIn Job Scraper</h1>
          <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>
            Full query-parameter UI with standard filters, advanced search syntax, and AI beta fields.
          </p>

          <form onSubmit={onSubmit} style={panelStyle}>
            <h2 style={sectionTitle}>Connection & Pagination</h2>
            <div style={gridStyle}>
              <label>
                Backend URL
                <input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} style={inputStyle} />
              </label>
              <label>
                Time Window
                <select value={windowFilter} onChange={(e) => setWindowFilter(e.target.value as LinkedInWindow)} style={inputStyle}>
                  {windows.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Limit (10-100)
                <input type="number" min={10} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value || 10))} style={inputStyle} />
              </label>
              <label>
                Offset
                <input type="number" min={0} value={offset} onChange={(e) => setOffset(Number(e.target.value || 0))} style={inputStyle} />
                <small style={hintStyle}>Use 0, 100, 200... to paginate in batches of 100.</small>
              </label>
            </div>

            <h2 style={sectionTitle}>Text Filters</h2>
            <div style={gridStyle}>
              <label>Title Filter<input value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} style={inputStyle} /></label>
              <label>Advanced Title Filter<input value={advancedTitleFilter} onChange={(e) => setAdvancedTitleFilter(e.target.value)} style={inputStyle} /></label>
              <label>Location Filter<input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} style={inputStyle} /></label>
              <label>Description Filter<input value={descriptionFilter} onChange={(e) => setDescriptionFilter(e.target.value)} style={inputStyle} /></label>
              <label>Organization Filter<input value={organizationFilter} onChange={(e) => setOrganizationFilter(e.target.value)} style={inputStyle} /></label>
              <label>Organization Slug Filter<input value={organizationSlugFilter} onChange={(e) => setOrganizationSlugFilter(e.target.value)} style={inputStyle} /></label>
              <label>Advanced Organization Filter<input value={advancedOrganizationFilter} onChange={(e) => setAdvancedOrganizationFilter(e.target.value)} style={inputStyle} /></label>
              <label>Org Description Filter<input value={organizationDescriptionFilter} onChange={(e) => setOrganizationDescriptionFilter(e.target.value)} style={inputStyle} /></label>
              <label>Org Specialties Filter<input value={organizationSpecialtiesFilter} onChange={(e) => setOrganizationSpecialtiesFilter(e.target.value)} style={inputStyle} /></label>
            </div>

            <h2 style={sectionTitle}>Structured Filters</h2>
            <div style={gridStyle}>
              <label>Type Filter<input value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={inputStyle} /></label>
              <label>Industry Filter<input value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} style={inputStyle} /></label>
              <label>Seniority Filter<input value={seniorityFilter} onChange={(e) => setSeniorityFilter(e.target.value)} style={inputStyle} /></label>
              <label>Date Filter (UTC)<input placeholder="2026-01-01 or 2026-01-01T14:00:00" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={inputStyle} /></label>
              <label>
                Order
                <select value={order} onChange={(e) => setOrder(e.target.value as "desc" | "asc")} style={inputStyle}>
                  <option value="desc">Date Desc (default)</option>
                  <option value="asc">Date Asc</option>
                </select>
              </label>
              <label>
                Description Type
                <select value={descriptionType} onChange={(e) => setDescriptionType(e.target.value as "text" | "html" | "")} style={inputStyle}>
                  <option value="text">text</option>
                  <option value="html">html</option>
                  <option value="">empty (omit descriptions)</option>
                </select>
              </label>
              <label>Employees GTE<input type="number" min={0} value={employeesGte} onChange={(e) => setEmployeesGte(e.target.value)} style={inputStyle} /></label>
              <label>Employees LTE<input type="number" min={0} value={employeesLte} onChange={(e) => setEmployeesLte(e.target.value)} style={inputStyle} /></label>
            </div>

            <h2 style={sectionTitle}>AI Filters (Beta)</h2>
            <div style={gridStyle}>
              <label>AI Work Arrangement<input value={aiWorkArrangementFilter} onChange={(e) => setAiWorkArrangementFilter(e.target.value)} style={inputStyle} /></label>
              <label>AI Experience Level<input value={aiExperienceLevelFilter} onChange={(e) => setAiExperienceLevelFilter(e.target.value)} style={inputStyle} /></label>
              <label>AI Taxonomies<input value={aiTaxonomiesAFilter} onChange={(e) => setAiTaxonomiesAFilter(e.target.value)} style={inputStyle} /></label>
              <label>AI Primary Taxonomies<input value={aiTaxonomiesAPrimaryFilter} onChange={(e) => setAiTaxonomiesAPrimaryFilter(e.target.value)} style={inputStyle} /></label>
              <label>AI Taxonomies Exclusion<input value={aiTaxonomiesAExclusionFilter} onChange={(e) => setAiTaxonomiesAExclusionFilter(e.target.value)} style={inputStyle} /></label>
            </div>

            <h2 style={sectionTitle}>Boolean Flags</h2>
            <div style={flagGridStyle}>
              <TriState label="Remote" enabled={remoteOnlyEnabled} value={remoteOnly} setEnabled={setRemoteOnlyEnabled} setValue={setRemoteOnly} />
              <TriState label="Agency" enabled={agencyEnabled} value={agency} setEnabled={setAgencyEnabled} setValue={setAgency} />
              <TriState label="External Apply URL" enabled={externalApplyUrlEnabled} value={externalApplyUrl} setEnabled={setExternalApplyUrlEnabled} setValue={setExternalApplyUrl} />
              <TriState label="DirectApply" enabled={directApplyEnabled} value={directApply} setEnabled={setDirectApplyEnabled} setValue={setDirectApply} />
              <TriState label="Exclude ATS Duplicate" enabled={excludeAtsDuplicateEnabled} value={excludeAtsDuplicate} setEnabled={setExcludeAtsDuplicateEnabled} setValue={setExcludeAtsDuplicate} />
              <TriState label="AI Visa Sponsorship" enabled={aiVisaSponsorshipEnabled} value={aiVisaSponsorshipFilter} setEnabled={setAiVisaSponsorshipEnabled} setValue={setAiVisaSponsorshipFilter} />
            </div>

            <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
              <label>
                <input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} /> Include AI fields
              </label>
              <label>
                <input type="checkbox" checked={showSalary} onChange={(e) => setShowSalary(e.target.checked)} /> AI has salary only
              </label>
            </div>

            <button type="submit" disabled={loading} style={{ ...btnStyle, marginTop: 18 }}>
              {loading ? "Fetching Jobs..." : "Search Jobs"}
            </button>
          </form>

          <section style={panelStyle}>
            <h2 style={{ marginBottom: 8 }}>Request Preview</h2>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#93c5fd" }}>{JSON.stringify(payloadPreview, null, 2)}</pre>
            {lastPath && (
              <p style={{ marginTop: 12, color: "#cbd5e1" }}>
                Backend Path: <code>{lastPath}</code>
              </p>
            )}
            {error && <p style={{ color: "#fda4af" }}>{error}</p>}
          </section>

          <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {jobs.map((job) => (
              <article key={job.id} style={{ background: "rgba(15,23,42,0.7)", border: "1px solid #334155", borderRadius: 14, padding: 14 }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1rem" }}>{job.title}</h3>
                <p style={metaStyle}><strong>Company:</strong> {job.company}</p>
                <p style={metaStyle}><strong>Location:</strong> {job.location}</p>
                <p style={metaStyle}><strong>Posted:</strong> {job.date}</p>
                {job.salary && <p style={metaStyle}><strong>Salary:</strong> {job.salary}</p>}
                <a href={job.url} target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>View Listing ↗</a>
              </article>
            ))}
          </section>
        </section>
      </main>
    </>
  );
}

function TriState({
  label,
  enabled,
  value,
  setEnabled,
  setValue,
}: {
  label: string;
  enabled: boolean;
  value: boolean;
  setEnabled: (enabled: boolean) => void;
  setValue: (value: boolean) => void;
}) {
  return (
    <div style={triStateBoxStyle}>
      <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Send this parameter
      </label>
      <select disabled={!enabled} value={value ? "true" : "false"} onChange={(e) => setValue(e.target.value === "true")} style={inputStyle}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #0f172a, #111827)",
  color: "#e2e8f0",
  padding: "2rem",
};

const containerStyle: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
};

const panelStyle: CSSProperties = {
  background: "rgba(15,23,42,0.6)",
  border: "1px solid #334155",
  borderRadius: 16,
  padding: 20,
  marginBottom: 18,
};

const sectionTitle: CSSProperties = {
  margin: "16px 0 10px",
  fontSize: "1.05rem",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const flagGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const inputStyle: CSSProperties = {
  width: "100%",
  marginTop: 6,
  background: "#0b1220",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: "10px 12px",
};

const btnStyle: CSSProperties = {
  background: "linear-gradient(90deg, #2563eb, #7c3aed)",
  border: "none",
  color: "white",
  borderRadius: 10,
  padding: "10px 16px",
  cursor: "pointer",
};

const metaStyle: CSSProperties = {
  margin: "4px 0",
  color: "#cbd5e1",
};

const hintStyle: CSSProperties = {
  display: "block",
  marginTop: 6,
  color: "#94a3b8",
  fontSize: "0.78rem",
};

const triStateBoxStyle: CSSProperties = {
  background: "rgba(15,23,42,0.6)",
  border: "1px solid #334155",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 10,
};
