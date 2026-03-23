import { useState } from "react";
import { startPipeline } from "../services/api";

export default function Page() {
  const [company, setCompany] = useState("");
  const [data, setData] = useState([]);

  const run = async () => {
    const res = await startPipeline(company);

    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/ws/${res.task_id}`);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === "progress") {
        setData(prev => [...prev, msg.data]);
      }
    };

    ws.onerror = () => {
      console.error("WS error");
    };
  };

  return (
    <div className="p-6">
      <input
        className="p-3 bg-black/40 rounded w-full md:w-1/2"
        onChange={(e) => setCompany(e.target.value)}
      />
      <button onClick={run} className="mt-4 bg-purple-600 px-6 py-3 rounded">
        Run
      </button>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {data.map((d, i) => (
          <div key={i} className="p-4 bg-black/40 rounded">
            {d.job.title}
          </div>
        ))}
      </div>
    </div>
  );
}
