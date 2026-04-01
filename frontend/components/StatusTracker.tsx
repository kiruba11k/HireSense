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
      className="p-3 rounded-4 border border-info-subtle"
      style={{ background: "rgba(30,41,59,0.7)", backdropFilter: "blur(12px)" }}
    >
      <div className="d-flex align-items-center gap-2">
        <span className={`badge ${status === "error" ? "text-bg-danger" : status === "completed" ? "text-bg-success" : "text-bg-info"}`}>{status}</span>
        {pulse && <span className="spinner-border spinner-border-sm text-info" />}
      </div>
      <p className="text-light mt-2 mb-0">{message}</p>
    </motion.div>
  );
}
