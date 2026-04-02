import { FormEvent, KeyboardEvent, useMemo, useState } from "react";

import { NaukriRunPayload } from "../services/api";

type Props = {
  onRun: (payload: NaukriRunPayload) => Promise<void>;
  loading: boolean;
};

type ChipsInputProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  optional?: boolean;
};

const seniorityOptions = ["Entry", "Associate", "Mid-Senior", "Executive"];
const functionOptions = ["IT", "Technology", "Finance", "Operations", "Procurement", "Digital Transformation"];

function ChipsInput({ label, values, onChange, placeholder, optional }: ChipsInputProps) {
  const [draft, setDraft] = useState("");

  const addChip = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (values.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addChip(draft);
    }
    if (event.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div>
      <label className="form-label text-info">{label}{optional ? " (optional)" : ""}</label>
      <div className="form-control bg-dark text-light border-info d-flex flex-wrap gap-2" style={{ minHeight: 44 }}>
        {values.map((value) => (
          <span key={value} className="badge bg-info text-dark d-inline-flex align-items-center gap-1">
            {value}
            <button type="button" className="btn btn-sm p-0 border-0" onClick={() => onChange(values.filter((item) => item !== value))}>×</button>
          </span>
        ))}
        <input
          className="bg-transparent border-0 text-light flex-grow-1"
          style={{ minWidth: 180, outline: "none" }}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addChip(draft)}
        />
      </div>
      <small className="text-secondary">Press Enter to add each value.</small>
    </div>
  );
}

export default function SearchForm({ onRun, loading }: Props) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [experience, setExperience] = useState("2-5");
  const [locations, setLocations] = useState(["Bangalore", "Hyderabad"]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [seniorityFilter, setSeniorityFilter] = useState<string[]>([]);
  const [functionFilter, setFunctionFilter] = useState<string[]>(["Technology", "IT"]);
  const [timeFilter, setTimeFilter] = useState<"24h" | "7d" | "30d">("7d");
  const [historicalWindow, setHistoricalWindow] = useState(30);
  const [maxPages, setMaxPages] = useState(3);
  const [removeConsultancies, setRemoveConsultancies] = useState(true);
  const [excludeIrrelevant, setExcludeIrrelevant] = useState(true);

  const hasInputValues = useMemo(() => keywords.length > 0 && locations.length > 0, [keywords, locations]);
  const naukriUrlPreview = useMemo(() => {
    const normalizedKeywords = keywords
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    const normalizedLocations = locations
      .map((location) => location.trim())
      .filter(Boolean);
    const normalizedCompanies = companies
      .map((company) => company.trim())
      .filter(Boolean);

    const keywordPath = (normalizedKeywords.join(" ") || "developer").toLowerCase().replace(/\s+/g, "-");
    const locationPath = (normalizedLocations[0] || "india").toLowerCase().replace(/\s+/g, "-");
    const query = new URLSearchParams({
      k: normalizedKeywords.join(", "),
      l: normalizedLocations.join(", "),
      experience,
      freshness: timeFilter === "24h" ? "1" : timeFilter === "30d" ? "30" : "7",
      history: String(historicalWindow),
      nignbevent_src: "jobsearchDeskGNB",
    });

    if (normalizedCompanies.length) query.set("company", normalizedCompanies.join(", "));
    if (functionFilter.length) query.set("functionArea", functionFilter.join(", "));
    if (seniorityFilter.length) query.set("seniority", seniorityFilter.join(", "));
    return `https://www.naukri.com/${keywordPath}-jobs-in-${locationPath}?${query.toString()}`;
  }, [keywords, locations, companies, experience, timeFilter, historicalWindow, functionFilter, seniorityFilter, maxPages]);
  const hasValidNaukriUrlPreview = useMemo(
    () => /^https:\/\/www\.naukri\.com\/[a-z0-9-]+-jobs-in-[a-z0-9-]+(\?.+)?$/i.test(naukriUrlPreview),
    [naukriUrlPreview]
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasInputValues || !hasValidNaukriUrlPreview) return;
    await onRun({
      keywords,
      experience,
      locations,
      companies,
      time_filter: timeFilter,
      seniority_filter: seniorityFilter,
      function_filter: functionFilter,
      historical_window: historicalWindow,
      max_pages: maxPages,
      remove_consultancy_duplicates: removeConsultancies,
      exclude_irrelevant_roles: excludeIrrelevant,
    });
  };

  return (
    <form onSubmit={submit} className="row g-3">
      <div className="col-12">
        <ChipsInput label="Keywords" values={keywords} onChange={setKeywords} placeholder="Add keyword and press Enter" />
      </div>
      <div className="col-md-3">
        <label className="form-label text-info">Experience Level</label>
        <select className="form-select bg-dark text-light border-info" value={experience} onChange={(e) => setExperience(e.target.value)}>
          <option value="0-2">0-2 years</option>
          <option value="2-5">2-5 years</option>
          <option value="5-10">5-10 years</option>
          <option value="10+">10+ years</option>
        </select>
      </div>
      <div className="col-md-3">
        <label className="form-label text-info">Time Filter</label>
        <select className="form-select bg-dark text-light border-info" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as "24h" | "7d" | "30d") }>
          <option value="24h">24 hours</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
        </select>
      </div>
      <div className="col-md-3">
        <label className="form-label text-info">Historical Window (days)</label>
        <input type="number" min={1} max={180} className="form-control bg-dark text-light border-info" value={historicalWindow} onChange={(e) => setHistoricalWindow(Number(e.target.value) || 30)} />
      </div>
      <div className="col-md-3">
        <label className="form-label text-info">Max Pages to Scrape</label>
        <input type="number" min={1} max={25} className="form-control bg-dark text-light border-info" value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value) || 3)} />
        <small className="text-secondary">Used to append pageNo in Naukri search links.</small>
      </div>
      <div className="col-12">
        <label className="form-label text-info">Generated Naukri URL Preview</label>
        <input
          className={`form-control bg-dark text-light ${hasValidNaukriUrlPreview ? "border-success" : "border-danger"}`}
          value={naukriUrlPreview}
          readOnly
        />
        <small className={hasValidNaukriUrlPreview ? "text-success" : "text-danger"}>
          {hasValidNaukriUrlPreview ? "Valid Naukri URL format." : "Invalid URL format. Update keywords/location values."}
        </small>
        <small className="d-block text-secondary mt-1">
          Preview includes only broad search params (keyword, location, experience, freshness, company, function, seniority). Advanced Naukri UI filters are not fully encoded in URL query params.
        </small>
      </div>
      <div className="col-md-3">
        <label className="form-label text-info">Seniority Filter</label>
        <select
          className="form-select text-light border-info"
          style={{ background: "linear-gradient(145deg, rgba(56,189,248,.25), rgba(14,116,144,.3)), #0b1220", boxShadow: "0 0 0 1px rgba(125,211,252,.2) inset" }}
          multiple
          value={seniorityFilter}
          onChange={(e) => setSeniorityFilter(Array.from(e.target.selectedOptions, (option) => option.value))}
        >
          {seniorityOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <small className="text-info-emphasis">Use Ctrl/Cmd + click to select multiple levels.</small>
      </div>
      <div className="col-12">
        <ChipsInput label="Locations" values={locations} onChange={setLocations} placeholder="Add city and press Enter" />
      </div>
      <div className="col-12">
        <ChipsInput label="Company List" optional values={companies} onChange={setCompanies} placeholder="Optional: add companies" />
      </div>
      <div className="col-md-6">
        <label className="form-label text-info">Function Filter</label>
        <select
          className="form-select text-light border-info"
          style={{ background: "linear-gradient(145deg, rgba(34,197,94,.25), rgba(20,83,45,.3)), #0b1220", boxShadow: "0 0 0 1px rgba(74,222,128,.2) inset" }}
          multiple
          value={functionFilter}
          onChange={(e) => setFunctionFilter(Array.from(e.target.selectedOptions, (option) => option.value))}
        >
          {functionOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <small className="text-success">Multi-select enabled for broader matching.</small>
      </div>
      <div className="col-md-6 d-flex align-items-end gap-4">
        <div className="form-check">
          <input className="form-check-input" type="checkbox" checked={removeConsultancies} onChange={(e) => setRemoveConsultancies(e.target.checked)} id="remove-consultancies" />
          <label className="form-check-label" htmlFor="remove-consultancies">Remove consultancy duplicates</label>
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" checked={excludeIrrelevant} onChange={(e) => setExcludeIrrelevant(e.target.checked)} id="exclude-irrelevant" />
          <label className="form-check-label" htmlFor="exclude-irrelevant">Exclude irrelevant roles</label>
        </div>
      </div>
      <div className="col-12 d-flex justify-content-end">
        <button type="submit" className="btn btn-info px-4" disabled={loading || !hasInputValues || !hasValidNaukriUrlPreview}>
          {loading ? "Running..." : "Run Naukri Agent"}
        </button>
      </div>
    </form>
  );
}
