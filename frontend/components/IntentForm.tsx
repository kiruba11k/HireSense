import { FormEvent, useState } from "react";

export type ManualIntentInput = {
  company_name: string;
  job_title: string;
  job_description: string;
  historical_job_count: number;
};

const defaultForm: ManualIntentInput = {
  company_name: "",
  job_title: "",
  job_description: "",
  historical_job_count: 0,
};

export default function IntentForm({
  onSubmit,
  loading,
}: {
  onSubmit: (payload: ManualIntentInput) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState<ManualIntentInput>(defaultForm);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-4">
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label text-light">Company Name</label>
          <input
            className="form-control glass-input"
            value={form.company_name}
            onChange={(event) => setForm((prev) => ({ ...prev, company_name: event.target.value }))}
            placeholder="Acme Corp"
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label text-light">Job Title</label>
          <input
            className="form-control glass-input"
            value={form.job_title}
            onChange={(event) => setForm((prev) => ({ ...prev, job_title: event.target.value }))}
            placeholder="AWS Cloud Engineer"
          />
        </div>

        <div className="col-12">
          <label className="form-label text-light">Job Description</label>
          <textarea
            className="form-control glass-input"
            rows={6}
            value={form.job_description}
            onChange={(event) => setForm((prev) => ({ ...prev, job_description: event.target.value }))}
            placeholder="Looking for AWS migration expert..."
          />
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label text-light">Historical Job Count</label>
          <input
            type="number"
            min={0}
            className="form-control glass-input"
            value={form.historical_job_count}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, historical_job_count: Number(event.target.value || 0) }))
            }
          />
        </div>
      </div>

      <div className="d-flex gap-2 mt-4">
        <button className="btn btn-primary px-4 btn-animated" type="submit" disabled={loading}>
          Analyze Intent
        </button>
        <button
          className="btn btn-outline-light px-4 btn-animated"
          type="button"
          onClick={() => setForm(defaultForm)}
          disabled={loading}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
