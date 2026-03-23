import { useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import JobCard from "../components/JobCard";
import ScoreCard from "../components/ScoreCard";
import { startPipeline } from "../services/api";
import { connectWS } from "../services/websocket";
import { exportCSV, exportPDF } from "../services/export";

type Job = {
  title?: string;
  company?: string;
  description?: string;
  location?: string;
  source?: string;
  intent?: string;
};

export default function Home() {
  const [tab, setTab] = useState("overview");
  const [company, setCompany] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tech, setTech] = useState<any>(null);
  const [news, setNews] = useState<any>(null);
  const [tenders, setTenders] = useState<any>(null);
  const [filings, setFilings] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!company) return;

    setRunning(true);
    setJobs([]);
    setTech(null);
    setNews(null);
    setTenders(null);
    setFilings(null);
    setScore(null);

    const res = await startPipeline(company);

    connectWS(res.task_id, (msg: any) => {
      if (msg.type === "jobs") {
        setJobs(msg.data || []);
      }
      if (msg.type === "intent") {
        setJobs((prev) => prev.map((j) => (j.title === msg.data.title && j.company === msg.data.company ? msg.data : j)));
      }
      if (msg.type === "tech") setTech(msg.data);
      if (msg.type === "news") setNews(msg.data);
      if (msg.type === "tenders") setTenders(msg.data);
      if (msg.type === "filings") setFilings(msg.data);
      if (msg.type === "done") {
        setScore(msg.data.score);
        setRunning(false);
      }
    });
  };

  const strategy = useMemo(
    () => [
      "Parallel: jobs (LinkedIn + Google), news, tenders, filings",
      "Sequential: intent ← jobs",
      "Sequential: tech ← jobs + website",
      "Sequential: aggregator ← all agent outputs",
    ],
    []
  );

  return (
    <div className="page-shell">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <Sidebar setTab={setTab} />

      <div className="content">
        <div className="glass-card input-row">
          <input
            className="input"
            placeholder="Enter Company URL"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <button onClick={run} className="cta" disabled={running}>
            {running ? "Running..." : "Run"}
          </button>
        </div>

        <div className="glass-card export-row">
          <button onClick={() => exportCSV(jobs)} className="action green">
            Export CSV
          </button>
          <button onClick={() => exportPDF(jobs)} className="action red">
            Export PDF
          </button>
        </div>

        {tab === "overview" && (
          <div className="glass-card tilt-card">
            <h2>Execution Strategy</h2>
            <ul>
              {strategy.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {tab === "jobs" && (
          <div className="grid">
            {jobs.map((j, i) => (
              <JobCard key={`${j.title}-${i}`} job={j} />
            ))}
          </div>
        )}

        {tab === "tech" && <div className="glass-card">{typeof tech === "string" ? tech : JSON.stringify(tech, null, 2)}</div>}
        {tab === "news" && <div className="glass-card">{JSON.stringify(news, null, 2)}</div>}
        {tab === "score" && <ScoreCard score={score} />}
        {tab === "signals" && <div className="glass-card">{JSON.stringify({ tenders, filings }, null, 2)}</div>}
      </div>

      <style jsx>{`
        .page-shell {
          min-height: 100vh;
          color: white;
          background: radial-gradient(circle at 15% 20%, #1f1148, #090413 55%);
          display: flex;
          overflow: hidden;
          position: relative;
        }
        .content {
          flex: 1;
          padding: 24px;
          display: grid;
          gap: 16px;
          position: relative;
          z-index: 1;
          perspective: 1000px;
        }
        .glass-card {
          background: rgba(15, 15, 20, 0.58);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 16px;
          backdrop-filter: blur(10px);
          transition: transform 280ms ease, box-shadow 280ms ease;
        }
        .glass-card:hover {
          transform: translateY(-2px) rotateX(2deg);
          box-shadow: 0 18px 40px rgba(109, 77, 255, 0.28);
        }
        .tilt-card {
          transform-style: preserve-3d;
          animation: floatY 4s ease-in-out infinite;
        }
        .input-row,
        .export-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .input {
          flex: 1;
          min-width: 280px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(6, 6, 8, 0.62);
          color: #fff;
        }
        .cta,
        .action {
          padding: 10px 16px;
          border-radius: 12px;
          border: none;
          color: #fff;
          cursor: pointer;
          transform: translateZ(0);
          transition: transform 220ms ease, filter 220ms ease;
        }
        .cta:hover,
        .action:hover {
          transform: translateY(-1px) scale(1.03);
          filter: brightness(1.1);
        }
        .cta {
          background: linear-gradient(120deg, #6d4dff, #8c35de);
        }
        .green {
          background: #15803d;
        }
        .red {
          background: #b91c1c;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }
        .orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(18px);
          opacity: 0.4;
          animation: drift 16s ease-in-out infinite;
          z-index: 0;
        }
        .orb-one {
          width: 260px;
          height: 260px;
          background: #6d4dff;
          top: -30px;
          left: 28%;
        }
        .orb-two {
          width: 280px;
          height: 280px;
          background: #0ea5e9;
          bottom: -70px;
          right: 6%;
          animation-delay: 4s;
        }
        @keyframes drift {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(24px, -20px, 0); }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
