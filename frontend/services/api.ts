const BASE = process.env.NEXT_PUBLIC_API_URL;

export const startPipeline = async (companyUrl: string) => {
  const res = await fetch(`${BASE}/run?company=${companyUrl}`, {
    method: "POST",
  });
  return res.json();
};

export const getResults = async (taskId: string) => {
  const res = await fetch(`${BASE}/results/${taskId}`);
  return res.json();
};
