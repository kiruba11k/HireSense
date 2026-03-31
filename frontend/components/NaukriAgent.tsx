import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import SearchForm from "./SearchForm";
import ResultsTable from "./ResultsTable";
import StatusTracker from "./StatusTracker";
import { downloadNaukriCsv, getNaukriResults, getNaukriStatus, NaukriRunPayload, runNaukriAgent } from "../services/api";

type Row = {
  job_id: string;
  job_title: string;
  company_name: string;
  location?: string;
  experience_range?: string;
  posted_date?: string;
  key_skills?: string[];
  source: string;
};

export default function NaukriAgent() {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Ready to scrape Naukri.");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (status === "running") {
      timer = setInterval(async () => {
        const s = await getNaukriStatus();
        setStatus(s.status);
        setMessage(s.message || "Running");
        if (s.status === "completed") {
          const data = await getNaukriResults();
          setRows(data.rows || []);
        }
      }, 3000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status]);

  const run = async (payload: NaukriRunPayload) => {
    try {
      setRows([]);
      setStatus("running");
      setMessage("Starting Naukri pipeline");
      await runNaukriAgent(payload);
    } catch (error: any) {
      setStatus("error");
      setMessage(error?.message?.includes("blocked") ? "Naukri temporarily blocked scraping" : "Failed to run Naukri agent");
    }
  };

  const onDownload = async () => {
    const blob = await downloadNaukriCsv();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "naukri-jobs.csv";
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="container py-4"
      style={{ color: "#e2e8f0" }}
    >
      <div className="rounded-4 p-4" style={{ background: "linear-gradient(130deg, rgba(108,99,255,.25), rgba(0,229,255,.15)), #0F172A", border: "1px solid rgba(0,229,255,.3)", backdropFilter: "blur(14px)", transformStyle: "preserve-3d" }}>
        <h3 className="mb-3">Naukri Job Scraper</h3>
        <SearchForm onRun={run} loading={status === "running"} />
        <div className="mt-3">
          <StatusTracker status={status} message={message} />
        </div>
        <ResultsTable rows={rows} />
        <div className="d-flex justify-content-end">
          <button className="btn btn-outline-info" onClick={onDownload} disabled={!rows.length}>Download CSV</button>
        </div>
      </div>
    </motion.section>
  );
}
