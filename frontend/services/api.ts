const DEFAULT_API_BASES = [
  "https://hiresense-backend-8zxz.onrender.com",
  "https://hiresense-backend-on61.onrender.com",
  "https://hiresense-backend.onrender.com",
  "https://hiresense-backend-75hd.onrender.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];
const BASE = process.env.NEXT_PUBLIC_API_URL;
const SELECTED_API_BASE_KEY = "hiresense.api.base";

const normalizeBase = (value?: string) => value?.trim().replace(/\/$/, "");
const isBrowser = () => typeof window !== "undefined";

const getRenderDerivedBackend = () => {
  if (!isBrowser()) return undefined;
  const { hostname } = window.location;
  if (!hostname.endsWith(".onrender.com")) return undefined;

  if (hostname.startsWith("hiresense-frontend")) {
    const suffixMatch = hostname.match(/^hiresense-frontend-([^.]+)\.onrender\.com$/);
    if (suffixMatch?.[1]) {
      return `https://hiresense-backend-${suffixMatch[1]}.onrender.com`;
    }
    return "https://hiresense-backend.onrender.com";
  }

  return undefined;
};

const getPersistedApiBase = () => {
  if (!isBrowser()) return undefined;
  return normalizeBase(window.sessionStorage.getItem(SELECTED_API_BASE_KEY) || undefined);
};

const persistApiBase = (apiBase: string) => {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(SELECTED_API_BASE_KEY, apiBase);
};

const getApiBaseCandidates = (fallbackBase?: string) => {
  const candidates = [
    normalizeBase(fallbackBase),
    getPersistedApiBase(),
    normalizeBase(BASE),
    normalizeBase(getRenderDerivedBackend()),
    ...DEFAULT_API_BASES,
  ];
  return Array.from(new Set(candidates.filter((item): item is string => Boolean(item))));
};

const resolveApiBase = (fallbackBase?: string) => {
  const [firstCandidate] = getApiBaseCandidates(fallbackBase);
  return firstCandidate || DEFAULT_API_BASES[0];
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

export type LinkedInErpAnalyzePayload = {
  keyword: string;
  location: string;
  window?: LinkedInWindow;
  limit?: number;
  offset?: number;
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
  const apiBases = getApiBaseCandidates();
  let res: Response | null = null;

  for (const apiBase of apiBases) {
    const targetUrl = payload ? `${apiBase}/run` : `${apiBase}/run?company=${companyUrl}`;
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
      persistApiBase(apiBase);
      break;
    } catch {
      // Try the next configured backend base.
    }
  }

  if (!res) {
    throw new Error(
      `Unable to reach backend. Tried: ${apiBases.join(", ")}. Set NEXT_PUBLIC_API_URL to your backend (e.g. http://localhost:8000).`
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

export const exportLinkedInErpAnalyzedCsv = async (payload: LinkedInErpAnalyzePayload, fallbackBase?: string) => {
  const apiBase = resolveApiBase(fallbackBase);
  let res: Response;
  try {
    res = await fetch(`${apiBase}/linkedin/jobs/erp-analyzed-csv`, {
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
    throw new Error(errorBody || "LinkedIn ERP analyzed CSV export failed");
  }

  return res.blob();
};

export type NaukriRunPayload = {
  keywords: string[];
  experience?: string;
  locations: string[];
  companies?: string[];
  time_filter: "24h" | "7d" | "30d";
  seniority_filter?: string[];
  function_filter?: string[];
  historical_window?: number;
  max_pages?: number;
  remove_consultancy_duplicates?: boolean;
  exclude_irrelevant_roles?: boolean;
};

export type NaukriStatusResponse = {
  status: "idle" | "running" | "completed" | "error";
  message: string;
  error?: string | null;
  updated_at?: string | null;
};

export type IntentAnalyzeInput = {
  job_title: string;
  job_description: string;
  company_name: string;
  historical_job_count: number;
};

export type IntentAnalyzeResult = {
  company_name: string;
  intent_categories: string[];
  intent_type: "Implementation" | "Migration" | "Optimization" | "Unknown";
  intent_score: "Low" | "Medium" | "High";
  reasoning: string;
};

export type TechEvidence = {
  tool: string;
  evidence_sentence: string;
  source_url: string;
};

export type TechStackResponse = {
  company_name: string;
  erp_stack: string[];
  crm_stack: string[];
  cloud_stack: string[];
  data_stack: string[];
  testing_tools: string[];
  evidence_sources: TechEvidence[];
};

export type TechStackPayload = {
  company_name: string;
  company_website: string;
  job_data?: string;
};

export const analyzeIntent = async (payload: IntentAnalyzeInput) => {
  const apiBase = resolveApiBase();
  const res = await fetch(`${apiBase}/analyze-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || "Intent analysis failed");
  }
  return data as { results: IntentAnalyzeResult[] };
};

export const analyzeIntentCsv = async (file: File) => {
  const apiBase = resolveApiBase();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${apiBase}/analyze-intent`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || "CSV intent analysis failed");
  }
  return data as { results: IntentAnalyzeResult[] };
};

export const runNaukriAgent = async (payload: NaukriRunPayload, fallbackBase?: string) => {
  const apiBases = getApiBaseCandidates(fallbackBase);
  let lastError: Error | null = null;

  for (const apiBase of apiBases) {
    try {
      const res = await fetch(`${apiBase}/naukri/run-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      persistApiBase(apiBase);

      if (!res.ok) {
        const parsed = await parseApiResponse(res);
        const detail = parsed.data && typeof parsed.data === "object" && "detail" in (parsed.data as Record<string, unknown>)
          ? (parsed.data as { detail: unknown }).detail
          : parsed.data;
        const message =
          typeof detail === "string"
            ? detail
            : typeof parsed.data === "string"
              ? parsed.data
              : "Naukri run failed before returning results.";
        const error = new Error(message) as Error & { rows?: Record<string, unknown>[] };
        if (Array.isArray(detail)) error.rows = detail as Record<string, unknown>[];
        throw error;
      }

      return res.json();
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error(`Unable to reach backend. Tried: ${apiBases.join(", ")}`);
};

export const getNaukriStatus = async (fallbackBase?: string): Promise<NaukriStatusResponse> => {
  const apiBase = resolveApiBase(fallbackBase);
  const res = await fetch(`${apiBase}/naukri/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getNaukriResults = async (fallbackBase?: string) => {
  const apiBase = resolveApiBase(fallbackBase);
  const res = await fetch(`${apiBase}/naukri/results`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const downloadNaukriCsv = async (fallbackBase?: string) => {
  const apiBase = resolveApiBase(fallbackBase);
  const res = await fetch(`${apiBase}/naukri/download`);
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
};

export const detectTechStack = async (payload: TechStackPayload, fallbackBase?: string) => {
  const apiBase = resolveApiBase(fallbackBase);
  const res = await fetch(`${apiBase}/detect-tech-stack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseApiResponse(res);
  if (!res.ok) {
    const detail =
      parsed.data && typeof parsed.data === "object" && "detail" in (parsed.data as Record<string, unknown>)
        ? (parsed.data as { detail: unknown }).detail
        : parsed.data;
    throw new Error(typeof detail === "string" ? detail : "Tech stack detection failed");
  }
  return parsed.data as TechStackResponse;
};
