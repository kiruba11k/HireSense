export const connectWS = (taskId: string, onMessage: any) => {
  const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/ws/${taskId}`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    onMessage(msg);
  };

  ws.onerror = () => console.error("WebSocket error");

  return ws;
};
