import { motion } from "framer-motion";

export default function LoadingSpinner() {
  return (
    <motion.div
      className="glass-card p-4 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="spinner-border text-info mb-3" role="status" aria-hidden="true" />
      <p className="mb-0 text-light fw-semibold">
        Analyzing hiring intent
        <span className="dot-flash">...</span>
      </p>
    </motion.div>
  );
}
