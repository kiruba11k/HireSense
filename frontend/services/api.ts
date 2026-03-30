const BASE = process.env.NEXT_PUBLIC_API_URL;

const resolveApiBase = (fallbackBase?: string) => {
  if (fallbackBase) return fallbackBase;
  if (BASE) return BASE;
  if (typeof window !== "undefined") return "https://hiresense-backend-75hd.onrender.com";
  return "https://hiresense-backend-75hd.onrender.com";
};

const parseApiResponse = async (res: Response) => {
  const raw = await res.text();
  const trimmed = raw.trim();
  const contentType = res.headers.get("content-type")?.toLowerCase() || "";
  const looksLikeHtml = trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");

  if (!trimmed) return { data: null, looksLikeHtml };

  if (contentType.includes("application/json") || (!looksLikeHtml && (trimmed.startsWith("{") || trimmed.startsWith("[")))) {
    try {
      return { data: JSON.parse(trimmed), looksLikeHtml: false };
    } catch {
      // fall through to return raw text
    }
  }

  return { data: raw, looksLikeHtml };
};

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

export type JobSearchPayload = {
  keywords: string[];
  locations: string[];
  experience_level?: string;
  company_list?: string[];
  time_filter: "24h" | "7d" | "30d";
  seniority_filter?: string[];
  function_filter?: string[];
  historical_window?: number;
  exclude_internships?: boolean;
};

export type Stage2RunPayload = {
  company_name: string;
  company_website?: string;
  jobs: JobSearchPayload;
};

export const startPipeline = async (companyUrl: string, payload?: Stage2RunPayload) => {
  const apiBase = resolveApiBase();
  const targetUrl = payload ? `${apiBase}/run` : `${apiBase}/run?company=${companyUrl}`;
  let res: Response;

  try {
    res = await fetch(targetUrl, {
      method: "POST",
      headers: payload
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch {
    throw new Error(
      `Unable to reach backend at ${apiBase}. Set NEXT_PUBLIC_API_URL to your backend (e.g. http://localhost:8000).`
    );
  }

  const { data, looksLikeHtml } = await parseApiResponse(res);
  if (!res.ok) {
    if (looksLikeHtml) {
      throw new Error(
        "Received HTML instead of JSON from /run. Set NEXT_PUBLIC_API_URL to your backend (e.g. http://localhost:8000)."
      );
    }
    if (data && typeof data === "object" && "detail" in data) {
      throw new Error(String((data as { detail: unknown }).detail));
    }
    throw new Error(typeof data === "string" && data ? data : "Pipeline start failed");
  }

  if (looksLikeHtml) {
    throw new Error(
      "Received HTML instead of JSON from /run. Set NEXT_PUBLIC_API_URL to your backend (e.g. http://localhost:8000)."
    );
  }

  return data;
};

export const getResults = async (taskId: string) => {
  const apiBase = resolveApiBase();
  const res = await fetch(`${apiBase}/results/${taskId}`);
  return res.json();
};

export const searchLinkedInJobs = async (payload: LinkedInSearchPayload, fallbackBase?: string) => {
  const apiBase = resolveApiBase(fallbackBase);
  let res: Response;
  try {
    res = await fetch(`${apiBase}/linkedin/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      `Unable to reach backend at ${apiBase}. Start the API server and set NEXT_PUBLIC_API_URL if needed.`
    );
  }

  const { data, looksLikeHtml } = await parseApiResponse(res);
  if (!res.ok) {
    if (looksLikeHtml) {
      throw new Error(
        "Received HTML instead of JSON from /linkedin/jobs. Set NEXT_PUBLIC_API_URL to your backend (e.g. http://localhost:8000)."
      );
    }
    if (data && typeof data === "object" && "detail" in data) {
      throw new Error(String((data as { detail: unknown }).detail));
    }
    throw new Error(typeof data === "string" && data ? data : "Failed to fetch jobs");
  }
  if (looksLikeHtml) {
    throw new Error(
      "Received HTML instead of JSON from /linkedin/jobs. Set NEXT_PUBLIC_API_URL to your backend (e.g. http://localhost:8000)."
    );
  }
  return data;
};

export const exportLinkedInJobsCsv = async (payload: LinkedInSearchPayload, fallbackBase?: string) => {
  const apiBase = resolveApiBase(fallbackBase);
  let res: Response;
  try {
    res = await fetch(`${apiBase}/linkedin/jobs/csv`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      `Unable to reach backend at ${apiBase}. Start the API server and set NEXT_PUBLIC_API_URL if needed.`
    );
  }

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(errorBody || "LinkedIn CSV export failed");
  }

  return res.blob();
};
