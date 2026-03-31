import { motion } from "../lib/framer-motion";
import { IntentAnalyzeResult } from "../services/api";

type Props = {
  result: IntentAnalyzeResult;
};

const categoryColor: Record<string, string> = {
  ERP: "#a78bfa",
  Cloud: "#22d3ee",
  Data: "#60a5fa",
  Security: "#f472b6",
  QA: "#f59e0b",
  AI: "#34d399",
};

const scoreClass: Record<string, string> = {
  Low: "secondary",
  Medium: "warning",
  High: "success",
};

export default function ResultCard({ result }: Props) {
  const badgeClass = scoreClass[result.intent_score] || "secondary";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="glass-card p-4 h-100"
    >
      <h5 className="text-white mb-1">{result.company_name}</h5>
      <p className="text-info mb-3">Intent Type: {result.intent_type}</p>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {result.intent_categories?.map((category) => (
          <span
            key={category}
            className="badge"
            style={{ backgroundColor: categoryColor[category] || "#64748b" }}
          >
            {category}
          </span>
        ))}
      </div>

      <div className="mb-3">
        <span className={`badge text-bg-${badgeClass}`}>{result.intent_score}</span>
      </div>

      <div className="reason-box p-3 text-light small">{result.reasoning}</div>

      <style jsx>{`
        .reason-box {
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 12px;
          line-height: 1.4;
        }
      `}</style>
    </motion.div>
  );
}
