import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import PremiumSidebar from "../components/PremiumSidebar";
import TopNavbar from "../components/TopNavbar";
import PipelineFlow from "../components/PipelineFlow";
import { startPipeline } from "../services/api";
import { connectWS } from "../services/websocket";

const AGENT_CONFIG = [
  { id: "linkedin", name: "LinkedIn Job Scraper", icon: "fa-linkedin", fields: ["Company URL", "Role Keywords", "Location"] },
  { id: "naukri", name: "Naukri Job Scraper", icon: "fa-briefcase", fields: ["Company Name", "Experience Range", "Recency"] },
  { id: "interpreter", name: "Hiring Intent Interpreter", icon: "fa-brain", fields: ["Intent Threshold", "Hiring Velocity", "Urgency"] },
  { id: "tech-stack", name: "Tech Stack Detector", icon: "fa-layer-group", fields: ["Domain", "Technologies", "Confidence"] },
  { id: "news", name: "Company News & Events Miner", icon: "fa-newspaper", fields: ["Company", "Time Range", "Event Type"] },
  { id: "tender", name: "Tender / Procurement Tracker", icon: "fa-file-signature", fields: ["Region", "Tender Value", "Industry"] },
  { id: "filings", name: "Annual Report / Filings Extractor", icon: "fa-file-lines", fields: ["Ticker", "Filing Type", "Fiscal Year"] },
  { id: "research", name: "Deep Research Agent", icon: "fa-magnifying-glass-chart", fields: ["Research Goal", "Sources", "Depth"] },
  { id: "aggregator-agent", name: "Intent Signal Aggregator", icon: "fa-wave-square", fields: ["Weighting Model", "Signal Window", "Priorities"] },
];

const DASHBOARD_STATE_KEY = "hiresense.dashboard.state";

declare global {
  interface Window {
    Chart?: any;
    particlesJS?: any;
    gsap?: any;
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
      if (Array.isArray(parsed.logs)) setLogs(parsed.logs.slice(0, 10));
      if (parsed.agentState && typeof parsed.agentState === "object") setAgentState(parsed.agentState);
    } catch {
      // ignore invalid session state
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify({ theme, activeView, company, logs, agentState }));
  }, [theme, activeView, company, logs, agentState]);

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
    if (activeView === "linkedin") {
      router.push("/linkedin");
    }
  }, [activeView, router]);

  useEffect(() => {
    if (window.particlesJS) {
      window.particlesJS("particles-js", {
        particles: { number: { value: 36 }, color: { value: ["#22d3ee", "#8b5cf6", "#a3e635"] }, line_linked: { enable: true, opacity: 0.16 } },
      });
    }
    if (window.gsap) {
      window.gsap.to(".float-card", { y: -8, duration: 1.7, yoyo: true, repeat: -1, stagger: 0.2, ease: "sine.inOut" });
    }
  }, []);

  const runPipeline = async () => {
    if (!company) return;
    setRunning(true);
    setLogs((prev) => [`${new Date().toLocaleTimeString()} • Starting pipeline for ${company}`, ...prev]);
    setAgentState((prev) => Object.fromEntries(Object.keys(prev).map((key) => [key, "Running"])));
    try {
      const res = await startPipeline(company);
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
      <Script src="https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" strategy="afterInteractive" />

      <main className={`app-shell ${theme}`}>
        <div id="particles-js" />
        <PremiumSidebar activeView={activeView} setActiveView={setActiveView} agents={agentsWithStatus} />

        <section className="main-content">
          <TopNavbar theme={theme} setTheme={setTheme} />

          <div className="hero glass-panel mb-3">
            <div>
              <h2>Multi-Agent AI Intelligence Platform</h2>
              <p>Track intent, hiring velocity, filings, and tender signals in one adaptive command center.</p>
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
                  ["Total Companies Analyzed", "4,892", "fa-building"],
                  ["High Intent Leads", "326", "fa-fire"],
                  ["Active Agents Running", "5/9", "fa-robot"],
                  ["Recent Signals", "1,284", "fa-signal"],
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
        :root { --bg: #050810; --text: #e2e8f0; }
        .light { --bg: #f4f8ff; --text: #0f172a; }
        body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, system-ui, sans-serif; }
        .app-shell { min-height: 100vh; display: flex; position: relative; overflow: hidden; background: radial-gradient(circle at 12% 8%, #1d4ed8 0%, transparent 35%), radial-gradient(circle at 88% 88%, #7c3aed 0%, transparent 32%), var(--bg); }
        #particles-js { position: fixed; inset: 0; z-index: 0; opacity: 0.65; }
        .main-content { flex: 1; padding: 1rem; z-index: 1; }
        .glass-panel { background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(255, 255, 255, 0.13); backdrop-filter: blur(14px); border-radius: 1rem; box-shadow: 0 10px 36px rgba(4, 6, 20, 0.4); }
        .premium-sidebar { width: 320px; z-index: 2; margin: 1rem; padding: 1rem; transition: width .25s ease; overflow-y: auto; }
        .premium-sidebar.collapsed { width: 96px; }
        .brand-row { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; }
        .brand-mark { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #22d3ee, #7c3aed); display: grid; place-items: center; font-weight: 700; }
        .collapse-btn { margin-left: auto; border: none; background: transparent; color: #9ca3af; }
        .section-label { text-transform: uppercase; letter-spacing: .08em; font-size: .7rem; color: #94a3b8; margin: 1rem 0 .6rem; }
        .nav-btn { width: 100%; border: 1px solid transparent; margin-bottom: .4rem; border-radius: .75rem; background: rgba(30, 41, 59, 0.45); color: inherit; padding: .65rem .8rem; display: flex; align-items: center; gap: .7rem; transition: all .2s; }
        .nav-btn:hover, .nav-btn.active { border-color: rgba(34, 211, 238, 0.6); box-shadow: 0 0 24px rgba(34, 211, 238, 0.2); transform: translateX(3px); }
        .nav-btn small { margin-left: auto; font-size: .65rem; }
        .top-nav { display: flex; justify-content: space-between; align-items: center; padding: .8rem 1rem; margin-bottom: 1rem; }
        .search-wrap { width: min(560px, 100%); display: flex; align-items: center; gap: .5rem; padding: .5rem .8rem; border-radius: .75rem; background: rgba(2, 6, 23, .5); }
        .search-wrap input { background: transparent; border: none; color: inherit; width: 100%; outline: none; }
        .nav-actions { display: flex; align-items: center; gap: .5rem; }
        .icon-btn { border: none; width: 38px; height: 38px; border-radius: 50%; background: rgba(15, 23, 42, .6); color: inherit; position: relative; }
        .notif-dot { position: absolute; top: 7px; right: 8px; width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
        .profile-btn { border: none; padding: .4rem .7rem; display: flex; gap: .6rem; align-items: center; border-radius: 999px; background: rgba(15,23,42,.55); color: inherit; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #22d3ee, #7c3aed); display: grid; place-items: center; font-size: .7rem; }
        .hero { padding: 1rem; display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
        .hero-actions { display: flex; gap: .55rem; }
        .hero-actions input { min-width: 280px; background: rgba(2, 6, 23, .55); border: 1px solid rgba(255,255,255,.12); color: inherit; border-radius: .7rem; padding: .6rem .8rem; }
        .run-btn { border: none; border-radius: .75rem; background: linear-gradient(135deg, #06b6d4, #7c3aed); color: #fff; padding: .6rem .9rem; }
        .kpi-card { padding: 1rem; display: grid; gap: .35rem; }
        .kpi-card i { font-size: 1.2rem; color: #22d3ee; }
        .kpi-card strong { font-size: 1.35rem; }
        .chart-panel { padding: 1rem; height: 100%; }
        .pipeline-wrap { padding: 1rem; }
        .pipeline-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; }
        .node-group { display: flex; align-items: center; gap: .4rem; }
        .pipeline-node { border: 1px solid rgba(255,255,255,.12); border-radius: .8rem; background: rgba(15,23,42,.5); color: inherit; padding: .7rem; width: 100%; text-align: left; display: grid; }
        .pipeline-node.running { box-shadow: 0 0 28px rgba(34, 211, 238, .28); border-color: #22d3ee; }
        .pipeline-node.completed { box-shadow: 0 0 20px rgba(34, 197, 94, .22); border-color: #22c55e; }
        .edge { width: 42px; height: 2px; background: linear-gradient(90deg, #22d3ee, transparent); animation: pulse 1.8s infinite; }
        @keyframes pulse { 50% { opacity: .35; } }
        .aggregator-score { padding: 1rem; text-align: center; }
        .score-ring { width: 120px; height: 120px; margin: .6rem auto 1rem; border-radius: 50%; border: 8px solid rgba(34,211,238,.45); display: grid; place-items: center; font-size: 2rem; box-shadow: 0 0 30px rgba(124, 58, 237, .35); }
        .recommendations { padding-left: 1rem; }
        .soft-progress { background: rgba(15, 23, 42, .7); }
        .soft-progress .progress-bar { background: linear-gradient(90deg, #22d3ee, #7c3aed); }
        .log-panel { padding: 1rem; display: grid; gap: .4rem; }
        .log-panel code { color: #67e8f9; background: rgba(2,6,23,.7); padding: .45rem .6rem; border-radius: .5rem; }
        .agent-workbench { padding: 1rem; }
        .status-badge { padding: .3rem .7rem; border-radius: 999px; font-size: .75rem; }
        .status-badge.running { background: rgba(34, 211, 238, .15); color: #22d3ee; }
        .status-badge.idle { background: rgba(148,163,184,.2); color: #cbd5e1; }
        .status-badge.completed { background: rgba(34, 197, 94, .15); color: #86efac; }
        .stepper { display: grid; gap: .35rem; }
        .stepper span { padding: .4rem .6rem; border-radius: .5rem; background: rgba(30,41,59,.45); }
        .stepper .active { border: 1px solid rgba(34,211,238,.45); }
        .output-box { min-height: 130px; padding: .7rem; border: 1px dashed rgba(148,163,184,.5); border-radius: .7rem; color: #cbd5e1; }
        .neon-input { background-color: rgba(2,6,23,.58) !important; border-color: rgba(125,211,252,.36); color: inherit !important; }
        .badge-dot.running { color: #22d3ee; }
        .badge-dot.completed { color: #22c55e; }
        @media (max-width: 1100px) {
          .premium-sidebar { position: fixed; left: 0; top: 0; bottom: 0; }
          .main-content { margin-left: 110px; }
          .hero { flex-direction: column; align-items: stretch; }
          .hero-actions { flex-wrap: wrap; }
          .pipeline-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
