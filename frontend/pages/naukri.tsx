import { KeyboardEvent, useMemo, useRef, useState } from "react";
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

const EXPERIENCE_OPTIONS = [
  "0-1 years",
  "1-3 years",
  "3-5 years",
  "5-8 years",
  "8-12 years",
  "12-16 years",
  "16+ years",
];

const cardAnimation = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28 },
};

type MultiSelectPillsProps = {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  helperText?: string;
  tone?: "experience" | "seniority" | "function";
};

function MultiSelectPills({ options, selected, onToggle, helperText, tone = "experience" }: MultiSelectPillsProps) {
  return (
    <div className={`multi-select mb-2 tone-${tone}`}>
      <div className="multi-select-header">
        <span className="text-secondary small">{selected.length} selected</span>
        {selected.length > 0 && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-decoration-none"
            onClick={() => selected.forEach((value) => onToggle(value))}
          >
            Clear all
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="selected-chip-wrap">
          {selected.map((value) => (
            <button key={value} type="button" className="chip selected-chip" onClick={() => onToggle(value)}>
              {value} ×
            </button>
          ))}
        </div>
      )}

      <div className="pill-wrap">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              className={`pill-btn ${active ? "active" : ""}`}
              onClick={() => onToggle(opt)}
              aria-pressed={active}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {helperText && <small className="text-secondary d-block mt-1">{helperText}</small>}
    </div>
  );
}

export default function NaukriPage() {
  const router = useRouter();
  const socketRef = useRef<WebSocket | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [keywords, setKeywords] = useState<string[]>(DEFAULT_KEYWORDS);
  const [keywordInput, setKeywordInput] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<string[]>(["5-8 years"]);
  const [locations, setLocations] = useState<string[]>(["Bengaluru", "Pune"]);
  const [locationInput, setLocationInput] = useState("");
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

  const canRun = useMemo(() => locations.length > 0 && keywords.length > 0, [locations, keywords]);

  const toggleChoice = (value: string, choices: string[], setChoices: (next: string[]) => void) => {
    setChoices(choices.includes(value) ? choices.filter((item) => item !== value) : [...choices, value]);
  };

  const addMultiValue = (rawValue: string, values: string[], setValues: (next: string[]) => void) => {
    const next = rawValue.trim();
    if (!next || values.includes(next)) return;
    setValues([...values, next]);
  };

  const onInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    values: string[],
    setValues: (next: string[]) => void,
    clearInput: () => void
  ) => {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addMultiValue((event.currentTarget as HTMLInputElement).value, values, setValues);
    clearInput();
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

    const effectiveCompany = companyName.trim() || "general-market";
    const payload: Stage2RunPayload = {
      company_name: effectiveCompany,
      company_website: companyName.trim() || undefined,
      jobs: {
        keywords: keywords.length ? keywords : DEFAULT_KEYWORDS,
        locations,
        experience_level: `${experienceLevel.join(", ")} | mode=${workModes.join("/")} | type=${employmentTypes.join("/")} | salary=${requireSalaryMention ? "required" : "any"}`,
        company_list: parseList(companyList),
        time_filter: timeFilter,
        seniority_filter: seniorityFilter,
        function_filter: functionFilter,
        historical_window: historicalWindow,
        exclude_internships: excludeIrrelevantRoles,
      },
    };

    try {
      const start = await startPipeline(effectiveCompany, payload);
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
                <label className="form-label mt-2">Company / Domain (optional)</label>
                <input className="form-control mb-2" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="company domain or name (optional)" />

                <label className="form-label">Keywords</label>
                <div className="chip-wrap mb-2">
                  {keywords.map((value) => (
                    <button key={value} type="button" className="chip" onClick={() => setKeywords(keywords.filter((item) => item !== value))}>
                      {value} ×
                    </button>
                  ))}
                  <input
                    className="chip-input"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => onInputKeyDown(e, keywords, setKeywords, () => setKeywordInput(""))}
                    onBlur={() => {
                      addMultiValue(keywordInput, keywords, setKeywords);
                      setKeywordInput("");
                    }}
                    placeholder="Type keyword and press Enter"
                  />
                </div>

                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label">Experience</label>
                    <MultiSelectPills
                      options={EXPERIENCE_OPTIONS}
                      selected={experienceLevel}
                      onToggle={(value) => toggleChoice(value, experienceLevel, setExperienceLevel)}
                      helperText="Choose one or more experience ranges."
                      tone="experience"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Locations</label>
                    <div className="chip-wrap mb-2">
                      {locations.map((value) => (
                        <button key={value} type="button" className="chip" onClick={() => setLocations(locations.filter((item) => item !== value))}>
                          {value} ×
                        </button>
                      ))}
                      <input
                        className="chip-input"
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        onKeyDown={(e) => onInputKeyDown(e, locations, setLocations, () => setLocationInput(""))}
                        onBlur={() => {
                          addMultiValue(locationInput, locations, setLocations);
                          setLocationInput("");
                        }}
                        placeholder="Add location and press Enter"
                      />
                    </div>
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
                <MultiSelectPills
                  options={SENIORITY_OPTIONS}
                  selected={seniorityFilter}
                  onToggle={(value) => toggleChoice(value, seniorityFilter, setSeniorityFilter)}
                  helperText="Pick matching seniority buckets for the role."
                  tone="seniority"
                />

                <label className="form-label">Function</label>
                <MultiSelectPills
                  options={ALL_FUNCTION_FILTERS}
                  selected={functionFilter}
                  onToggle={(value) => toggleChoice(value, functionFilter, setFunctionFilter)}
                  helperText="Select all relevant job functions."
                  tone="function"
                />

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
        .chip-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          border: 1px solid #ced4da;
          border-radius: 6px;
          min-height: 42px;
          padding: 6px;
          align-items: center;
        }
        .chip {
          border: 1px solid #dbeafe;
          background: #eff6ff;
          color: #1e40af;
          border-radius: 999px;
          padding: 2px 10px;
          font-size: 12px;
        }
        .chip-input {
          border: 0;
          outline: none;
          min-width: 180px;
          flex: 1;
        }
        .multi-select {
          border: 1px solid #dbe4ee;
          border-radius: 10px;
          padding: 10px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .multi-select:hover {
          transform: translateY(-1px);
        }
        .multi-select.tone-experience:hover {
          border-color: #93c5fd;
          box-shadow: 0 6px 14px rgba(37, 99, 235, 0.12);
        }
        .multi-select.tone-seniority:hover {
          border-color: #c4b5fd;
          box-shadow: 0 6px 14px rgba(109, 40, 217, 0.12);
        }
        .multi-select.tone-function:hover {
          border-color: #fdba74;
          box-shadow: 0 6px 14px rgba(234, 88, 12, 0.12);
        }
        .multi-select-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .selected-chip-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }
        .selected-chip {
          background: #ecfdf3;
          border-color: #a7f3d0;
          color: #065f46;
          transition: transform 0.15s ease, box-shadow 0.2s ease;
        }
        .selected-chip:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(6, 95, 70, 0.18);
        }
        .pill-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pill-btn {
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          background: #fff;
          color: #334155;
          padding: 4px 12px;
          font-size: 12px;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .pill-btn:hover {
          transform: translateY(-1px);
        }
        .tone-experience .pill-btn:hover {
          border-color: #60a5fa;
          color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
        }
        .tone-seniority .pill-btn:hover {
          border-color: #a78bfa;
          color: #6d28d9;
          box-shadow: 0 4px 10px rgba(124, 58, 237, 0.2);
        }
        .tone-function .pill-btn:hover {
          border-color: #fb923c;
          color: #c2410c;
          box-shadow: 0 4px 10px rgba(249, 115, 22, 0.2);
        }
        .pill-btn.active {
          font-weight: 600;
        }
        .tone-experience .pill-btn.active {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #93c5fd;
          box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.25);
        }
        .tone-seniority .pill-btn.active {
          background: #f5f3ff;
          color: #6d28d9;
          border-color: #c4b5fd;
          box-shadow: inset 0 0 0 1px rgba(124, 58, 237, 0.24);
        }
        .tone-function .pill-btn.active {
          background: #fff7ed;
          color: #c2410c;
          border-color: #fdba74;
          box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.2);
        }
      `}</style>
    </>
  );
}
