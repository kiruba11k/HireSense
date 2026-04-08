import { motion } from "framer-motion";

type Props = {
  status: string;
  message: string;
};

export default function StatusTracker({ status, message }: Props) {
  const pulse = status === "running";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-4"
      style={{ background: "var(--surface-soft, #f4f3ee)", border: "1px solid var(--border-color, #d8d2c6)" }}
    >
      <div className="d-flex align-items-center gap-2">
        <span className={`badge ${status === "error" ? "text-bg-danger" : status === "completed" ? "text-bg-success" : "text-bg-info"}`}>{status}</span>
        {pulse && <span className="spinner-border spinner-border-sm text-info" />}
      </div>
      <p className="mt-2 mb-0" style={{ color: "var(--text-color, #3d322d)" }}>{message}</p>
    </motion.div>
  );
}
