import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportCSV = (data: any[]) => {
  const rows = data.map((d) =>
    `${d.job.title},${d.job.company},${d.intent},${d.tech}`
  );

  const csv = ["Title,Company,Intent,Tech", ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "jobs.csv";
  a.click();
};

export const exportPDF = (data: any[]) => {
  const doc = new jsPDF();

  const rows = data.map((d) => [
    d.job.title,
    d.job.company,
    d.intent,
    d.tech.join(", "),
  ]);

  autoTable(doc, {
    head: [["Title", "Company", "Intent", "Tech"]],
    body: rows,
  });

  doc.save("report.pdf");
};
