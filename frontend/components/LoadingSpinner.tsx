import { motion } from "../lib/framer-motion";

export default function LoadingSpinner() {
  return (
    <div className="glass-card p-4 text-center">
      <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
        <motion.div
          className="spinner-ring"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
        />
      </div>
      <div className="text-light fw-semibold">
        Analyzing hiring intent
        <motion.span
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        >
          ...
        </motion.span>
      </div>
      <style jsx>{`
        .spinner-ring {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 3px solid rgba(255, 255, 255, 0.25);
          border-top-color: #06b6d4;
        }
      `}</style>
    </div>
  );
}
