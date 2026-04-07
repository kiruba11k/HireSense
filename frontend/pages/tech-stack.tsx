import Head from "next/head";
import { FormEvent, useState } from "react";

import { detectTechStack, TechStackResponse } from "../services/api";

export default function TechStackPage() {
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
      if (response.error) setError(response.error);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to detect tech stack");
    } finally {
      setLoading(false);
    }
  };

  const renderList = (title: string, values: string[]) => (
    <div className="col-md-6" key={title}>
      <div className="card bg-dark text-light border-info h-100">
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

  return (
    <>
      <Head>
        <title>HireSense • Tech Stack Detector</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
      </Head>
      <main style={{ minHeight: "100vh", background: "#0F172A" }}>
        <div className="container py-4 text-light">
          <a href="/" className="btn btn-outline-light btn-sm mb-3">← Back to Main Dashboard</a>

          <div className="card bg-dark text-light border-info mb-4">
            <div className="card-body">
              <h3 className="mb-3">Tech Stack Detector</h3>
              <form onSubmit={onSubmit} className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Company Name</label>
                  <input className="form-control bg-dark text-light border-info" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Company Website</label>
                  <input className="form-control bg-dark text-light border-info" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://example.com" required />
                </div>
                <div className="col-12">
                  <label className="form-label">Job Data (Optional)</label>
                  <textarea className="form-control bg-dark text-light border-info" rows={4} value={jobData} onChange={(e) => setJobData(e.target.value)} />
                </div>
                <div className="col-12 d-flex justify-content-end">
                  <button type="submit" className="btn btn-info" disabled={loading}>{loading ? "Detecting..." : "Detect Tech Stack"}</button>
                </div>
              </form>
              {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
            </div>
          </div>

          {result && !result.error && (
            <div className="d-grid gap-3">
              <div className="row g-3">
                {renderList("ERP Stack", result.erp_stack || [])}
                {renderList("CRM Stack", result.crm_stack || [])}
                {renderList("Cloud Stack", result.cloud_stack || [])}
                {renderList("Data Stack", result.data_stack || [])}
                {renderList("Testing Tools", result.testing_tools || [])}
              </div>

              <div className="card bg-dark text-light border-info">
                <div className="card-header fw-semibold">Evidence Sources</div>
                <div className="table-responsive">
                  <table className="table table-dark table-striped mb-0">
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
