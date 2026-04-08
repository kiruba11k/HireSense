import Link from "next/link";
import Head from "next/head";
import { motion } from "framer-motion";

export default function DashboardPage() {
  return (
    <div className="container py-5" style={{ color: "#3D322D" }}>
      <Head>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
      </Head>
      <style jsx global>{`
        body { background: #F4F3EE; }
        .glass-tile { background: #FAF9F5; border: 1px solid #D8D2C6; border-radius: 20px; }
      `}</style>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-tile p-5 shadow-lg">
        <h1>Intent Dashboard</h1>
        <p>Analyze job posting text into enterprise hiring intent signals.</p>
        <Link href="/upload" className="btn" style={{ background: "#C15F3C", color: "#fff" }}>Go to Analyzer</Link>
      </motion.div>
    </div>
  );
}
