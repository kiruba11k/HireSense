import { useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { motion } from "../lib/framer-motion";
import { Stage2RunPayload, startPipeline } from "../services/api";
import { connectWS } from "../services/websocket";

const DEFAULT_KEYWORDS = ["ERP", "SAP", "Cloud", "QA", "Data", "AI"];
const DEFAULT_FUNCTION_FILTERS = ["ERP", "Cloud", "Data", "QA", "AI"];
const ALL_FUNCTION_FILTERS = [
  "ERP",
  "Cloud",
  "Data",
  "QA",
  "AI",
  "Finance",
  "Operations",
  "Procurement",
  "Digital Transformation",
  "Sales",
  "Engineering",
  "Analytics",
];
const SENIORITY_OPTIONS = ["Entry Level", "Mid Level", "Senior Level", "Manager", "Director+"];
const EMPLOYMENT_TYPES = ["Full Time", "Contract", "Internship", "Part Time", "Temporary"];
const WORK_MODES = ["On-site", "Hybrid", "Remote"];

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const cardAnimation = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28 },
};

export default function NaukriPage() {
  const router = useRouter();
  const socketRef = useRef<WebSocket | null>(null);

  const [companyName, setCompanyName] = useState("stripe.com");
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS.join(", "));
  const [experienceLevel, setExperienceLevel] = useState("5-10 years");
  const [locations, setLocations] = useState("Bengaluru, Pune");
  const [companyList, setCompanyList] = useState("");
  const [timeFilter, setTimeFilter] = useState<"24h" | "7d" | "30d">("7d");
  const [seniorityFilter, setSeniorityFilter] = useState<string[]>(["Mid Level"]);
  const [functionFilter, setFunctionFilter] = useState<string[]>(DEFAULT_FUNCTION_FILTERS);
  const [employmentTypes, setEmploymentTypes] = useState<string[]>(["Full Time"]);
  const [workModes, setWorkModes] = useState<string[]>(["Hybrid", "On-site"]);
  const [historicalWindow, setHistoricalWindow] = useState(30);
  const [removeConsultancyDuplicates, setRemoveConsultancyDuplicates] = useState(true);
  const [excludeIrrelevantRoles, setExcludeIrrelevantRoles] = useState(true);
  const [deduplicatePostings, setDeduplicatePostings] = useState(true);
  const [requireSalaryMention, setRequireSalaryMention] = useState(false);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [logs, setLogs] = useState<string[]>(["Ready to run Naukri agent."]);
  const [summary, setSummary] = useState<{ jobs: number; spikes: number; recruiterSignals: number } | null>(null);

  const canRun = useMemo(() => companyName.trim().length > 0 && parseList(locations).length > 0, [companyName, locations]);

  const toggleChoice = (value: string, choices: string[], setChoices: (next: string[]) => void) => {
    setChoices(choices.includes(value) ? choices.filter((item) => item !== value) : [...choices, value]);
  };

  const navigateDashboard = () => {
    if (typeof window !== "undefined") {
      const persisted = window.sessionStorage.getItem("hiresense.dashboard.state");
      if (persisted) {
        try {
          const parsed = JSON.parse(persisted);
          parsed.activeView = "overview";
          window.sessionStorage.setItem("hiresense.dashboard.state", JSON.stringify(parsed));
        } catch {
          window.sessionStorage.removeItem("hiresense.dashboard.state");
        }
      }
    }
    router.push("/?view=overview");
  };

  const runNaukriAgent = async () => {
    if (!canRun) return;
    setRunning(true);
    setSummary(null);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setLogs((prev) => [`${new Date().toLocaleTimeString()} • Starting Naukri pipeline`, ...prev].slice(0, 15));

    const payload: Stage2RunPayload = {
      company_name: companyName,
      company_website: companyName,
      jobs: {
        keywords: parseList(keywords).length ? parseList(keywords) : DEFAULT_KEYWORDS,
        locations: parseList(locations),
        experience_level: `${experienceLevel} | mode=${workModes.join("/")} | type=${employmentTypes.join("/")} | salary=${requireSalaryMention ? "required" : "any"}`,
        company_list: parseList(companyList),
        time_filter: timeFilter,
        seniority_filter: seniorityFilter,
        function_filter: functionFilter,
        historical_window: historicalWindow,
        exclude_internships: excludeIrrelevantRoles,
      },
    };

    try {
      const start = await startPipeline(companyName, payload);
      setTaskId(start.task_id);

      socketRef.current = connectWS(start.task_id, (msg: any) => {
        if (msg.type === "done") {
          const jobs: any[] = msg?.data?.jobs || [];
          const spikes = jobs.filter((job) => job?.is_hiring_spike).length;
          const recruiterSignals = jobs.filter((job) => (job?.recruiter_signal || "").toLowerCase() !== "standard").length;
          setSummary({ jobs: jobs.length, spikes, recruiterSignals });
          setRunning(false);
          setLogs((prev) => [`${new Date().toLocaleTimeString()} • Done. Jobs=${jobs.length}`, ...prev].slice(0, 15));
          socketRef.current?.close();
          socketRef.current = null;
        } else {
          setLogs((prev) => [`${new Date().toLocaleTimeString()} • ${msg.type} updated`, ...prev].slice(0, 15));
        }
      });
    } catch (error) {
      setRunning(false);
      setLogs((prev) => [`${new Date().toLocaleTimeString()} • Failed: ${String(error)}`, ...prev].slice(0, 15));
    }
  };

  return (
    <>
      <Head>
        <title>Naukri Agent Designer | HireSense</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
      </Head>

      <main className="container py-4">
        <motion.div className="d-flex justify-content-between align-items-center mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div>
            <h2 className="mb-1">Naukri Job Scraper Agent</h2>
            <p className="text-secondary mb-0">Naukri-inspired advanced filters, rule toggles, and live pipeline monitoring.</p>
          </div>
          <button type="button" onClick={navigateDashboard} className="btn btn-outline-secondary">
            Back to Dashboard
          </button>
        </motion.div>

        <div className="row g-3">
          <div className="col-lg-7">
            <motion.div className="card h-100 border-0 shadow-sm" {...cardAnimation}>
              <div className="card-body">
                <h5>Search Inputs</h5>
                <label className="form-label mt-2">Company / Domain</label>
                <input className="form-control mb-2" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="company domain or name" />

                <label className="form-label">Keywords</label>
                <input className="form-control mb-2" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="ERP, SAP, Cloud, QA, Data, AI" />

                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label">Experience</label>
                    <input className="form-control mb-2" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} placeholder="e.g., 5-10 years" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Locations</label>
                    <input className="form-control mb-2" value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="Bengaluru, Pune, Hyderabad" />
                  </div>
                </div>

                <label className="form-label">Target company list (optional)</label>
                <input className="form-control mb-2" value={companyList} onChange={(e) => setCompanyList(e.target.value)} placeholder="Company A, Company B" />

                <label className="form-label">Freshness</label>
                <div className="d-flex gap-2 flex-wrap mb-2">
                  {(["24h", "7d", "30d"] as const).map((opt) => (
                    <motion.button
                      key={opt}
                      className={`btn btn-sm ${timeFilter === opt ? "btn-primary" : "btn-outline-primary"}`}
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTimeFilter(opt)}
                    >
                      {opt}
                    </motion.button>
                  ))}
                </div>

                <label className="form-label">Work Mode</label>
                <div className="d-flex gap-2 flex-wrap mb-2">
                  {WORK_MODES.map((opt) => (
                    <motion.button
                      key={opt}
                      className={`btn btn-sm ${workModes.includes(opt) ? "btn-dark" : "btn-outline-dark"}`}
                      type="button"
                      whileHover={{ y: -1 }}
                      onClick={() => toggleChoice(opt, workModes, setWorkModes)}
                    >
                      {opt}
                    </motion.button>
                  ))}
                </div>

                <label className="form-label">Employment Type</label>
                <div className="d-flex gap-2 flex-wrap">
                  {EMPLOYMENT_TYPES.map((opt) => (
                    <motion.button
                      key={opt}
                      className={`btn btn-sm ${employmentTypes.includes(opt) ? "btn-success" : "btn-outline-success"}`}
                      type="button"
                      whileHover={{ y: -1 }}
                      onClick={() => toggleChoice(opt, employmentTypes, setEmploymentTypes)}
                    >
                      {opt}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="col-lg-5">
            <motion.div className="card h-100 border-0 shadow-sm" {...cardAnimation}>
              <div className="card-body">
                <h5>Filters / Rules</h5>

                <label className="form-label mt-2">Seniority</label>
                <div className="d-flex gap-2 flex-wrap mb-2">
                  {SENIORITY_OPTIONS.map((opt) => (
                    <button key={opt} className={`btn btn-sm ${seniorityFilter.includes(opt) ? "btn-dark" : "btn-outline-dark"}`} type="button" onClick={() => toggleChoice(opt, seniorityFilter, setSeniorityFilter)}>
                      {opt}
                    </button>
                  ))}
                </div>

                <label className="form-label">Function</label>
                <div className="d-flex gap-2 flex-wrap mb-2">
                  {ALL_FUNCTION_FILTERS.map((opt) => (
                    <button key={opt} className={`btn btn-sm ${functionFilter.includes(opt) ? "btn-info" : "btn-outline-info"}`} type="button" onClick={() => toggleChoice(opt, functionFilter, setFunctionFilter)}>
                      {opt}
                    </button>
                  ))}
                </div>

                <label className="form-label">Historical window (days): {historicalWindow}</label>
                <input type="range" className="form-range mb-2" min={7} max={180} value={historicalWindow} onChange={(e) => setHistoricalWindow(Number(e.target.value))} />

                <div className="form-check">
                  <input className="form-check-input" type="checkbox" checked={removeConsultancyDuplicates} onChange={(e) => setRemoveConsultancyDuplicates(e.target.checked)} id="remove-consultancy" />
                  <label className="form-check-label" htmlFor="remove-consultancy">Remove consultancy duplicates</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" checked={excludeIrrelevantRoles} onChange={(e) => setExcludeIrrelevantRoles(e.target.checked)} id="exclude-irrelevant" />
                  <label className="form-check-label" htmlFor="exclude-irrelevant">Exclude irrelevant roles</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" checked={deduplicatePostings} onChange={(e) => setDeduplicatePostings(e.target.checked)} id="dedupe-postings" />
                  <label className="form-check-label" htmlFor="dedupe-postings">Deduplicate same postings</label>
                </div>
                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" checked={requireSalaryMention} onChange={(e) => setRequireSalaryMention(e.target.checked)} id="salary-only" />
                  <label className="form-check-label" htmlFor="salary-only">Only consider postings with salary mention</label>
                </div>

                <motion.button className="btn btn-primary w-100" onClick={runNaukriAgent} disabled={!canRun || running} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  {running ? "Running..." : "Run Naukri Agent"}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div className="card mt-3 border-0 shadow-sm" {...cardAnimation}>
          <div className="card-body">
            <h5>Run Status</h5>
            {taskId && <p className="mb-2"><strong>Task ID:</strong> {taskId}</p>}

            {summary && (
              <motion.div className="mb-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <span className="badge text-bg-primary me-2">Jobs: {summary.jobs}</span>
                <span className="badge text-bg-warning me-2">Spikes: {summary.spikes}</span>
                <span className="badge text-bg-info">Recruiter Signals: {summary.recruiterSignals}</span>
              </motion.div>
            )}

            <div className="log-box">
              {logs.map((log) => (
                <code key={log} className="d-block">{log}</code>
              ))}
            </div>
            <small className="text-secondary d-block mt-2">
              Rule toggles are captured in this UI. Backend currently enforces consultancy/irrelevant/dedup rules by default.
            </small>
          </div>
        </motion.div>
      </main>

      <style jsx>{`
        .log-box {
          max-height: 260px;
          overflow: auto;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px;
          background: #f8fafc;
        }
      `}</style>
    </>
  );
}
