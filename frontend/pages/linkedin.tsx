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

export default function LinkedinPage() {
  const [backendUrl, setBackendUrl] = useState(process.env.NEXT_PUBLIC_API_URL || defaultBackend);
  const [windowFilter, setWindowFilter] = useState<LinkedInWindow>("24h");
  const [titleFilter, setTitleFilter] = useState("Data Engineer");
  const [locationFilter, setLocationFilter] = useState('"United States" OR "United Kingdom"');
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [includeAi, setIncludeAi] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [lastPath, setLastPath] = useState("");

  const payloadPreview = useMemo<LinkedInSearchPayload>(
    () => ({
      window: windowFilter,
      limit,
      offset,
      title_filter: titleFilter || undefined,
      location_filter: locationFilter || undefined,
      organization_filter: organizationFilter || undefined,
      remote: remoteOnly || undefined,
      include_ai: includeAi || undefined,
      ai_has_salary: showSalary || undefined,
      description_type: "text" as const,
    }),
    [windowFilter, limit, offset, titleFilter, locationFilter, organizationFilter, remoteOnly, includeAi, showSalary]
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: LinkedInSearchPayload = {
        ...payloadPreview,
      };
      const response = await searchLinkedInJobs(payload, backendUrl);
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
      <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a, #111827)", color: "#e2e8f0", padding: "2rem" }}>
        <section style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>LinkedIn Job Scraper Agent</h1>
          <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>
            Multi-layer workflow: UI filter layer → backend orchestration layer → RapidAPI integration layer.
          </p>

          <form onSubmit={onSubmit} style={{ background: "rgba(15,23,42,0.6)", border: "1px solid #334155", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <label>
                Backend URL
                <input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} style={inputStyle} />
              </label>
              <label>
                Time Window
                <select value={windowFilter} onChange={(e) => setWindowFilter(e.target.value as LinkedInWindow)} style={inputStyle}>
                  {windows.map((w) => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Title Filter
                <input value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} style={inputStyle} />
              </label>
              <label>
                Location Filter
                <input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} style={inputStyle} />
              </label>
              <label>
                Organization Filter
                <input value={organizationFilter} onChange={(e) => setOrganizationFilter(e.target.value)} style={inputStyle} />
              </label>
              <label>
                Limit (10-100)
                <input type="number" min={10} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value || 10))} style={inputStyle} />
              </label>
              <label>
                Offset
                <input type="number" min={0} value={offset} onChange={(e) => setOffset(Number(e.target.value || 0))} style={inputStyle} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
              <label><input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote only</label>
              <label><input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} /> Include AI fields</label>
              <label><input type="checkbox" checked={showSalary} onChange={(e) => setShowSalary(e.target.checked)} /> Salary only</label>
            </div>

            <button type="submit" disabled={loading} style={{ ...btnStyle, marginTop: 18 }}>
              {loading ? "Fetching Jobs..." : "Search Jobs"}
            </button>
          </form>

          <section style={{ marginTop: 18, background: "rgba(15,23,42,0.6)", border: "1px solid #334155", borderRadius: 16, padding: 20 }}>
            <h2 style={{ marginBottom: 8 }}>Request Preview</h2>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#93c5fd" }}>{JSON.stringify(payloadPreview, null, 2)}</pre>
            {lastPath && <p style={{ marginTop: 12, color: "#cbd5e1" }}>Backend Path: <code>{lastPath}</code></p>}
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
