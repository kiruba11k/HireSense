import { motion } from "framer-motion";

export type IntentResult = {
  company_name: string;
  intent_categories: string[];
  intent_type: string;
  intent_score: "Low" | "Medium" | "High" | string;
  reasoning: string;
};

const categoryClass: Record<string, string> = {
  ERP: "bg-primary-subtle text-primary-emphasis",
  Cloud: "bg-info-subtle text-info-emphasis",
  Data: "bg-success-subtle text-success-emphasis",
  Security: "bg-danger-subtle text-danger-emphasis",
  QA: "bg-warning-subtle text-warning-emphasis",
  AI: "bg-secondary-subtle text-secondary-emphasis",
};

const scoreClass: Record<string, string> = {
  Low: "bg-secondary",
  Medium: "bg-warning text-dark",
  High: "bg-success",
};

export default function ResultCard({ result, index }: { result: IntentResult; index: number }) {
  return (
    <motion.div
      className="glass-card h-100 p-4"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      whileHover={{ y: -4 }}
    >
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <h5 className="text-white mb-0">{result.company_name}</h5>
        <span className={`badge ${scoreClass[result.intent_score] || "bg-secondary"}`}>{result.intent_score}</span>
      </div>

      <div className="mb-3">
        <p className="small text-light-emphasis mb-2">Intent Categories</p>
        <div className="d-flex flex-wrap gap-2">
          {result.intent_categories?.map((category) => (
            <span key={category} className={`badge rounded-pill ${categoryClass[category] || "bg-light text-dark"}`}>
              {category}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <p className="small text-light-emphasis mb-1">Intent Type</p>
        <span className="text-white fw-semibold">{result.intent_type || "Unknown"}</span>
      </div>

      <div className="reasoning-box">
        <p className="small text-light-emphasis mb-1">Reasoning</p>
        <p className="mb-0 text-white-50">{result.reasoning}</p>
      </div>
    </motion.div>
  );
}
