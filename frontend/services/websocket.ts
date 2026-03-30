export const connectWS = (taskId: string, onMessage: any) => {
  const explicitWsBase = process.env.NEXT_PUBLIC_WS_URL;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "https://hiresense-backend-75hd.onrender.com").trim().replace(/\/$/, "");
  const derivedWsBase = apiBase.startsWith("https://")
    ? apiBase.replace("https://", "wss://")
    : apiBase.replace("http://", "ws://");
  const wsBase = explicitWsBase || derivedWsBase;
  const ws = new WebSocket(`${wsBase.replace(/\/$/, "")}/ws/${taskId}`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    onMessage(msg);
  };

  ws.onerror = () => console.error("WebSocket error");

  return ws;
};
