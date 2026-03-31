import Head from "next/head";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import CSVUploader, { CsvRow } from "../components/CSVUploader";
import IntentForm, { ManualIntentInput } from "../components/IntentForm";
import LoadingSpinner from "../components/LoadingSpinner";
import ResultCard, { IntentResult } from "../components/ResultCard";
import { analyzeIntent } from "../services/api";

declare global {
  interface Window {
    Chart?: any;
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"manual" | "csv">("manual");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<IntentResult[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState<string>("");
  const chartRef = useRef<HTMLCanvasElement | null>(null);

  const scoreCounts = useMemo(() => {
    const summary = { High: 0, Medium: 0, Low: 0 };
    results.forEach((result) => {
      if (result.intent_score === "High" || result.intent_score === "Medium" || result.intent_score === "Low") {
        summary[result.intent_score] += 1;
      }
    });
    return summary;
  }, [results]);

  useEffect(() => {
    if (!window.Chart || !chartRef.current || results.length === 0) return;

    const chart = new window.Chart(chartRef.current, {
      type: "bar",
      data: {
        labels: ["High", "Medium", "Low"],
        datasets: [
          {
            label: "Intent Scores",
            data: [scoreCounts.High, scoreCounts.Medium, scoreCounts.Low],
            backgroundColor: ["#22C55E", "#F59E0B", "#9CA3AF"],
            borderRadius: 12,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#E2E8F0" }, grid: { color: "rgba(148,163,184,0.2)" } },
          y: { ticks: { color: "#E2E8F0", precision: 0 }, grid: { color: "rgba(148,163,184,0.2)" } },
        },
      },
    });

    return () => chart.destroy();
  }, [results, scoreCounts]);

  const validateInput = (payload: ManualIntentInput) => {
    if (!payload.company_name || !payload.job_title || !payload.job_description) {
      throw new Error("Missing fields. Please complete all required fields.");
    }
  };

  const handleManualAnalyze = async (payload: ManualIntentInput) => {
    setError("");
    setLoading(true);
    try {
      validateInput(payload);
      const response = await analyzeIntent(payload);
      setResults([response]);
    } catch (err) {
      setError(err instanceof Error ? `⚠ ${err.message}` : "⚠ Unable to analyze intent. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCsvAnalyze = async () => {
    if (!csvRows.length) {
      setError("⚠ CSV invalid or empty.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const batchResults = await Promise.all(
        csvRows.map((row) =>
          analyzeIntent({
            company_name: row.company_name,
            job_title: row.job_title,
            job_description: row.job_description,
            historical_job_count: row.historical_job_count,
          })
        )
      );
      setResults(batchResults);
    } catch {
      setError("⚠ Unable to analyze intent. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Hiring Intent Interpreter</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="afterInteractive" />

      <main className="app-shell py-5">
        <div className="animated-gradient" />
        <div className="container position-relative">
          <motion.section
            className="text-center mb-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="display-5 fw-bold text-white">Hiring Intent Interpreter</h1>
            <p className="text-white-50 fs-5">
              Convert job postings into enterprise buying intent signals using AI.
            </p>
          </motion.section>

          <section className="glass-card p-3 p-md-4 mb-4">
            <ul className="nav nav-pills mb-3 gap-2">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "manual" ? "active" : ""}`}
                  onClick={() => setActiveTab("manual")}
                  type="button"
                >
                  Manual Input
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "csv" ? "active" : ""}`}
                  onClick={() => setActiveTab("csv")}
                  type="button"
                >
                  CSV Upload
                </button>
              </li>
            </ul>

            {activeTab === "manual" ? (
              <IntentForm onSubmit={handleManualAnalyze} loading={loading} />
            ) : (
              <>
                <CSVUploader onDataReady={setCsvRows} loading={loading} />
                <div className="mt-3">
                  <button className="btn btn-primary btn-animated" onClick={handleCsvAnalyze} disabled={loading || !csvRows.length}>
                    Analyze CSV Batch
                  </button>
                </div>
              </>
            )}
          </section>

          {error && <div className="alert alert-warning">{error}</div>}
          {loading && <LoadingSpinner />}

          {results.length > 0 && (
            <section className="mt-4">
              <div className="glass-card p-4 mb-4">
                <h4 className="text-white mb-3">Intent Score Chart</h4>
                <canvas ref={chartRef} aria-label="Intent score chart" />
              </div>

              <div className="row g-3">
                {results.map((result, index) => (
                  <div className="col-12 col-md-6 col-xl-4" key={`${result.company_name}-${index}`}>
                    <ResultCard result={result} index={index} />
                  </div>
                ))}
              </div>

              {activeTab === "csv" && (
                <div className="glass-card p-4 mt-4">
                  <h5 className="text-white">Batch Result Table</h5>
                  <div className="table-responsive">
                    <table className="table table-dark table-striped align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Company Name</th>
                          <th>Intent Type</th>
                          <th>Intent Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((result, index) => (
                          <tr key={`${result.company_name}-row-${index}`}>
                            <td>{result.company_name}</td>
                            <td>{result.intent_type}</td>
                            <td>{result.intent_score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <style jsx global>{`
        body {
          background: #0f172a;
          color: #fff;
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        }

        .app-shell {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
        }

        .animated-gradient {
          position: absolute;
          inset: -20%;
          background: radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.35), transparent 45%),
            radial-gradient(circle at 80% 0%, rgba(6, 182, 212, 0.3), transparent 40%),
            radial-gradient(circle at 50% 100%, rgba(139, 92, 246, 0.25), transparent 45%);
          animation: pulse 10s ease-in-out infinite alternate;
          z-index: 0;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
          transition: all 0.25s ease;
        }

        .glass-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 40px rgba(15, 23, 42, 0.35);
        }

        .glass-input {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .glass-input:focus {
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          border-color: #06b6d4;
          box-shadow: 0 0 0 0.2rem rgba(6, 182, 212, 0.2);
        }

        .upload-zone {
          border: 2px dashed rgba(255, 255, 255, 0.3);
          border-radius: 14px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
        }

        .upload-zone:hover {
          border-color: #06b6d4;
          background: rgba(6, 182, 212, 0.08);
        }

        .btn-primary,
        .nav-pills .nav-link.active {
          background-color: #6366f1 !important;
          border-color: #6366f1 !important;
        }

        .btn-animated {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .btn-animated:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
        }

        .reasoning-box {
          background: rgba(15, 23, 42, 0.35);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          padding: 0.85rem;
        }

        .dot-flash {
          display: inline-block;
          width: 1.2em;
          animation: dots 1.2s steps(4, end) infinite;
          overflow: hidden;
          vertical-align: bottom;
        }

        @keyframes dots {
          0% {
            width: 0;
          }
          100% {
            width: 1.2em;
          }
        }

        @keyframes pulse {
          from {
            transform: scale(1);
          }
          to {
            transform: scale(1.05);
          }
        }
      `}</style>
    </>
  );
}
