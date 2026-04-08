import Head from "next/head";
import { useCallback } from "react";
import { useRouter } from "next/router";

import NaukriAgent from "../components/NaukriAgent";

const DASHBOARD_STATE_KEY = "hiresense.dashboard.state";

export default function NaukriPage() {
  const router = useRouter();

  const goToDashboard = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const persisted = window.sessionStorage.getItem(DASHBOARD_STATE_KEY);
        const parsed = persisted ? JSON.parse(persisted) : {};
        window.sessionStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify({ ...parsed, activeView: "overview" }));
      } catch {
        window.sessionStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify({ activeView: "overview" }));
      }
    }
    router.push("/");
  }, [router]);

  return (
    <>
      <Head>
        <title>HireSense • Naukri Agent</title>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
      </Head>
      <main style={{ minHeight: "100vh", background: "#F4F3EE", color: "#3D322D" }}>
        <div className="container pt-3 pt-md-4">
          <button type="button" onClick={goToDashboard} className="btn btn-sm" style={{ borderColor: "#C15F3C", color: "#A14A2F" }}>
            ← Back to Main Dashboard
          </button>
        </div>
        <NaukriAgent />
      </main>
    </>
  );
}
