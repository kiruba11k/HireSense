import Head from "next/head";
import { motion } from "framer-motion";

export default function DashboardPage() {
  return (
    <div className="container py-5 text-light">
      <Head>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
      </Head>
      <style jsx global>{`
        body { background: linear-gradient(135deg, #0f172a, #1e293b); }
        .glass-tile { background: rgba(255,255,255,0.08); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.18); border-radius: 20px; }
      `}</style>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-tile p-5 shadow-lg">
        <h1>Intent Dashboard</h1>
        <p>Track multi-agent enterprise hiring signals in one place.</p>
      </motion.div>
    </div>
  );
}
