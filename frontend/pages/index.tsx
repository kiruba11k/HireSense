import Head from "next/head";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "../lib/framer-motion";
import CSVUploader from "../components/CSVUploader";
import IntentForm, { ManualIntentInput } from "../components/IntentForm";
import LoadingSpinner from "../components/LoadingSpinner";
import ResultCard from "../components/ResultCard";
import { analyzeIntent, IntentAnalyzeResult } from "../services/api";

declare global {
  interface Window {
    Chart?: any;
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"manual" | "csv">("manual");
  const [results, setResults] = useState<IntentAnalyzeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chartRef = useRef<HTMLCanvasElement | null>(null);

  const scoreCounts = useMemo(() => {
    const output = { High: 0, Medium: 0, Low: 0 };
    results.forEach((item) => {
      if (item.intent_score in output) {
        output[item.intent_score as keyof typeof output] += 1;
      }
    });
    return output;
  }, [results]);

  useEffect(() => {
    if (!window.Chart || !chartRef.current) return;

    const chart = new window.Chart(chartRef.current, {
      type: "bar",
      data: {
        labels: ["High", "Medium", "Low"],
        datasets: [
          {
            label: "Intent Scores",
            data: [scoreCounts.High, scoreCounts.Medium, scoreCounts.Low],
            backgroundColor: ["#22c55e", "#f59e0b", "#64748b"],
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(148,163,184,0.15)" } },
          y: { ticks: { color: "#cbd5e1", stepSize: 1 }, grid: { color: "rgba(148,163,184,0.15)" } },
        },
      },
    });

    return () => chart.destroy();
  }, [scoreCounts]);

  const analyzeSingle = async (payload: ManualIntentInput) => {
    setError("");
    if (!payload.company_name || !payload.job_title || !payload.job_description) {
      setError("⚠ Missing fields. Please complete all required inputs.");
      return;
    }

    setLoading(true);
    try {
      const response = await analyzeIntent(payload);
      setResults(response.results || []);
    } catch {
      setError("⚠ Unable to analyze intent. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const analyzeBatch = async (rows: ManualIntentInput[]) => {
    setError("");
    setLoading(true);
    try {
      const output = await Promise.all(rows.map((row) => analyzeIntent(row)));
      setResults(output.flatMap((item) => item.results || []));
    } catch {
      setError("⚠ Unable to analyze intent. Please verify your CSV and retry.");
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
      <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js" strategy="afterInteractive" />

      <main className="app-bg text-light min-vh-100">
        <section className="hero position-relative overflow-hidden">
          <div className="gradient-orb gradient-one" />
          <div className="gradient-orb gradient-two" />
          <div className="container py-5 position-relative">
            <motion.h1
              className="display-5 fw-bold"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Hiring Intent Interpreter
            </motion.h1>
            <motion.p
              className="lead text-info mb-0"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Convert job postings into enterprise buying intent signals using AI.
            </motion.p>
          </div>
        </section>

        <section className="container pb-5">
          <div className="glass-card p-3 mb-4">
            <ul className="nav nav-pills gap-2">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "manual" ? "active" : ""}`}
                  onClick={() => setActiveTab("manual")}
                >
                  Manual Input
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "csv" ? "active" : ""}`}
                  onClick={() => setActiveTab("csv")}
                >
                  CSV Upload
                </button>
              </li>
            </ul>
          </div>

          {activeTab === "manual" ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <IntentForm onAnalyze={analyzeSingle} disabled={loading} />
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <CSVUploader onUpload={analyzeBatch} disabled={loading} />
            </motion.div>
          )}

          {error && <div className="alert alert-warning mt-3">{error}</div>}

          <div className="mt-4">{loading && <LoadingSpinner />}</div>

          {!!results.length && (
            <>
              <div className="glass-card p-4 mt-4 mb-4">
                <h5 className="mb-3">Intent Score Chart</h5>
                <canvas ref={chartRef} height={120} />
              </div>

              <div className="row g-3">
                {results.map((result, idx) => (
                  <div className="col-12 col-md-6 col-xl-4" key={`${result.company_name}-${idx}`}>
                    <ResultCard result={result} />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <style jsx>{`
        .app-bg {
          background: #0f172a;
        }
        .hero {
          min-height: 240px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        }
        .gradient-orb {
          position: absolute;
          width: 340px;
          height: 340px;
          filter: blur(60px);
          opacity: 0.45;
          border-radius: 999px;
          animation: float 6s ease-in-out infinite;
        }
        .gradient-one {
          background: #6366f1;
          top: -100px;
          left: -60px;
        }
        .gradient-two {
          background: #06b6d4;
          right: -80px;
          top: -70px;
          animation-delay: 1.5s;
        }
        :global(.glass-card) {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          box-shadow: 0 15px 40px rgba(2, 6, 23, 0.24);
        }
        :global(.hover-up),
        :global(.glass-card) {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        :global(.hover-up:hover),
        :global(.glass-card:hover) {
          transform: translateY(-3px);
          box-shadow: 0 20px 45px rgba(2, 6, 23, 0.35);
        }
        :global(.form-control) {
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        :global(.form-control:focus) {
          background: rgba(255, 255, 255, 0.09);
          color: #fff;
          border-color: #6366f1;
          box-shadow: 0 0 0 0.2rem rgba(99, 102, 241, 0.2);
        }
        :global(.nav-pills .nav-link) {
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.08);
        }
        :global(.nav-pills .nav-link.active) {
          background: linear-gradient(135deg, #6366f1, #06b6d4);
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(12px);
          }
        }
      `}</style>
    </>
  );
}
