import { useState } from "react";
import Sidebar from "../components/Sidebar";
import JobCard from "../components/JobCard";
import ScoreCard from "../components/ScoreCard";
import { startPipeline } from "../services/api";
import { connectWS } from "../services/websocket";
import { exportCSV, exportPDF } from "../services/export";

export default function Home() {
  const [tab, setTab] = useState("overview");
  const [company, setCompany] = useState("");
  const [jobs, setJobs] = useState([]);
  const [tech, setTech] = useState([]);
  const [news, setNews] = useState([]);
  const [score, setScore] = useState(null);

  const run = async () => {
    const res = await startPipeline(company);

    connectWS(res.task_id, (msg) => {
      if (msg.type === "intent") {
        setJobs((prev) => [...prev, msg.data]);
      }
      if (msg.type === "tech") setTech(msg.data);
      if (msg.type === "news") setNews(msg.data);
      if (msg.type === "done") setScore(msg.data.score);
    });
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen text-white">
      <Sidebar setTab={setTab} />

      <div className="flex-1 p-6">
        {/* INPUT */}
        <div className="flex gap-4 mb-6">
          <input
            className="p-3 bg-black/40 rounded w-full md:w-1/2"
            placeholder="Enter Company URL"
            onChange={(e) => setCompany(e.target.value)}
          />
          <button
            onClick={run}
            className="bg-purple-600 px-6 py-3 rounded"
          >
            Run
          </button>
        </div>

        {/* EXPORT */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => exportCSV(jobs)}
            className="bg-green-600 px-4 py-2 rounded"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportPDF(jobs)}
            className="bg-red-600 px-4 py-2 rounded"
          >
            Export PDF
          </button>
        </div>

        {/* TABS */}
        {tab === "jobs" && (
          <div className="grid md:grid-cols-2 gap-4">
            {jobs.map((j, i) => (
              <JobCard key={i} job={j} />
            ))}
          </div>
        )}

        {tab === "tech" && (
          <div>{JSON.stringify(tech)}</div>
        )}

        {tab === "news" && (
          <div>{JSON.stringify(news)}</div>
        )}

        {tab === "score" && <ScoreCard score={score} />}
      </div>
    </div>
  );
}
