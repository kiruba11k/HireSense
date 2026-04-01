import { motion } from "framer-motion";

type Job = {
  [key: string]: unknown;
};

type Props = {
  rows: Job[];
};

export default function ResultsTable({ rows }: Props) {
  const preferredColumns = [
    "job_title",
    "company_name",
    "experience_range",
    "salary",
    "location",
    "source_url",
    "role_responsibilities",
    "key_skills",
    "page",
    "posted_date",
    "source",
  ];

  const toTitle = (value: string) =>
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());

  const formatValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const dynamicColumns = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row || {}).forEach((key) => acc.add(key));
      return acc;
    }, new Set<string>())
  ).sort((a, b) => {
    const ai = preferredColumns.indexOf(a);
    const bi = preferredColumns.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="table-responsive mt-3">
      <table className="table table-dark table-striped align-middle">
        <thead>
          <tr>
            {dynamicColumns.map((column) => (
              <th key={column}>{toTitle(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.job_id ?? row.source_url ?? index)}>
              {dynamicColumns.map((column) => (
                <td key={`${String(row.job_id ?? index)}-${column}`}>{formatValue(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
