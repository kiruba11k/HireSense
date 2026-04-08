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
          background: #faf9f5;
          border-right: 1px solid #d8d2c6;
          z-index: 1;
        }
        h1 {
          color: #c15f3c;
          margin: 8px 0 16px;
        }
        button {
          width: 100%;
          text-align: left;
          background: #f4f3ee;
          border: 1px solid #d8d2c6;
          color: #3d322d;
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: transform 200ms ease, background 200ms ease;
        }
        button:hover {
          transform: translateX(4px);
          background: #ede5d7;
        }
      `}</style>
    </div>
  );
}
