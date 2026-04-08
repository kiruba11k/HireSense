import Head from "next/head";
import { FormEvent, useState } from "react";
import { useRouter } from "next/router";

import { detectTechStack, TechStackResponse } from "../services/api";

const DASHBOARD_STATE_KEY = "hiresense.dashboard.state";

export default function TechStackPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [jobData, setJobData] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TechStackResponse | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await detectTechStack({
        company_name: companyName.trim(),
        company_website: companyWebsite.trim(),
        job_data: jobData.trim(),
      });
      setResult(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to detect tech stack");
    } finally {
      setLoading(false);
    }
  };

  const renderList = (title: string, values: string[]) => (
    <div className="col-md-6" key={title}>
      <div className="card h-100" style={{ background: "#FAF9F5", borderColor: "#D8D2C6", color: "#3D322D" }}>
        <div className="card-header fw-semibold">{title}</div>
        <div className="card-body">
          {values.length ? (
            <ul className="mb-0">
              {values.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
          ) : (
            <span className="text-secondary">No tools detected</span>
          )}
        </div>
      </div>
    </div>
  );

  const backToDashboard = () => {
    if (typeof window !== "undefined") {
      try {
        const persisted = window.sessionStorage.getItem(DASHBOARD_STATE_KEY);
        const parsed = persisted ? JSON.parse(persisted) : {};
        window.sessionStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify({ ...parsed, activeView: "overview" }));
      } catch {
        window.sessionStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify({ activeView: "overview" }));
      }
    }
    router.push("/");
  };

  return (
    <>
      <Head>
        <title>HireSense • Tech Stack Detector</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
      </Head>
      <main style={{ minHeight: "100vh", background: "#F4F3EE" }}>
        <div className="container py-4" style={{ color: "#3D322D" }}>
          <button type="button" onClick={backToDashboard} className="btn btn-sm mb-3" style={{ borderColor: "#C15F3C", color: "#A14A2F" }}>← Back to Main Dashboard</button>

          <div className="card mb-4" style={{ background: "#FAF9F5", borderColor: "#D8D2C6" }}>
            <div className="card-body">
              <h3 className="mb-3">Tech Stack Detector</h3>
              <form onSubmit={onSubmit} className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Company Name</label>
                  <input className="form-control" style={{ background: "#fff", borderColor: "#D8D2C6", color: "#3D322D" }} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Company Website</label>
                  <input className="form-control" style={{ background: "#fff", borderColor: "#D8D2C6", color: "#3D322D" }} value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://example.com" required />
                </div>
                <div className="col-12">
                  <label className="form-label">Job Data (Optional)</label>
                  <textarea className="form-control" style={{ background: "#fff", borderColor: "#D8D2C6", color: "#3D322D" }} rows={4} value={jobData} onChange={(e) => setJobData(e.target.value)} />
                </div>
                <div className="col-12 d-flex justify-content-end">
                  <button type="submit" className="btn" style={{ background: "#C15F3C", color: "#fff" }} disabled={loading}>{loading ? "Detecting..." : "Detect Tech Stack"}</button>
                </div>
              </form>
              {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
            </div>
          </div>

          {result && (
            <div className="d-grid gap-3">
              <div className="row g-3">
                {renderList("ERP Stack", result.erp_stack || [])}
                {renderList("CRM Stack", result.crm_stack || [])}
                {renderList("Cloud Stack", result.cloud_stack || [])}
                {renderList("Data Stack", result.data_stack || [])}
                {renderList("Testing Tools", result.testing_tools || [])}
              </div>

              <div className="card" style={{ background: "#FAF9F5", borderColor: "#D8D2C6" }}>
                <div className="card-header fw-semibold">Evidence Sources</div>
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead>
                      <tr>
                        <th>Tool</th>
                        <th>Evidence Sentence</th>
                        <th>Source URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.evidence_sources || []).length ? (
                        result.evidence_sources.map((evidence, idx) => (
                          <tr key={`${evidence.tool}-${idx}`}>
                            <td>{evidence.tool}</td>
                            <td>{evidence.evidence_sentence}</td>
                            <td><a href={evidence.source_url} target="_blank" rel="noreferrer">{evidence.source_url}</a></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="text-secondary">No evidence captured.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
