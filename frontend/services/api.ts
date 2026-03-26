const BASE = process.env.NEXT_PUBLIC_API_URL;

export type LinkedInWindow = "24h" | "7d" | "6m";

export type LinkedInSearchPayload = {
  window: LinkedInWindow;
  limit: number;
  offset: number;
  title_filter?: string;
  advanced_title_filter?: string;
  location_filter?: string;
  organization_filter?: string;
  organization_slug_filter?: string;
  description_filter?: string;
  type_filter?: string | string[];
  remote?: boolean;
  seniority_filter?: string | string[];
  industry_filter?: string | string[];
  include_ai?: boolean;
  ai_work_arrangement_filter?: string | string[];
  ai_experience_level_filter?: string | string[];
  ai_taxonomies_a_filter?: string | string[];
  ai_has_salary?: boolean;
  date_filter?: string;
  order?: string;
  external_apply_url?: boolean;
  directapply?: boolean;
  employees_lte?: number;
  employees_gte?: number;
  agency?: boolean;
  description_type?: "text" | "html";
  extra_query_params?: Record<string, string | number | boolean>;
};

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

export const searchLinkedInJobs = async (payload: LinkedInSearchPayload, fallbackBase?: string) => {
  const apiBase = fallbackBase || BASE;
  const res = await fetch(`${apiBase}/linkedin/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(errorBody || "LinkedIn search failed");
  }

  return res.json();
};

export const exportLinkedInJobsCsv = async (payload: LinkedInSearchPayload, fallbackBase?: string) => {
  const apiBase = fallbackBase || BASE;
  const res = await fetch(`${apiBase}/linkedin/jobs/csv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(errorBody || "LinkedIn CSV export failed");
  }

  return res.blob();
};
