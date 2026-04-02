import { useState } from "react";
import { motion } from "framer-motion";

import SearchForm from "./SearchForm";
import ResultsTable from "./ResultsTable";
import StatusTracker from "./StatusTracker";
import { NaukriRunPayload, runNaukriAgent } from "../services/api";

type Row = {
  [key: string]: unknown;
};

export default function NaukriAgent() {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Ready to scrape Naukri.");
  const [rows, setRows] = useState<Row[]>([]);

  const run = async (payload: NaukriRunPayload) => {
    try {
      setRows([]);
      setStatus("running");
      setMessage("Starting Naukri pipeline");
      const response = await runNaukriAgent(payload);
      setRows(response.rows || []);
      setStatus("completed");
      setMessage(`Completed. ${response.count || 0} jobs found.`);
    } catch (error: any) {
      const partialRows = Array.isArray(error?.rows) ? error.rows : [];
      if (partialRows.length) {
        setRows(partialRows);
        setStatus("completed");
        setMessage(`Run stopped early. Partial results available (${partialRows.length} jobs).`);
        return;
      }
      setStatus("error");
      setMessage(error?.message?.includes("blocked") ? "Naukri temporarily blocked scraping" : (error?.message || "Naukri run failed"));
    }
  };

  const onDownload = async () => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escapeCsv = (value: unknown) => {
      const stringValue = Array.isArray(value) ? value.join(", ") : value ?? "";
      const serialized = String(stringValue).replace(/"/g, '""');
      return `"${serialized}"`;
    };
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
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
