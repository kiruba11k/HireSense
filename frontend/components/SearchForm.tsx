import { FormEvent, useMemo, useState } from "react";

import { NaukriRunPayload } from "../services/api";

type Props = {
  onRun: (payload: NaukriRunPayload) => Promise<void>;
  loading: boolean;
};

const parseMulti = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export default function SearchForm({ onRun, loading }: Props) {
  const [keywords, setKeywords] = useState("ERP, SAP, Cloud, QA, Data, AI");
  const [experience, setExperience] = useState("2-5");
  const [locations, setLocations] = useState("Bangalore, Hyderabad");
  const [companies, setCompanies] = useState("");
  const [timeFilter, setTimeFilter] = useState<"24h" | "7d" | "30d">("7d");

  const canSubmit = useMemo(() => parseMulti(keywords).length > 0 && parseMulti(locations).length > 0, [keywords, locations]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    await onRun({
      keywords: parseMulti(keywords),
      experience,
      locations: parseMulti(locations),
      companies: parseMulti(companies),
      time_filter: timeFilter,
    });
  };

  return (
    <form onSubmit={submit} className="row g-3">
      <div className="col-md-6">
        <label className="form-label text-info">Keywords (comma separated)</label>
        <input className="form-control bg-dark text-light border-info" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
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
        <select className="form-select bg-dark text-light border-info" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as "24h" | "7d" | "30d")}>
          <option value="24h">24 hours</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
        </select>
      </div>
      <div className="col-md-6">
        <label className="form-label text-info">Locations (comma separated)</label>
        <input className="form-control bg-dark text-light border-info" value={locations} onChange={(e) => setLocations(e.target.value)} />
      </div>
      <div className="col-md-6">
        <label className="form-label text-info">Company List (optional)</label>
        <input className="form-control bg-dark text-light border-info" value={companies} onChange={(e) => setCompanies(e.target.value)} />
      </div>
      <div className="col-12 d-flex justify-content-end">
        <button type="submit" className="btn btn-info px-4" disabled={loading || !canSubmit}>
          {loading ? "Running..." : "Run Naukri Agent"}
        </button>
      </div>
    </form>
  );
}
