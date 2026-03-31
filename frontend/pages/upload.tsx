import { FormEvent, useState } from "react";
import Head from "next/head";
import { motion } from "framer-motion";
import { analyzeIntent, analyzeIntentCsv, IntentAnalyzeInput, IntentAnalyzeResult } from "../services/api";

const scoreClass: Record<IntentAnalyzeResult["intent_score"], string> = {
  Low: "secondary",
  Medium: "warning",
  High: "success",
};

export default function UploadPage() {
  const [mode, setMode] = useState<"manual" | "csv">("manual");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<IntentAnalyzeResult[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<IntentAnalyzeInput>({
    job_title: "",
    job_description: "",
    company_name: "",
    historical_job_count: 0,
  });

  const onSubmitManual = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await analyzeIntent(form);
      setResults(response.results);
    } catch (submitError: any) {
      setError(submitError.message || "Failed to analyze input");
    } finally {
      setLoading(false);
    }
  };

  const onCsvUpload = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const response = await analyzeIntentCsv(file);
      setResults(response.results);
    } catch (uploadError: any) {
      setError(uploadError.message || "Failed to analyze CSV");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <Head>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
      </Head>
      <style jsx global>{`
        body { background: radial-gradient(circle at top, #1e293b, #020617); color: #e2e8f0; }
        .glass-card { background: rgba(255,255,255,0.08); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.18); border-radius: 18px; }
      `}</style>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 shadow-lg">
        <h2 className="mb-3">Hiring Intent Interpreter</h2>
        <div className="btn-group mb-3">
          <button className={`btn btn-${mode === "manual" ? "light" : "outline-light"}`} onClick={() => setMode("manual")}>Manual</button>
          <button className={`btn btn-${mode === "csv" ? "light" : "outline-light"}`} onClick={() => setMode("csv")}>CSV Upload</button>
        </div>

        {mode === "manual" ? (
          <form onSubmit={onSubmitManual}>
            <input className="form-control mb-2" placeholder="Company Name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            <input className="form-control mb-2" placeholder="Job Title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
            <textarea className="form-control mb-2" rows={6} placeholder="Job Description" value={form.job_description} onChange={(e) => setForm({ ...form, job_description: e.target.value })} />
            <input className="form-control mb-3" type="number" placeholder="Historical Job Count" value={form.historical_job_count} onChange={(e) => setForm({ ...form, historical_job_count: Number(e.target.value) })} />
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Analyzing..." : "Analyze Intent"}</button>
          </form>
        ) : (
          <div>
            <input className="form-control" type="file" accept=".csv" onChange={(e) => onCsvUpload(e.target.files?.[0])} />
          </div>
        )}

        {loading && <div className="progress mt-3"><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: "100%" }}>Processing</div></div>}
        {error && <div className="alert alert-danger mt-3">{error}</div>}
      </motion.div>

      {!!results.length && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card mt-4 p-4">
          <h4>Intent Results</h4>
          {results.map((item, idx) => (
            <div key={`${item.company_name}-${idx}`} className="border rounded p-3 mb-2">
              <div className="d-flex justify-content-between align-items-center">
                <strong>{item.company_name}</strong>
                <span className={`badge text-bg-${scoreClass[item.intent_score]}`}>{item.intent_score}</span>
              </div>
              <div>Type: {item.intent_type}</div>
              <div>Categories: {item.intent_categories.join(", ") || "None"}</div>
              <small>{item.reasoning}</small>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
