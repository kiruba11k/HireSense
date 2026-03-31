import { DragEvent, useMemo, useRef, useState } from "react";
import { ManualIntentInput } from "./IntentForm";

type Props = {
  onUpload: (rows: ManualIntentInput[]) => void;
  disabled?: boolean;
};

const requiredColumns = [
  "company_name",
  "job_title",
  "job_description",
  "historical_job_count",
] as const;

const parseCSVLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const parseCSV = (raw: string): ManualIntentInput[] => {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const missing = requiredColumns.filter((field) => !headers.includes(field));
  if (missing.length) {
    throw new Error(`CSV missing columns: ${missing.join(", ")}`);
  }

  return lines.slice(1).map((line) => {
    const fields = parseCSVLine(line);
    const row = Object.fromEntries(headers.map((key, idx) => [key, fields[idx] ?? ""]));
    return {
      company_name: row.company_name,
      job_title: row.job_title,
      job_description: row.job_description,
      historical_job_count: Number(row.historical_job_count || 0),
    };
  });
};

export default function CSVUploader({ onUpload, disabled }: Props) {
  const [rows, setRows] = useState<ManualIntentInput[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);

  const loadFile = async (file: File) => {
    setError("");
    try {
      const text = await file.text();
      const parsedRows = parseCSV(text);
      setRows(parsedRows);
      setStatus(`CSV loaded successfully. Rows detected: ${parsedRows.length}`);
    } catch (err) {
      setRows([]);
      setStatus("");
      setError(err instanceof Error ? err.message : "Invalid CSV");
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  return (
    <div className="glass-card p-4">
      <div
        className="upload-zone text-center p-4 mb-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        Drag & Drop CSV here or click to upload
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="d-none"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) loadFile(file);
        }}
      />

      {status && <div className="alert alert-success py-2">{status}</div>}
      {error && <div className="alert alert-warning py-2">⚠ {error}</div>}

      {!!previewRows.length && (
        <div className="table-responsive mb-3">
          <table className="table table-dark table-striped align-middle">
            <thead>
              <tr>
                <th>Company</th>
                <th>Title</th>
                <th>Description</th>
                <th>Historical Count</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr key={`${row.company_name}-${index}`}>
                  <td>{row.company_name}</td>
                  <td>{row.job_title}</td>
                  <td className="text-truncate" style={{ maxWidth: 280 }}>
                    {row.job_description}
                  </td>
                  <td>{row.historical_job_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        className="btn btn-primary"
        disabled={disabled || !rows.length}
        onClick={() => onUpload(rows)}
      >
        Upload & Analyze
      </button>

      <style jsx>{`
        .upload-zone {
          border: 1px dashed rgba(255, 255, 255, 0.5);
          border-radius: 14px;
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .upload-zone:hover {
          transform: translateY(-2px);
          border-color: #06b6d4;
        }
      `}</style>
    </div>
  );
}
