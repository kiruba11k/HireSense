import { FormEvent, useState } from "react";

export type ManualIntentInput = {
  company_name: string;
  job_title: string;
  job_description: string;
  historical_job_count: number;
};

type Props = {
  onAnalyze: (data: ManualIntentInput) => void;
  disabled?: boolean;
};

const initialState: ManualIntentInput = {
  company_name: "",
  job_title: "",
  job_description: "",
  historical_job_count: 0,
};

export default function IntentForm({ onAnalyze, disabled }: Props) {
  const [formData, setFormData] = useState<ManualIntentInput>(initialState);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAnalyze(formData);
  };

  return (
    <form className="glass-card p-4" onSubmit={submit}>
      <div className="mb-3">
        <label className="form-label text-light">Company Name</label>
        <input
          className="form-control"
          value={formData.company_name}
          onChange={(e) => setFormData((prev) => ({ ...prev, company_name: e.target.value }))}
          required
        />
      </div>
      <div className="mb-3">
        <label className="form-label text-light">Job Title</label>
        <input
          className="form-control"
          value={formData.job_title}
          onChange={(e) => setFormData((prev) => ({ ...prev, job_title: e.target.value }))}
          required
        />
      </div>
      <div className="mb-3">
        <label className="form-label text-light">Job Description</label>
        <textarea
          className="form-control"
          rows={5}
          value={formData.job_description}
          onChange={(e) => setFormData((prev) => ({ ...prev, job_description: e.target.value }))}
          required
        />
      </div>
      <div className="mb-4">
        <label className="form-label text-light">Historical Job Count</label>
        <input
          className="form-control"
          type="number"
          min={0}
          value={formData.historical_job_count}
          onChange={(e) => setFormData((prev) => ({ ...prev, historical_job_count: Number(e.target.value) }))}
          required
        />
      </div>
      <div className="d-flex gap-2">
        <button disabled={disabled} className="btn btn-primary px-4 hover-up" type="submit">
          Analyze Intent
        </button>
        <button
          disabled={disabled}
          className="btn btn-outline-light px-4 hover-up"
          type="button"
          onClick={() => setFormData(initialState)}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
