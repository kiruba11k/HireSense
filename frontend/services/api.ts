const BASE = process.env.NEXT_PUBLIC_API_URL;

export const startPipeline = async (company: string) => {
  const res = await fetch(`${BASE}/run?company=${company}`, { method: "POST" });
  return res.json();
};
