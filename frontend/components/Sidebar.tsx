export default function Sidebar({ setTab }) {
  const tabs = ["overview", "jobs", "tech", "news", "score"];

  return (
    <div className="bg-black/60 w-full md:w-64 p-6 text-white">
      <h1 className="text-2xl font-bold text-purple-400 mb-6">
        HireSense AI
      </h1>

      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className="block w-full text-left py-2 hover:text-purple-400"
        >
          {t.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
