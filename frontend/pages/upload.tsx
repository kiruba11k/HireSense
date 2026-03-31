import { FormEvent, useMemo, useState } from "react";
import Head from "next/head";
import { motion } from "framer-motion";
import { analyzeIntent, analyzeIntentCsv, IntentAnalyzeInput, IntentAnalyzeResult } from "../services/api";

const scoreClass: Record<IntentAnalyzeResult["intent_score"], string> = {
  Low: "score-low",
  Medium: "score-medium",
  High: "score-high",
};

const categoryBadgeClass: Record<string, string> = {
  ERP: "category-erp",
  Cloud: "category-cloud",
  Data: "category-data",
  Security: "category-security",
  QA: "category-qa",
  AI: "category-ai",
};

const emptyForm: IntentAnalyzeInput = {
  job_title: "",
  job_description: "",
  company_name: "",
  historical_job_count: 0,
};

export default function UploadPage() {
  const [mode, setMode] = useState<"manual" | "csv">("manual");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<IntentAnalyzeResult[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<IntentAnalyzeInput>(emptyForm);

  const canSubmit = useMemo(
    () => Boolean(form.company_name.trim() && form.job_description.trim()),
    [form.company_name, form.job_description]
  );

  const onSubmitManual = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

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
    <>
      <Head>
        <title>Hiring Intent Interpreter • HireSense</title>
      </Head>

      <style jsx global>{`
        :root {
          --bg-1: #090e1f;
          --bg-2: #131f38;
          --text: #dbe5ff;
          --muted: #94a3b8;
          --card: rgba(15, 23, 42, 0.78);
          --card-border: rgba(148, 163, 184, 0.24);
        }

        body {
          margin: 0;
          min-height: 100vh;
          color: var(--text);
          background: radial-gradient(circle at top left, var(--bg-2), var(--bg-1));
          font-family: Inter, system-ui, -apple-system, sans-serif;
        }

        .intent-page {
          max-width: 1120px;
          margin: 0 auto;
          padding: 2.5rem 1rem 4rem;
        }

        .panel {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 18px;
          padding: 1.2rem;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(8px);
        }

        .heading {
          font-size: 1.9rem;
          font-weight: 700;
          margin: 0;
        }

        .helper {
          color: var(--muted);
          margin-top: 0.35rem;
          line-height: 1.5;
        }

        .grid {
          margin-top: 1.2rem;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.2rem;
        }

        .segment {
          display: inline-flex;
          background: rgba(30, 41, 59, 0.8);
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          padding: 0.2rem;
          gap: 0.25rem;
          margin: 0.8rem 0;
        }

        .segment button {
          border: none;
          border-radius: 999px;
          color: #dbe5ff;
          background: transparent;
          padding: 0.48rem 1rem;
          cursor: pointer;
        }

        .segment button.active {
          color: #0f172a;
          background: #60a5fa;
          font-weight: 600;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: rgba(15, 23, 42, 0.62);
          color: #f8fafc;
          border-radius: 12px;
          padding: 0.72rem 0.8rem;
          margin-bottom: 0.65rem;
        }

        .btn-primary {
          border: none;
          border-radius: 12px;
          background: linear-gradient(90deg, #38bdf8, #22c55e);
          color: #020617;
          font-weight: 700;
          padding: 0.68rem 1.15rem;
          cursor: pointer;
        }

        .btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .error {
          margin-top: 0.8rem;
          color: #fca5a5;
        }

        .result-card {
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 14px;
          padding: 1rem;
          margin-bottom: 0.85rem;
          background: rgba(15, 23, 42, 0.45);
        }

        .result-top {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .score-pill,
        .category-pill {
          border-radius: 999px;
          padding: 0.2rem 0.6rem;
          font-size: 0.76rem;
          font-weight: 700;
        }

        .score-low { background: rgba(148, 163, 184, 0.25); }
        .score-medium { background: rgba(250, 204, 21, 0.24); color: #fde68a; }
        .score-high { background: rgba(34, 197, 94, 0.24); color: #86efac; }

        .category-erp, .category-cloud, .category-data, .category-security, .category-qa, .category-ai {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(96, 165, 250, 0.3);
        }

        .category-row {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          margin: 0.5rem 0;
        }

        @media (max-width: 940px) {
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <main className="intent-page">
        <motion.section className="panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="heading">Hiring Intent Interpreter</h1>
          <p className="helper">
            Convert job data into buying intent signals with strict evidence grounding. Input fields: <strong>job_title</strong>, <strong>job_description</strong>, <strong>company_name</strong>, and <strong>historical_job_count</strong>.
          </p>

          <div className="segment">
            <button className={mode === "manual" ? "active" : ""} onClick={() => setMode("manual")}>Manual Input</button>
            <button className={mode === "csv" ? "active" : ""} onClick={() => setMode("csv")}>CSV Upload</button>
          </div>

          {mode === "manual" ? (
            <form onSubmit={onSubmitManual}>
              <input
                placeholder="Company Name"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
              <input
                placeholder="Job Title"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              />
              <textarea
                rows={8}
                placeholder="Job Description"
                value={form.job_description}
                onChange={(e) => setForm({ ...form, job_description: e.target.value })}
              />
              <input
                type="number"
                min={0}
                placeholder="Historical Job Count"
                value={form.historical_job_count}
                onChange={(e) => setForm({ ...form, historical_job_count: Number(e.target.value) })}
              />

              <button type="submit" className="btn-primary" disabled={loading || !canSubmit}>
                {loading ? "Analyzing..." : "Run Intent Analysis"}
              </button>
            </form>
          ) : (
            <div>
              <input type="file" accept=".csv" onChange={(e) => onCsvUpload(e.target.files?.[0])} />
              <p className="helper">CSV must contain: job_title, job_description, company_name, historical_job_count.</p>
            </div>
          )}

          {error && <p className="error">{error}</p>}
        </motion.section>

        <section className="grid">
          <div className="panel">
            <h3>Processing Rules</h3>
            <ul className="helper">
              <li>Classify categories: ERP, Cloud, Data, Security, QA, AI.</li>
              <li>Infer intent type: Implementation, Migration, Optimization.</li>
              <li>Assign intent strength via intent_score: Low / Medium / High.</li>
              <li>Ignore generic hiring posts without solution signals.</li>
              <li>Boost signal for repeated roles using historical_job_count.</li>
            </ul>
          </div>

          <div className="panel">
            <h3>Output Schema</h3>
            <ul className="helper">
              <li>company_name</li>
              <li>intent_categories (list)</li>
              <li>intent_type</li>
              <li>intent_score</li>
              <li>reasoning (evidence-based from job description)</li>
            </ul>
          </div>
        </section>

        {!!results.length && (
          <motion.section className="panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: "1.2rem" }}>
            <h3>Intent Results</h3>
            {results.map((item, idx) => (
              <article key={`${item.company_name}-${idx}`} className="result-card">
                <div className="result-top">
                  <strong>{item.company_name}</strong>
                  <span className={`score-pill ${scoreClass[item.intent_score]}`}>{item.intent_score}</span>
                </div>
                <div className="helper" style={{ marginTop: "0.45rem" }}>Intent Type: <strong>{item.intent_type}</strong></div>
                <div className="category-row">
                  {(item.intent_categories.length ? item.intent_categories : ["None"]).map((category) => (
                    <span key={category} className={`category-pill ${categoryBadgeClass[category] || "category-erp"}`}>
                      {category}
                    </span>
                  ))}
                </div>
                <p className="helper" style={{ marginBottom: 0 }}><strong>Reasoning:</strong> {item.reasoning}</p>
              </article>
            ))}
          </motion.section>
        )}
      </main>
    </>
  );
}
