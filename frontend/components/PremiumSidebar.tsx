import { Dispatch, SetStateAction, useMemo, useState } from "react";

type Props = {
  activeView: string;
  setActiveView: Dispatch<SetStateAction<string>>;
  agents: { id: string; name: string; icon: string; status: string }[];
};

export default function PremiumSidebar({ activeView, setActiveView, agents }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = useMemo(
    () => [
      { id: "overview", label: "Overview", icon: "fa-chart-line" },
      { id: "pipeline", label: "Pipeline", icon: "fa-diagram-project" },
      { id: "aggregator", label: "Intent IQ", icon: "fa-bullseye" },
      { id: "activity", label: "Live Activity", icon: "fa-terminal" },
    ],
    []
  );

  return (
    <aside className={`premium-sidebar glass-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="brand-row">
        <div className="brand-mark">HS</div>
        {!collapsed && (
          <div>
            <h1>HireSense</h1>
            <p>Multi-Agent OS</p>
          </div>
        )}
        <button className="collapse-btn" onClick={() => setCollapsed((p) => !p)}>
          <i className={`fa-solid ${collapsed ? "fa-angle-right" : "fa-angle-left"}`} />
        </button>
      </div>

      <div className="section-label">Workspace</div>
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-btn ${activeView === item.id ? "active" : ""}`}
          onClick={() => setActiveView(item.id)}
          title={item.label}
        >
          <i className={`fa-solid ${item.icon}`} />
          {!collapsed && <span>{item.label}</span>}
        </button>
      ))}

      <div className="section-label">Agents</div>
      <div className="agent-list">
        {agents.map((agent) => (
          <button
            key={agent.id}
            className={`nav-btn ${activeView === agent.id ? "active" : ""}`}
            onClick={() => setActiveView(agent.id)}
            title={agent.name}
          >
            <i className={`fa-solid ${agent.icon}`} />
            {!collapsed && (
              <>
                <span>{agent.name}</span>
                <small className={`badge-dot ${agent.status.toLowerCase()}`}>{agent.status}</small>
              </>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}
