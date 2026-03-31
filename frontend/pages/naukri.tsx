import Head from "next/head";
import NaukriAgent from "../components/NaukriAgent";

export default function NaukriPage() {
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
        <NaukriAgent />
      </main>
    </>
  );
}
