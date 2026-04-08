import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import PremiumSidebar from "../components/PremiumSidebar";
import TopNavbar from "../components/TopNavbar";
import PipelineFlow from "../components/PipelineFlow";
import { Stage2RunPayload, startPipeline } from "../services/api";
import { connectWS } from "../services/websocket";

const AGENT_CONFIG = [
  { id: "linkedin", name: "LinkedIn Job Scraper", icon: "fa-linkedin", fields: ["Company URL", "Role Keywords", "Location"] },
  { id: "naukri", name: "Naukri Job Scraper", icon: "fa-briefcase", fields: ["Keywords", "Experience", "Location"] },
  { id: "interpreter", name: "Hiring Intent Interpreter", icon: "fa-brain", fields: ["Intent Threshold", "Hiring Velocity", "Urgency"] },
  { id: "tech-stack", name: "Tech Stack Detector", icon: "fa-layer-group", fields: ["Domain", "Technologies", "Confidence"] },
  { id: "news", name: "Company News & Events Miner", icon: "fa-newspaper", fields: ["Company", "Time Range", "Event Type"] },
  { id: "tender", name: "Tender / Procurement Tracker", icon: "fa-file-signature", fields: ["Region", "Tender Value", "Industry"] },
  { id: "filings", name: "Annual Report / Filings Extractor", icon: "fa-file-lines", fields: ["Ticker", "Filing Type", "Fiscal Year"] },
  { id: "research", name: "Deep Research Agent", icon: "fa-magnifying-glass-chart", fields: ["Research Goal", "Sources", "Depth"] },
  { id: "aggregator-agent", name: "Intent Signal Aggregator", icon: "fa-wave-square", fields: ["Weighting Model", "Signal Window", "Priorities"] },
];

const DASHBOARD_STATE_KEY = "hiresense.dashboard.state";
const DEFAULT_JOB_KEYWORDS = ["ERP", "SAP", "Cloud", "QA", "Data", "AI"];
const DEFAULT_FUNCTION_FILTERS = ["ERP", "Cloud", "Data", "QA", "AI"];

declare global {
  interface Window {
    Chart?: any;
  }
}

export default function Home() {
  const router = useRouter();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeView, setActiveView] = useState("overview");
  const [company, setCompany] = useState("stripe.com");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "System booted • waiting for company query",
    "Realtime channels connected",
  ]);
  const [agentState, setAgentState] = useState<Record<string, string>>(
    Object.fromEntries(AGENT_CONFIG.map((a, idx) => [a.id, idx < 2 ? "Running" : "Idle"]))
  );
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [jobKeywordsText, setJobKeywordsText] = useState(DEFAULT_JOB_KEYWORDS.join(", "));
  const [jobExperience, setJobExperience] = useState("5-10 years");
  const [jobLocationText, setJobLocationText] = useState("Bengaluru, Pune");
  const [jobCompanyText, setJobCompanyText] = useState("");
  const [jobTimeFilter, setJobTimeFilter] = useState<"24h" | "7d" | "30d">("7d");
  const [jobSeniorityFilter, setJobSeniorityFilter] = useState<string[]>(["Mid Level"]);
  const [jobFunctionFilter, setJobFunctionFilter] = useState<string[]>(DEFAULT_FUNCTION_FILTERS);
  const [jobHistoricalWindow, setJobHistoricalWindow] = useState(30);
  const [excludeIrrelevantRoles, setExcludeIrrelevantRoles] = useState(true);

  const trendRef = useRef<HTMLCanvasElement | null>(null);
  const distributionRef = useRef<HTMLCanvasElement | null>(null);
  const donutRef = useRef<HTMLCanvasElement | null>(null);

  const agentsWithStatus = useMemo(
    () => AGENT_CONFIG.map((a) => ({ ...a, status: agentState[a.id] || "Idle" })),
    [agentState]
  );


  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const persisted = window.sessionStorage.getItem(DASHBOARD_STATE_KEY);
      if (!persisted) return;
      const parsed = JSON.parse(persisted);
      if (parsed.theme === "dark" || parsed.theme === "light") setTheme(parsed.theme);
      if (typeof parsed.activeView === "string") setActiveView(parsed.activeView);
      if (typeof parsed.company === "string") setCompany(parsed.company);
      if (typeof parsed.jobKeywordsText === "string") setJobKeywordsText(parsed.jobKeywordsText);
      if (typeof parsed.jobExperience === "string") setJobExperience(parsed.jobExperience);
      if (typeof parsed.jobLocationText === "string") setJobLocationText(parsed.jobLocationText);
      if (typeof parsed.jobCompanyText === "string") setJobCompanyText(parsed.jobCompanyText);
      if (parsed.jobTimeFilter === "24h" || parsed.jobTimeFilter === "7d" || parsed.jobTimeFilter === "30d") setJobTimeFilter(parsed.jobTimeFilter);
      if (Array.isArray(parsed.jobSeniorityFilter)) setJobSeniorityFilter(parsed.jobSeniorityFilter);
      if (Array.isArray(parsed.jobFunctionFilter)) setJobFunctionFilter(parsed.jobFunctionFilter);
      if (typeof parsed.jobHistoricalWindow === "number") setJobHistoricalWindow(parsed.jobHistoricalWindow);
      if (typeof parsed.excludeIrrelevantRoles === "boolean") setExcludeIrrelevantRoles(parsed.excludeIrrelevantRoles);
      if (Array.isArray(parsed.logs)) setLogs(parsed.logs.slice(0, 10));
      if (parsed.agentState && typeof parsed.agentState === "object") setAgentState(parsed.agentState);
    } catch {
      // ignore invalid session state
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      DASHBOARD_STATE_KEY,
      JSON.stringify({
        theme,
        activeView,
        company,
        jobKeywordsText,
        jobExperience,
        jobLocationText,
        jobCompanyText,
        jobTimeFilter,
        jobSeniorityFilter,
        jobFunctionFilter,
        jobHistoricalWindow,
        excludeIrrelevantRoles,
        logs,
        agentState,
      })
    );
  }, [
    theme,
    activeView,
    company,
    jobKeywordsText,
    jobExperience,
    jobLocationText,
    jobCompanyText,
    jobTimeFilter,
    jobSeniorityFilter,
    jobFunctionFilter,
    jobHistoricalWindow,
    excludeIrrelevantRoles,
    logs,
    agentState,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs((prev) => [
        `${new Date().toLocaleTimeString()} • Signal recalculated for ${company}`,
        ...prev,
      ].slice(0, 10));
    }, 3500);
    return () => clearInterval(interval);
  }, [company]);

  useEffect(() => {
    if (!window.Chart || !trendRef.current || !distributionRef.current || !donutRef.current) return;

    const trend = new window.Chart(trendRef.current, {
      type: "line",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [{ label: "Intent Score", data: [42, 48, 51, 64, 59, 71, 78], borderColor: "#5eead4", tension: 0.35 }],
      },
      options: { plugins: { legend: { display: false } } },
    });

    const distribution = new window.Chart(distributionRef.current, {
      type: "bar",
      data: {
        labels: ["Hiring", "News", "Tech", "Filings", "Tenders"],
        datasets: [{ data: [30, 20, 15, 15, 20], backgroundColor: ["#7c3aed", "#06b6d4", "#22c55e", "#f97316", "#eab308"] }],
      },
      options: { plugins: { legend: { display: false } } },
    });

    const donut = new window.Chart(donutRef.current, {
      type: "doughnut",
      data: {
        labels: ["Hiring", "News", "Tech", "Filings", "Tenders"],
        datasets: [{ data: [30, 20, 15, 15, 20], borderWidth: 0 }],
      },
      options: { cutout: "74%", plugins: { legend: { labels: { color: "#94a3b8" } } } },
    });

    return () => {
      trend.destroy();
      distribution.destroy();
      donut.destroy();
    };
  }, [activeView]);

  useEffect(() => {
    const forcedView = router.query.view;
    if (typeof forcedView === "string" && forcedView) {
      setActiveView(forcedView);
      return;
    }
    if (activeView === "linkedin") {
      router.push("/linkedin");
      return;
    }
    if (activeView === "naukri") {
      router.push("/naukri");
      return;
    }
    if (activeView === "interpreter") {
      router.push("/upload");
      return;
    }
    if (activeView === "tech-stack") {
      router.push("/tech-stack");
      return;
    }
  }, [activeView, router, router.query.view]);

  useEffect(() => {
    const syncLayout = () => setIsMobileLayout(window.innerWidth < 1100);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  useEffect(() => {
    if (!isMobileLayout) setMobileSidebarOpen(false);
  }, [isMobileLayout]);

  const runPipeline = async () => {
    if (!company) return;
    setRunning(true);
    setLogs((prev) => [`${new Date().toLocaleTimeString()} • Starting pipeline for ${company}`, ...prev]);
    setAgentState((prev) => Object.fromEntries(Object.keys(prev).map((key) => [key, "Running"])));
    try {
      const parseList = (value: string) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

      const pipelinePayload: Stage2RunPayload = {
        company_name: company,
        company_website: company,
        jobs: {
          keywords: parseList(jobKeywordsText).length ? parseList(jobKeywordsText) : DEFAULT_JOB_KEYWORDS,
          experience_level: jobExperience,
          locations: parseList(jobLocationText),
          company_list: parseList(jobCompanyText),
          time_filter: jobTimeFilter,
          seniority_filter: jobSeniorityFilter,
          function_filter: jobFunctionFilter,
          historical_window: jobHistoricalWindow,
          exclude_internships: excludeIrrelevantRoles,
        },
      };

      const res = await startPipeline(company, pipelinePayload);
      connectWS(res.task_id, (msg: any) => {
        if (msg.type === "done") {
          setRunning(false);
          setAgentState((prev) => Object.fromEntries(Object.keys(prev).map((key) => [key, "Completed"])));
          setLogs((prev) => [`${new Date().toLocaleTimeString()} • Aggregated score ready`, ...prev]);
        } else {
          setLogs((prev) => [`${new Date().toLocaleTimeString()} • ${msg.type} agent emitted output`, ...prev].slice(0, 10));
        }
      });
    } catch {
      setRunning(false);
      setLogs((prev) => [`${new Date().toLocaleTimeString()} • Pipeline failed. Retry suggested`, ...prev]);
    }
  };

  const selectedAgent = agentsWithStatus.find((a) => a.id === activeView);

  return (
    <>
      <Head>
        <title>HireSense Premium Dashboard</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" rel="stylesheet" />
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="afterInteractive" />
      <main className={`app-shell ${theme}`}>
        <PremiumSidebar
          activeView={activeView}
          setActiveView={setActiveView}
          agents={agentsWithStatus}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          isMobile={isMobileLayout}
        />
        {isMobileLayout && mobileSidebarOpen && <button className="mobile-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} aria-label="Close menu overlay" />}

        <section className="main-content">
          <TopNavbar theme={theme} setTheme={setTheme} onMenuToggle={() => setMobileSidebarOpen((prev) => !prev)} />

          <div className="hero glass-panel mb-3">
            <div>
              <h2>Multi-Agent Intelligence Workspace</h2>
              <p>Track hiring, tech, filings, and procurement signals in one shared operational view.</p>
            </div>
            <div className="hero-actions">
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company domain or name" />
              <button className="run-btn" onClick={runPipeline} disabled={running}>{running ? "Running" : "Run Orchestration"}</button>
            </div>
          </div>

          {activeView === "overview" && (
            <>
              <div className="row g-3 mb-3">
                {[
                  ["Total Companies Analyzed", "—", "fa-building"],
                  ["High Intent Leads", "—", "fa-fire"],
                  ["Active Agents Running", `${Object.values(agentState).filter((s) => s === "Running").length}/9`, "fa-robot"],
                  ["Recent Signals", `${logs.length}`, "fa-signal"],
                ].map(([title, value, icon]) => (
                  <div className="col-md-6 col-xl-3" key={title}>
                    <div className="glass-panel kpi-card float-card">
                      <i className={`fa-solid ${icon}`} />
                      <small>{title}</small>
                      <strong>{value}</strong>
                    </div>
                  </div>
                ))}
              </div>
              <div className="row g-3">
                <div className="col-xl-7"><div className="glass-panel chart-panel"><h4>Intent Score Trends</h4><canvas ref={trendRef} /></div></div>
                <div className="col-xl-5"><div className="glass-panel chart-panel"><h4>Signal Distribution</h4><canvas ref={distributionRef} /></div></div>
              </div>
            </>
          )}

          {activeView === "pipeline" && <PipelineFlow agents={agentsWithStatus} onSelect={setActiveView} />}

          {activeView === "aggregator" && (
            <div className="row g-3">
              <div className="col-xl-5">
                <div className="glass-panel aggregator-score">
                  <h3>Intent Aggregator Score</h3>
                  <div className="score-ring">82</div>
                  <canvas ref={donutRef} />
                </div>
              </div>
              <div className="col-xl-7">
                <div className="glass-panel">
                  <h3>Recommendations</h3>
                  <ul className="recommendations">
                    <li>Prioritize outbound for companies with sustained hiring + funding news spikes.</li>
                    <li>Increase confidence only when filings and procurement trend agree.</li>
                    <li>Assign deep research agent for unclear signals between 55–70 score.</li>
                  </ul>
                  {[
                    ["Hiring", 30],
                    ["News", 20],
                    ["Tech", 15],
                    ["Filings", 15],
                    ["Tenders", 20],
                  ].map(([label, score]) => (
                    <div key={label as string} className="mb-2">
                      <div className="d-flex justify-content-between"><small>{label as string}</small><small>{score as number}%</small></div>
                      <div className="progress soft-progress"><div className="progress-bar" style={{ width: `${score}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === "activity" && (
            <div className="glass-panel log-panel">
              <h3>Real-time Activity</h3>
              {logs.map((log) => <code key={log}>{log}</code>)}
            </div>
          )}


          {selectedAgent && selectedAgent.id !== "linkedin" && (
            <div className="glass-panel agent-workbench mt-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3>{selectedAgent.name}</h3>
                <span className={`status-badge ${selectedAgent.status.toLowerCase()}`}>{selectedAgent.status}</span>
              </div>
              <div className="row g-3">
                <div className="col-lg-4">
                  <h5>Input Panel</h5>
                  {selectedAgent.fields.map((field) => (
                    <div className="form-floating mb-2" key={field}>
                      <input className="form-control neon-input" id={field} placeholder={field} />
                      <label htmlFor={field}>{field}</label>
                    </div>
                  ))}
                  <div className="mt-3">
                    <label className="form-label">Time Range</label>
                    <input type="range" className="form-range" />
                  </div>
                  <button className="run-btn mt-2">Run Agent</button>
                </div>
                <div className="col-lg-4">
                  <h5>Process State</h5>
                  <div className="stepper">
                    <span className="active">1. Scraping</span>
                    <span className="active">2. Processing</span>
                    <span>3. Output</span>
                  </div>
                  <div className="progress mt-3 soft-progress"><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: "68%" }} /></div>
                </div>
                <div className="col-lg-4">
                  <h5>Output Panel</h5>
                  <ul className="nav nav-pills mb-2">
                    <li className="nav-item"><button className="nav-link active">Table</button></li>
                    <li className="nav-item"><button className="nav-link">JSON</button></li>
                    <li className="nav-item"><button className="nav-link">Insights</button></li>
                  </ul>
                  <div className="output-box">Structured output preview for {selectedAgent.name}. Copy/Export actions appear here.</div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <style jsx global>{`
        :root { --brand-primary: #C15F3C; --brand-accent: #A14A2F; --muted: #B1ADA1; --tan: #C4A584; --bg: #F4F3EE; --bg-soft: #FAF9F5; --surface: #FFFFFF; --surface-soft: #F4F3EE; --text: #3D322D; --border: #D8D2C6; }
        .light { --bg: #FAF9F5; --text: #3D322D; }
        body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, system-ui, sans-serif; }
        .app-shell { min-height: 100vh; display: flex; position: relative; overflow: hidden; background: var(--bg); }
        
        .main-content { flex: 1; padding: 1rem; z-index: 1; }
        .glass-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 1rem; box-shadow: 0 4px 16px rgba(61,50,45,0.08); }
        .premium-sidebar { width: 320px; z-index: 2; margin: 1rem; padding: 1rem; transition: width .25s ease; overflow-y: auto; }
        .premium-sidebar.collapsed { width: 96px; }
        .mobile-sidebar-backdrop { display: none; }
        .brand-row { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; }
        .brand-mark { width: 42px; height: 42px; border-radius: 12px; background: var(--brand-primary); color: #fff; display: grid; place-items: center; font-weight: 700; }
        .collapse-btn { margin-left: auto; border: none; background: transparent; color: var(--muted); }
        .mobile-close-btn { display: none; }
        .section-label { text-transform: uppercase; letter-spacing: .08em; font-size: .7rem; color: #7a6f67; margin: 1rem 0 .6rem; }
        .nav-btn { width: 100%; border: 1px solid var(--border); margin-bottom: .4rem; border-radius: .75rem; background: var(--bg-soft); color: inherit; padding: .65rem .8rem; display: flex; align-items: center; gap: .7rem; transition: all .2s; }
        .nav-btn:hover, .nav-btn.active { border-color: var(--brand-primary); background: #fff; transform: translateX(3px); }
        .nav-btn small { margin-left: auto; font-size: .65rem; }
        .top-nav { display: flex; justify-content: space-between; align-items: center; padding: .8rem 1rem; margin-bottom: 1rem; }
        .mobile-menu-btn { display: none; }
        .search-wrap { width: min(560px, 100%); display: flex; align-items: center; gap: .5rem; padding: .5rem .8rem; border-radius: .75rem; background: var(--bg-soft); border: 1px solid var(--border); }
        .search-wrap input { background: transparent; border: none; color: inherit; width: 100%; outline: none; }
        .nav-actions { display: flex; align-items: center; gap: .5rem; }
        .icon-btn { border: 1px solid var(--border); width: 38px; height: 38px; border-radius: 50%; background: var(--surface); color: inherit; position: relative; }
        .notif-dot { position: absolute; top: 7px; right: 8px; width: 7px; height: 7px; border-radius: 50%; background: var(--brand-primary); }
        .profile-btn { border: 1px solid var(--border); padding: .4rem .7rem; display: flex; gap: .6rem; align-items: center; border-radius: 999px; background: var(--surface); color: inherit; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--brand-primary); color: #fff; display: grid; place-items: center; font-size: .7rem; }
        .hero { padding: 1rem; display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
        .hero-actions { display: flex; gap: .55rem; }
        .hero-actions input { min-width: 280px; background: var(--bg-soft); border: 1px solid var(--border); color: inherit; border-radius: .7rem; padding: .6rem .8rem; }
        .run-btn { border: none; border-radius: .75rem; background: var(--brand-primary); color: #fff; padding: .6rem .9rem; }
        .kpi-card { padding: 1rem; display: grid; gap: .35rem; }
        .kpi-card i { font-size: 1.2rem; color: var(--brand-primary); }
        .kpi-card strong { font-size: 1.35rem; }
        .chart-panel { padding: 1rem; height: 100%; }
        .pipeline-wrap { padding: 1rem; }
        .pipeline-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; }
        .node-group { display: flex; align-items: center; gap: .4rem; }
        .pipeline-node { border: 1px solid var(--border); border-radius: .8rem; background: var(--bg-soft); color: inherit; padding: .7rem; width: 100%; text-align: left; display: grid; }
        .pipeline-node.running { border-color: var(--brand-primary); }
        .pipeline-node.completed { border-color: #7d9a5c; }
        .edge { width: 42px; height: 2px; background: linear-gradient(90deg, var(--brand-primary), transparent); animation: pulse 1.8s infinite; }
        @keyframes pulse { 50% { opacity: .35; } }
        .aggregator-score { padding: 1rem; text-align: center; }
        .score-ring { width: 120px; height: 120px; margin: .6rem auto 1rem; border-radius: 50%; border: 8px solid #c4a584; display: grid; place-items: center; font-size: 2rem; }
        .recommendations { padding-left: 1rem; }
        .soft-progress { background: #ece8df; }
        .soft-progress .progress-bar { background: var(--brand-primary); }
        .log-panel { padding: 1rem; display: grid; gap: .4rem; }
        .log-panel code { color: #6a4a3d; background: #f1ede4; padding: .45rem .6rem; border-radius: .5rem; }
        .agent-workbench { padding: 1rem; }
        .status-badge { padding: .3rem .7rem; border-radius: 999px; font-size: .75rem; }
        .status-badge.running { background: #f4e5de; color: #a14a2f; }
        .status-badge.idle { background: #ebe7dd; color: #7a6f67; }
        .status-badge.completed { background: #e6ecd9; color: #5f7444; }
        .stepper { display: grid; gap: .35rem; }
        .stepper span { padding: .4rem .6rem; border-radius: .5rem; background: #f4f0e8; }
        .stepper .active { border: 1px solid var(--brand-primary); }
        .output-box { min-height: 130px; padding: .7rem; border: 1px dashed var(--border); border-radius: .7rem; color: #7a6f67; }
        .neon-input { background-color: #faf9f5 !important; border-color: var(--border); color: inherit !important; }
        .badge-dot.running { color: var(--brand-primary); }
        .badge-dot.completed { color: #5f7444; }
        @media (max-width: 1400px) {
          .pipeline-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .hero h2 { font-size: 1.35rem; }
        }
        @media (max-width: 1100px) {
          .premium-sidebar { position: fixed; left: 0; top: 0; bottom: 0; margin: 0; border-radius: 0; transform: translateX(-100%); transition: transform .25s ease, width .25s ease; width: min(88vw, 320px); max-width: 320px; }
          .premium-sidebar.mobile-open { transform: translateX(0); }
          .main-content { margin-left: 0; padding: .9rem; }
          .mobile-sidebar-backdrop { display: block; position: fixed; inset: 0; z-index: 1; border: none; background: rgba(61, 50, 45, .28); }
          .mobile-menu-btn { display: inline-grid; place-items: center; }
          .mobile-close-btn { display: inline-block; margin-top: .85rem; width: 100%; border-radius: .75rem; padding: .6rem .8rem; border: 1px solid var(--border); background: var(--surface); }
          .hero { flex-direction: column; align-items: stretch; }
          .hero-actions { flex-wrap: wrap; width: 100%; }
          .hero-actions input { min-width: 0; flex: 1; }
          .hero-actions .run-btn { width: 100%; }
          .pipeline-grid { grid-template-columns: 1fr; }
          .top-nav { gap: .7rem; align-items: stretch; }
          .search-wrap { width: 100%; }
          .nav-actions { width: 100%; flex-wrap: wrap; justify-content: flex-end; }
          .profile-btn { margin-left: auto; }
        }
        @media (max-width: 768px) {
          .main-content { padding: .75rem; }
          .hero, .glass-panel, .chart-panel, .log-panel, .agent-workbench { padding: .85rem; }
          .top-nav { padding: .75rem; }
          .profile-btn strong { font-size: .86rem; }
          .profile-btn small { font-size: .72rem; }
          .score-ring { width: 96px; height: 96px; font-size: 1.6rem; border-width: 6px; }
          .agent-workbench .d-flex { flex-direction: column; align-items: flex-start !important; gap: .6rem; }
          .agent-workbench .nav.nav-pills { flex-wrap: wrap; gap: .35rem; }
        }
        @media (max-width: 576px) {
          .nav-actions { justify-content: space-between; }
          .icon-btn { width: 34px; height: 34px; }
          .profile-btn { width: 100%; justify-content: space-between; padding: .5rem .65rem; }
          .kpi-card strong { font-size: 1.2rem; }
          .output-box { min-height: 110px; font-size: .88rem; }
        }
      `}</style>
    </>
  );
}
