import { motion } from "framer-motion";

type Job = {
  job_id: string;
  job_title: string;
  company_name: string;
  location?: string;
  experience_range?: string;
  posted_date?: string;
  key_skills?: string[];
  source: string;
};

type Props = {
  rows: Job[];
};

export default function ResultsTable({ rows }: Props) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="table-responsive mt-3">
      <table className="table table-dark table-striped align-middle">
        <thead>
          <tr>
            <th>Job Title</th>
            <th>Company</th>
            <th>Location</th>
            <th>Experience</th>
            <th>Posted Date</th>
            <th>Skills</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.job_id}>
              <td>{row.job_title}</td>
              <td>{row.company_name}</td>
              <td>{row.location || "-"}</td>
              <td>{row.experience_range || "-"}</td>
              <td>{row.posted_date || "-"}</td>
              <td>{(row.key_skills || []).slice(0, 6).join(", ")}</td>
              <td>{row.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
