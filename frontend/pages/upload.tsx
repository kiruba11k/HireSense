import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import { motion } from "framer-motion";
import { IntentAnalyzeInput, IntentAnalyzeResult } from "../services/api";

type CsvRow = {
  company_name: string;
  job_title: string;
  job_description: string;
  historical_job_count: number;
};

declare global {
  interface Window {
    Chart?: any;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const emptyForm: IntentAnalyzeInput = {
  company_name: "",
  job_title: "",
  job_description: "",
  historical_job_count: 0,
};

const scoreClass: Record<IntentAnalyzeResult["intent_score"], string> = {
  Low: "score-low",
  Medium: "score-medium",
  High: "score-high",
};

const categoryColors: Record<string, string> = {
  ERP: "tag-erp",
  Cloud: "tag-cloud",
  Data: "tag-data",
  Security: "tag-security",
  QA: "tag-qa",
  AI: "tag-ai",
};

async function analyzeIntent(data: IntentAnalyzeInput): Promise<IntentAnalyzeResult> {
  const response = await fetch(`${API_BASE}/analyze-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.detail || "Unable to analyze intent.");
  return Array.isArray(payload?.results) ? payload.results[0] : payload;
}

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else insideQuotes = !insideQuotes;
    } else if (ch === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
    } else current += ch;
  }
  values.push(current.trim());
  return values;
};

const parseCsvContent = (content: string): CsvRow[] => {
  const rows = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return [];
  const headers = parseCsvLine(rows[0]).map((h) => h.toLowerCase());
  const required = ["company_name", "job_title", "job_description", "historical_job_count"];
  if (!required.every((field) => headers.includes(field))) {
    throw new Error("Invalid CSV format. Required columns: company_name, job_title, job_description, historical_job_count.");
  }

  const idx = {
    company_name: headers.indexOf("company_name"),
    job_title: headers.indexOf("job_title"),
    job_description: headers.indexOf("job_description"),
    historical_job_count: headers.indexOf("historical_job_count"),
  };

  return rows.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      company_name: cols[idx.company_name] || "",
      job_title: cols[idx.job_title] || "",
      job_description: cols[idx.job_description] || "",
      historical_job_count: Number(cols[idx.historical_job_count] || 0),
    };
  });
};

export default function UploadPage() {
  const backToDashboard = () => {
    window.location.href = "https://hiresense-frontend-on61.onrender.com/";
  };

  const [activeTab, setActiveTab] = useState<"manual" | "csv">("manual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState<IntentAnalyzeInput>(emptyForm);
  const [results, setResults] = useState<IntentAnalyzeResult[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);

  const manualValid = useMemo(
    () => Boolean(form.company_name.trim() && form.job_title.trim() && form.job_description.trim()),
    [form.company_name, form.job_title, form.job_description]
  );

  const scoreCounts = useMemo(
    () => results.reduce((acc, item) => {
      acc[item.intent_score] += 1;
      return acc;
    }, { High: 0, Medium: 0, Low: 0 }),
    [results]
  );

  useEffect(() => {
    if (!window.Chart || !chartRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    chartInstanceRef.current = new window.Chart(chartRef.current, {
      type: "bar",
      data: {
        labels: ["High", "Medium", "Low"],
        datasets: [{
          data: [scoreCounts.High, scoreCounts.Medium, scoreCounts.Low],
          backgroundColor: ["rgba(34,197,94,0.8)", "rgba(251,146,60,0.8)", "rgba(148,163,184,0.8)"],
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(148,163,184,0.15)" } },
          y: { ticks: { color: "#cbd5e1", precision: 0 }, grid: { color: "rgba(148,163,184,0.15)" } },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [scoreCounts.High, scoreCounts.Medium, scoreCounts.Low]);

  const resetAll = () => {
    setForm(emptyForm);
    setCsvRows([]);
    setResults([]);
    setError("");
    setSuccessMsg("");
    setFileName("");
  };

  const runManualAnalysis = async (event: FormEvent) => {
    event.preventDefault();
    if (!manualValid) return setError("⚠ Missing fields. Please complete all required manual input fields.");
    setLoading(true); setError(""); setSuccessMsg("");
    try { setResults([await analyzeIntent(form)]); }
    catch (err: any) { setError(`⚠ ${err?.message || "Unable to analyze intent. Please try again."}`); }
    finally { setLoading(false); }
  };

  const processCsvFile = async (file: File) => {
    const parsedRows = parseCsvContent(await file.text()).filter((row) => row.company_name && row.job_title && row.job_description);
    setCsvRows(parsedRows); setFileName(file.name);
    setSuccessMsg(`CSV loaded successfully. Rows detected: ${parsedRows.length}`);
    setError("");
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { await processCsvFile(file); }
    catch (err: any) { setError(`⚠ ${err?.message || "CSV invalid."}`); setSuccessMsg(""); setCsvRows([]); }
  };

  const runCsvAnalysis = async () => {
    if (!csvRows.length) return setError("⚠ Please upload a valid CSV before analysis.");
    setLoading(true); setError(""); setSuccessMsg("");
    try {
      const analyzed = await Promise.all(csvRows.map((row) => analyzeIntent({
        company_name: row.company_name,
        job_title: row.job_title,
        job_description: row.job_description,
        historical_job_count: row.historical_job_count,
      })));
      setResults(analyzed);
    } catch (err: any) { setError(`⚠ ${err?.message || "Unable to analyze intent. Please try again."}`); }
    finally { setLoading(false); }
  };

  return (
    <>
      <Head>
        <title>Hiring Intent Interpreter • HireSense</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js" strategy="afterInteractive" />

      <style jsx global>{`
        body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: Inter, system-ui, sans-serif; }
        .intent-shell { min-height: 100vh; padding: 2rem 0 3rem; position: relative; overflow: hidden; }
        .intent-shell::before { content: ""; position: absolute; inset: -20% -5% auto; height: 420px; background: radial-gradient(circle at 30% 40%, rgba(99,102,241,.45), rgba(6,182,212,.18), transparent 70%); animation: float-bg 9s ease-in-out infinite alternate; pointer-events: none; }
        @keyframes float-bg { from { transform: translateY(0) scale(1); } to { transform: translateY(14px) scale(1.05); } }
        .glass-card { background: rgba(255,255,255,.1); backdrop-filter: blur(12px); border: 1px solid rgba(148,163,184,.25); border-radius: 16px; box-shadow: 0 18px 40px rgba(15,23,42,.35); }
        .hero-title { font-size: clamp(2rem,3vw,3rem); font-weight: 700; margin-bottom: .6rem; }
        .btn-gradient { background: linear-gradient(90deg,#6366F1 0%,#06B6D4 100%); color: white; border: none; }
        .btn-gradient:hover { color: white; }
        .score-pill,.category-tag { border-radius: 999px; padding: .2rem .6rem; font-size: .76rem; font-weight: 600; display: inline-flex; margin-right: .35rem; margin-top: .35rem; }
        .score-low { background: rgba(107,114,128,.35); color: #e5e7eb; } .score-medium { background: rgba(249,115,22,.25); color: #fed7aa; } .score-high { background: rgba(34,197,94,.25); color: #bbf7d0; }
        .tag-erp { background: rgba(99,102,241,.25); } .tag-cloud { background: rgba(14,165,233,.25); } .tag-data { background: rgba(59,130,246,.25); }
        .tag-security { background: rgba(220,38,38,.25); } .tag-qa { background: rgba(249,115,22,.25); } .tag-ai { background: rgba(168,85,247,.25); }
        .drop-zone { border: 1.5px dashed rgba(148,163,184,.6); border-radius: 14px; padding: 2rem 1rem; text-align: center; background: rgba(15,23,42,.45); }
        .reason-box { margin-top: .55rem; background: rgba(15,23,42,.55); border: 1px solid rgba(148,163,184,.22); border-radius: 12px; padding: .75rem; color: #cbd5e1; font-size: .92rem; }
      `}</style>

      <main className="intent-shell">
        <div className="container position-relative" style={{ zIndex: 2 }}>
          <div className="mb-3">
            <button type="button" onClick={backToDashboard} className="btn btn-outline-light btn-sm">
              ← Back to Main Dashboard
            </button>
          </div>
          <motion.section className="glass-card p-4 p-md-5 mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="hero-title">Hiring Intent Interpreter</h1>
            <p className="mb-0 text-light-emphasis">Convert job postings into enterprise buying intent signals using AI.</p>
          </motion.section>

          <section className="glass-card p-3 p-md-4 mb-4">
            <ul className="nav nav-pills mb-3">
              <li className="nav-item"><button className={`nav-link ${activeTab === "manual" ? "active" : ""}`} onClick={() => setActiveTab("manual")} type="button">Manual Input</button></li>
              <li className="nav-item"><button className={`nav-link ${activeTab === "csv" ? "active" : ""}`} onClick={() => setActiveTab("csv")} type="button">CSV Upload</button></li>
            </ul>

            {activeTab === "manual" ? (
              <form onSubmit={runManualAnalysis} className="row g-3">
                <div className="col-md-6"><label className="form-label">Company Name</label><input className="form-control" value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} /></div>
                <div className="col-md-6"><label className="form-label">Job Title</label><input className="form-control" value={form.job_title} onChange={(e) => setForm((p) => ({ ...p, job_title: e.target.value }))} /></div>
                <div className="col-12"><label className="form-label">Job Description</label><textarea className="form-control" rows={6} value={form.job_description} onChange={(e) => setForm((p) => ({ ...p, job_description: e.target.value }))} /></div>
                <div className="col-md-4"><label className="form-label">Historical Job Count</label><input type="number" min={0} className="form-control" value={form.historical_job_count} onChange={(e) => setForm((p) => ({ ...p, historical_job_count: Number(e.target.value || 0) }))} /></div>
                <div className="col-12 d-flex gap-2 pt-1"><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn btn-gradient" type="submit" disabled={loading}>Analyze Intent</motion.button><button type="button" className="btn btn-outline-light" onClick={resetAll}>Reset</button></div>
              </form>
            ) : (
              <div>
                <div className="drop-zone mb-3" onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) processCsvFile(file).catch((err: any) => setError(`⚠ ${err?.message || "CSV invalid."}`)); }} onDragOver={(e) => e.preventDefault()}>
                  <p className="mb-2">Drag and drop CSV here</p><p className="text-secondary mb-2">or</p><input type="file" accept=".csv" onChange={onFileChange} className="form-control" />
                </div>
                {!!fileName && <p className="small text-info mb-2">Loaded file: {fileName}</p>}
                <p className="small text-light-emphasis">Required columns: company_name, job_title, job_description, historical_job_count</p>
                <button type="button" className="btn btn-gradient" onClick={runCsvAnalysis} disabled={loading || !csvRows.length}>Upload & Analyze</button>
                {!!csvRows.length && <div className="table-responsive mt-3"><table className="table table-dark table-striped"><thead><tr><th>Company</th><th>Job Title</th><th>Historical Count</th></tr></thead><tbody>{csvRows.slice(0, 10).map((row, i) => <tr key={`${row.company_name}-${i}`}><td>{row.company_name}</td><td>{row.job_title}</td><td>{row.historical_job_count}</td></tr>)}</tbody></table></div>}
              </div>
            )}

            {successMsg && <div className="alert alert-success mt-3 mb-0">{successMsg}</div>}
            {error && <div className="alert alert-warning mt-3 mb-0">{error}</div>}
            {loading && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 d-flex align-items-center gap-2"><div className="spinner-border spinner-border-sm text-info" /><span>Analyzing hiring intent...</span></motion.div>}
          </section>

          {!!results.length && <section className="row g-3">
            <div className="col-12"><div className="glass-card p-3 p-md-4"><h5 className="mb-3">Intent Score Chart</h5><canvas ref={chartRef} height={120} /></div></div>
            {results.map((item, idx) => <div key={`${item.company_name}-${idx}`} className="col-12 col-md-6 col-xl-4"><motion.article className="glass-card p-3 h-100" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: idx * .05 }} whileHover={{ y: -4 }}><div className="d-flex justify-content-between gap-2"><h6 className="mb-1">{item.company_name}</h6><span className={`score-pill ${scoreClass[item.intent_score]}`}>{item.intent_score}</span></div><p className="mb-1 small text-info">Intent Type: {item.intent_type}</p><div className="mb-2">{(item.intent_categories.length ? item.intent_categories : ["Unknown"]).map((category) => <span key={category} className={`category-tag ${categoryColors[category] || "tag-erp"}`}>{category}</span>)}</div><div className="reason-box"><strong>Reasoning:</strong> {item.reasoning}</div></motion.article></div>)}
            <div className="col-12"><div className="glass-card p-3 table-responsive"><h5 className="mb-3">Batch Result Table</h5><table className="table table-dark table-hover mb-0"><thead><tr><th>Company</th><th>Categories</th><th>Type</th><th>Score</th></tr></thead><tbody>{results.map((item, i) => <tr key={`${item.company_name}-result-${i}`}><td>{item.company_name}</td><td>{item.intent_categories.join(", ") || "Unknown"}</td><td>{item.intent_type}</td><td>{item.intent_score}</td></tr>)}</tbody></table></div></div>
          </section>}
        </div>
      </main>
    </>
  );
}
