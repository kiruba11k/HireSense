import { motion } from "framer-motion";

type Job = {
  [key: string]: unknown;
};

type Props = {
  rows: Job[];
};

export default function ResultsTable({ rows }: Props) {
  const preferredColumns = [
    "jobId",
    "staticCompanyName",
    "title",
    "functionalArea",
    "jobRole",
    "experienceText",
    "minimumExperience",
    "maximumExperience",
    "locations",
    "createdDate",
    "description",
    "shortDescription",
    "keySkills",
    "url",
    "applyRedirectUrl",
    "companyApplyUrl",
    "scrapedAt",
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

  const cleanKeywordText = (value: unknown) => {
    const formatted = formatValue(value);
    return formatted.replace(/\b(keywords?|key\s*skills?)\b\s*:?/gi, "").replace(/\s{2,}/g, " ").trim();
  };

  const dynamicColumns = preferredColumns.filter((column) => rows.some((row) => row[column] !== undefined));

  const orderedColumns = dynamicColumns.sort((a, b) => {
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
            {orderedColumns.map((column) => (
              <th key={column}>{toTitle(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.jobId ?? row.url ?? index)}>
              {orderedColumns.map((column) => (
                <td key={`${String(row.jobId ?? index)}-${column}`}>
                  {column === "keySkills" ? cleanKeywordText(row[column]) : formatValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
