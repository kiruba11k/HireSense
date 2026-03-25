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

const parseJobs = (payload: any): JobCard[] => {
  const raw = payload?.data;
  const candidates = Array.isArray(raw) ? raw : Array.isArray(raw?.jobs) ? raw.jobs : Array.isArray(raw?.data) ? raw.data : [];

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

const boolToOptional = (v: string): boolean | undefined => (v === "" ? undefined : v === "true");

export default function LinkedinPage() {
  const [backendUrl, setBackendUrl] = useState(process.env.NEXT_PUBLIC_API_URL || defaultBackend);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [lastPath, setLastPath] = useState("");

  const [windowFilter, setWindowFilter] = useState<LinkedInWindow>("24h");
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [titleFilter, setTitleFilter] = useState("Data Engineer");
  const [advancedTitleFilter, setAdvancedTitleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState('"United States" OR "United Kingdom"');
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [organizationSlugFilter, setOrganizationSlugFilter] = useState("");
  const [organizationDescriptionFilter, setOrganizationDescriptionFilter] = useState("");
  const [organizationSpecialtiesFilter, setOrganizationSpecialtiesFilter] = useState("");
  const [advancedOrganizationFilter, setAdvancedOrganizationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [seniorityFilter, setSeniorityFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [descriptionType, setDescriptionType] = useState<"text" | "html">("text");
  const [dateFilter, setDateFilter] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [employeesGte, setEmployeesGte] = useState("");
  const [employeesLte, setEmployeesLte] = useState("");
  const [remote, setRemote] = useState("");
  const [agency, setAgency] = useState("");
  const [excludeAts, setExcludeAts] = useState("");
  const [externalApplyUrl, setExternalApplyUrl] = useState("");
  const [directApply, setDirectApply] = useState("");
  const [includeAi, setIncludeAi] = useState("");
  const [aiWorkArrangement, setAiWorkArrangement] = useState("");
  const [aiExperienceLevel, setAiExperienceLevel] = useState("");
  const [aiVisaSponsorship, setAiVisaSponsorship] = useState("");
  const [aiTaxonomiesA, setAiTaxonomiesA] = useState("");
  const [aiTaxonomiesAPrimary, setAiTaxonomiesAPrimary] = useState("");
  const [aiTaxonomiesAExclusion, setAiTaxonomiesAExclusion] = useState("");
  const [aiEducationRequirements, setAiEducationRequirements] = useState("");
  const [aiHasSalary, setAiHasSalary] = useState("");

  const payloadPreview = useMemo<LinkedInSearchPayload>(
    () => ({
      window: windowFilter,
      limit,
      offset,
      title_filter: titleFilter || undefined,
      advanced_title_filter: advancedTitleFilter || undefined,
      location_filter: locationFilter || undefined,
      description_filter: descriptionFilter || undefined,
      organization_filter: organizationFilter || undefined,
      organization_slug_filter: organizationSlugFilter || undefined,
      organization_description_filter: organizationDescriptionFilter || undefined,
      organization_specialties_filter: organizationSpecialtiesFilter || undefined,
      advanced_organization_filter: advancedOrganizationFilter || undefined,
      type_filter: typeFilter || undefined,
      seniority_filter: seniorityFilter || undefined,
      industry_filter: industryFilter || undefined,
      description_type: descriptionType,
      date_filter: dateFilter || undefined,
      order,
      employees_gte: employeesGte ? Number(employeesGte) : undefined,
      employees_lte: employeesLte ? Number(employeesLte) : undefined,
      remote: boolToOptional(remote),
      agency: boolToOptional(agency),
      exclude_ats_duplicate: boolToOptional(excludeAts),
      external_apply_url: boolToOptional(externalApplyUrl),
      directapply: boolToOptional(directApply),
      include_ai: boolToOptional(includeAi),
      ai_work_arrangement_filter: aiWorkArrangement || undefined,
      ai_experience_level_filter: aiExperienceLevel || undefined,
      ai_visa_sponsorship_filter: boolToOptional(aiVisaSponsorship),
      ai_taxonomies_a_filter: aiTaxonomiesA || undefined,
      ai_taxonomies_a_primary_filter: aiTaxonomiesAPrimary || undefined,
      ai_taxonomies_a_exclusion_filter: aiTaxonomiesAExclusion || undefined,
      ai_education_requirements_filter: aiEducationRequirements || undefined,
      ai_has_salary: boolToOptional(aiHasSalary),
    }),
    [windowFilter, limit, offset, titleFilter, advancedTitleFilter, locationFilter, descriptionFilter, organizationFilter, organizationSlugFilter, organizationDescriptionFilter, organizationSpecialtiesFilter, advancedOrganizationFilter, typeFilter, seniorityFilter, industryFilter, descriptionType, dateFilter, order, employeesGte, employeesLte, remote, agency, excludeAts, externalApplyUrl, directApply, includeAi, aiWorkArrangement, aiExperienceLevel, aiVisaSponsorship, aiTaxonomiesA, aiTaxonomiesAPrimary, aiTaxonomiesAExclusion, aiEducationRequirements, aiHasSalary]
  );

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
      <Head><title>LinkedIn Job Scraper | HireSense</title></Head>
      <main style={pageStyle}>
        <section style={{ maxWidth: 1280, margin: "0 auto" }}>
          <h1 style={{ marginBottom: 6 }}>LinkedIn Job Scraper</h1>
          <p style={{ color: "#94a3b8", marginBottom: 16 }}>Now mapped to backend contract with full query-parameter coverage.</p>

          <form onSubmit={onSubmit} style={panelStyle}>
            <h3>Core Query</h3>
            <div style={gridStyle}>
              <label>Backend URL<input style={inputStyle} value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} /></label>
              <label>Window<select style={inputStyle} value={windowFilter} onChange={(e) => setWindowFilter(e.target.value as LinkedInWindow)}><option value="24h">24h</option><option value="7d">7d</option><option value="6m">6m</option></select></label>
              <label>Limit (10-100)<input style={inputStyle} type="number" min={10} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value || 10))} /></label>
              <label>Offset<input style={inputStyle} type="number" min={0} value={offset} onChange={(e) => setOffset(Number(e.target.value || 0))} /></label>
              <label>Title Filter<input style={inputStyle} value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} /></label>
              <label>Advanced Title Filter<input style={inputStyle} value={advancedTitleFilter} onChange={(e) => setAdvancedTitleFilter(e.target.value)} /></label>
              <label>Location Filter<input style={inputStyle} value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} /></label>
              <label>Description Filter<input style={inputStyle} value={descriptionFilter} onChange={(e) => setDescriptionFilter(e.target.value)} /></label>
              <label>Organization Filter<input style={inputStyle} value={organizationFilter} onChange={(e) => setOrganizationFilter(e.target.value)} /></label>
              <label>Organization Slug Filter<input style={inputStyle} value={organizationSlugFilter} onChange={(e) => setOrganizationSlugFilter(e.target.value)} /></label>
              <label>Organization Description Filter<input style={inputStyle} value={organizationDescriptionFilter} onChange={(e) => setOrganizationDescriptionFilter(e.target.value)} /></label>
              <label>Organization Specialties Filter<input style={inputStyle} value={organizationSpecialtiesFilter} onChange={(e) => setOrganizationSpecialtiesFilter(e.target.value)} /></label>
              <label>Advanced Organization Filter<input style={inputStyle} value={advancedOrganizationFilter} onChange={(e) => setAdvancedOrganizationFilter(e.target.value)} /></label>
              <label>Type Filter<input style={inputStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} placeholder="FULL_TIME,PART_TIME" /></label>
              <label>Seniority Filter<input style={inputStyle} value={seniorityFilter} onChange={(e) => setSeniorityFilter(e.target.value)} /></label>
              <label>Industry Filter<input style={inputStyle} value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} /></label>
              <label>Description Type<select style={inputStyle} value={descriptionType} onChange={(e) => setDescriptionType(e.target.value as "text" | "html")}><option value="text">text</option><option value="html">html</option></select></label>
              <label>Date Filter (UTC)<input style={inputStyle} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} placeholder="2025-01-01T14:00:00" /></label>
              <label>Order<select style={inputStyle} value={order} onChange={(e) => setOrder(e.target.value as "asc" | "desc")}><option value="desc">desc</option><option value="asc">asc</option></select></label>
              <label>Employees GTE<input style={inputStyle} type="number" value={employeesGte} onChange={(e) => setEmployeesGte(e.target.value)} /></label>
              <label>Employees LTE<input style={inputStyle} type="number" value={employeesLte} onChange={(e) => setEmployeesLte(e.target.value)} /></label>
            </div>

            <h3 style={{ marginTop: 18 }}>Boolean Filters</h3>
            <div style={gridStyle}>
              <label>Remote<select style={inputStyle} value={remote} onChange={(e) => setRemote(e.target.value)}><option value="">any</option><option value="true">true</option><option value="false">false</option></select></label>
              <label>Agency<select style={inputStyle} value={agency} onChange={(e) => setAgency(e.target.value)}><option value="">any</option><option value="true">true</option><option value="false">false</option></select></label>
              <label>Exclude ATS duplicate<select style={inputStyle} value={excludeAts} onChange={(e) => setExcludeAts(e.target.value)}><option value="">any</option><option value="true">true</option><option value="false">false</option></select></label>
              <label>External Apply URL<select style={inputStyle} value={externalApplyUrl} onChange={(e) => setExternalApplyUrl(e.target.value)}><option value="">any</option><option value="true">true</option><option value="false">false</option></select></label>
              <label>Direct Apply<select style={inputStyle} value={directApply} onChange={(e) => setDirectApply(e.target.value)}><option value="">any</option><option value="true">true</option><option value="false">false</option></select></label>
            </div>

            <h3 style={{ marginTop: 18 }}>AI Filters</h3>
            <div style={gridStyle}>
              <label>Include AI<select style={inputStyle} value={includeAi} onChange={(e) => setIncludeAi(e.target.value)}><option value="">any</option><option value="true">true</option><option value="false">false</option></select></label>
              <label>AI Work Arrangement<input style={inputStyle} value={aiWorkArrangement} onChange={(e) => setAiWorkArrangement(e.target.value)} placeholder="Hybrid,Remote OK" /></label>
              <label>AI Experience Level<input style={inputStyle} value={aiExperienceLevel} onChange={(e) => setAiExperienceLevel(e.target.value)} placeholder="0-2,2-5" /></label>
              <label>AI Visa Sponsorship<select style={inputStyle} value={aiVisaSponsorship} onChange={(e) => setAiVisaSponsorship(e.target.value)}><option value="">any</option><option value="true">true</option><option value="false">false</option></select></label>
              <label>AI Taxonomies A<input style={inputStyle} value={aiTaxonomiesA} onChange={(e) => setAiTaxonomiesA(e.target.value)} /></label>
              <label>AI Taxonomies A Primary<input style={inputStyle} value={aiTaxonomiesAPrimary} onChange={(e) => setAiTaxonomiesAPrimary(e.target.value)} /></label>
              <label>AI Taxonomies A Exclusion<input style={inputStyle} value={aiTaxonomiesAExclusion} onChange={(e) => setAiTaxonomiesAExclusion(e.target.value)} /></label>
              <label>AI Education Requirements<input style={inputStyle} value={aiEducationRequirements} onChange={(e) => setAiEducationRequirements(e.target.value)} /></label>
              <label>AI Has Salary<select style={inputStyle} value={aiHasSalary} onChange={(e) => setAiHasSalary(e.target.value)}><option value="">any</option><option value="true">true</option><option value="false">false</option></select></label>
            </div>

            <button type="submit" disabled={loading} style={btnStyle}>{loading ? "Searching..." : "Run LinkedIn Search"}</button>
          </form>

          <section style={{ ...panelStyle, marginTop: 16 }}>
            <h3>Payload Preview</h3>
            <pre style={{ whiteSpace: "pre-wrap", color: "#93c5fd" }}>{JSON.stringify(payloadPreview, null, 2)}</pre>
            {lastPath && <p>Resolved backend query: <code>{lastPath}</code></p>}
            {error && <p style={{ color: "#fda4af" }}>{error}</p>}
          </section>

          <section style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {jobs.map((job) => (
              <article key={job.id} style={{ ...panelStyle, padding: 14 }}>
                <h4>{job.title}</h4>
                <p><strong>Company:</strong> {job.company}</p>
                <p><strong>Location:</strong> {job.location}</p>
                <p><strong>Posted:</strong> {job.date}</p>
                {job.salary && <p><strong>Salary:</strong> {job.salary}</p>}
                <a href={job.url} target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>Open Job ↗</a>
              </article>
            ))}
          </section>
        </section>
      </main>
    </>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg,#0f172a,#111827)",
  color: "#e2e8f0",
  padding: "2rem",
};

const panelStyle: CSSProperties = {
  background: "rgba(15,23,42,0.7)",
  border: "1px solid #334155",
  borderRadius: 14,
  padding: 18,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const inputStyle: CSSProperties = {
  width: "100%",
  marginTop: 5,
  background: "#0b1220",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "8px 10px",
};

const btnStyle: CSSProperties = {
  marginTop: 16,
  background: "linear-gradient(90deg,#2563eb,#7c3aed)",
  border: "none",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 16px",
  cursor: "pointer",
};
