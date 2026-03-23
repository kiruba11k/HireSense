export default function JobCard({ job }) {
  return (
    <div className="job-card">
      <h3>{job.title || "Untitled role"}</h3>
      <p className="meta">{job.company || "Unknown company"} • {job.location || "Unknown location"}</p>
      <p className="intent">Intent: {job.intent || "pending"}</p>
      <p className="source">Source: {job.source || "unknown"}</p>

      <style jsx>{`
        .job-card {
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: 14px;
          transform-style: preserve-3d;
          transition: transform 220ms ease, box-shadow 220ms ease;
        }
        .job-card:hover {
          transform: rotateX(4deg) rotateY(-4deg) translateY(-2px);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
        }
        h3 { margin: 0 0 8px; }
        .meta { color: #c4b5fd; font-size: 12px; }
        .intent { color: #d1fae5; font-size: 12px; margin-top: 8px; }
        .source { color: #a5f3fc; font-size: 11px; margin-top: 4px; }
      `}</style>
    </div>
  );
}
