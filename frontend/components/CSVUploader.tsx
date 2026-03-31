import { DragEvent, useRef, useState } from "react";

export type CsvRow = {
  company_name: string;
  job_title: string;
  job_description: string;
  historical_job_count: number;
};

const requiredColumns = ["company_name", "job_title", "job_description", "historical_job_count"];

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

export default function CSVUploader({
  onDataReady,
  loading,
}: {
  onDataReady: (rows: CsvRow[]) => void;
  loading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string>("");
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([]);

  const processFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new Error("CSV invalid: no data rows found.");
    }

    const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
    const missingColumns = requiredColumns.filter((col) => !headers.includes(col));

    if (missingColumns.length) {
      throw new Error(`CSV invalid. Missing columns: ${missingColumns.join(", ")}`);
    }

    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const rowRecord = headers.reduce<Record<string, string>>((acc, key, index) => {
        acc[key] = values[index] || "";
        return acc;
      }, {});

      return {
        company_name: rowRecord.company_name,
        job_title: rowRecord.job_title,
        job_description: rowRecord.job_description,
        historical_job_count: Number(rowRecord.historical_job_count || 0),
      };
    });

    setPreviewRows(rows.slice(0, 10));
    onDataReady(rows);
    setMessage(`CSV loaded successfully. Rows detected: ${rows.length}`);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    try {
      await processFile(files[0]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Invalid CSV file";
      setMessage(errorMessage);
      setPreviewRows([]);
      onDataReady([]);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    await handleFiles(event.dataTransfer.files);
  };

  return (
    <div className="glass-card p-4">
      <div
        className="upload-zone mb-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="d-none"
          accept=".csv"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <p className="mb-1 text-white fw-semibold">Drag & Drop CSV upload</p>
        <p className="mb-0 text-white-50 small">or click to choose file</p>
      </div>

      {message && <div className="alert alert-info py-2 small mb-3">{message}</div>}

      {previewRows.length > 0 && (
        <div className="table-responsive mb-3">
          <table className="table table-dark table-hover table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Company</th>
                <th>Job Title</th>
                <th>Historical Count</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr key={`${row.company_name}-${index}`}>
                  <td>{row.company_name}</td>
                  <td>{row.job_title}</td>
                  <td>{row.historical_job_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="btn btn-primary btn-animated" disabled={loading || previewRows.length === 0} type="button">
        Upload Ready
      </button>
    </div>
  );
}
