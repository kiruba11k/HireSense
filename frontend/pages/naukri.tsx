import Head from "next/head";
import { useCallback } from "react";

import NaukriAgent from "../components/NaukriAgent";

export default function NaukriPage() {
  const goToDashboard = useCallback(() => {
    window.location.href = "https://hiresense-frontend-on61.onrender.com/";
  }, []);

  return (
    <>
      <Head>
        <title>HireSense • Naukri Agent</title>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
      </Head>
      <main style={{ minHeight: "100vh", background: "#0F172A" }}>
        <div className="container pt-4">
          <button type="button" onClick={goToDashboard} className="btn btn-outline-light btn-sm">
            ← Back to Main Dashboard
          </button>
        </div>
        <NaukriAgent />
      </main>
    </>
  );
}
