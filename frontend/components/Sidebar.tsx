export default function Sidebar({ setTab }) {
  const tabs = ["overview", "jobs", "tech", "news", "signals", "score"];

  return (
    <div className="sidebar">
      <h1>HireSense AI</h1>

      {tabs.map((t) => (
        <button key={t} onClick={() => setTab(t)}>
          {t.toUpperCase()}
        </button>
      ))}

      <style jsx>{`
        .sidebar {
          width: min(280px, 100%);
          padding: 20px;
          background: rgba(4, 4, 8, 0.72);
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(8px);
          z-index: 1;
        }
        h1 {
          color: #c4b5fd;
          margin: 8px 0 16px;
        }
        button {
          width: 100%;
          text-align: left;
          background: rgba(109, 77, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: white;
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: transform 200ms ease, background 200ms ease;
        }
        button:hover {
          transform: translateX(4px);
          background: rgba(109, 77, 255, 0.28);
        }
      `}</style>
    </div>
  );
}
