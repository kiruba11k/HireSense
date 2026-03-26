"use client";

import { useState, ReactNode } from "react";
import { motion } from "framer-motion";

/* ================= OPTIONS ================= */
const workplaceOptions = ["On-site", "Hybrid", "Remote"] as const;
const experienceOptions = ["Internship", "Entry level", "Associate", "Mid-Senior level", "Director", "Executive"] as const;
const jobTypeOptions = ["Full-time", "Part-time", "Contract", "Temporary", "Internship"] as const;

/* ================= MAIN ================= */
export default function PremiumDashboard() {
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [experienceLevels, setExperienceLevels] = useState<string[]>([]);
  const [workplaceFilters, setWorkplaceFilters] = useState<string[]>([]);

  return (
    <div style={layout}>
      <Sidebar />

      <main style={main}>
        <Header />

        {/* KPI */}
        <div style={kpiGrid}>
          <KPI title="Jobs Found" value="124" />
          <KPI title="Active Filters" value="8" />
          <KPI title="Response Rate" value="32%" />
        </div>

        {/* FILTER PANEL */}
        <motion.div
          style={card}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 style={title}>Search Filters</h3>

          <div style={grid}>
            <Field label="Job Type">
              <MultiSelectChips
                options={jobTypeOptions}
                values={typeFilters}
                onChange={setTypeFilters}
              />
            </Field>

            <Field label="Experience">
              <MultiSelectChips
                options={experienceOptions}
                values={experienceLevels}
                onChange={setExperienceLevels}
              />
            </Field>

            <Field label="Workplace">
              <MultiSelectChips
                options={workplaceOptions}
                values={workplaceFilters}
                onChange={setWorkplaceFilters}
              />
            </Field>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

/* ================= SIDEBAR ================= */
function Sidebar() {
  const items = ["Dashboard", "Search", "Pipelines", "Campaigns", "Exports"];

  return (
    <aside style={sidebar}>
      <h2 style={logo}>HireSense</h2>

      {items.map((item) => (
        <motion.div
          key={item}
          whileHover={{ scale: 1.05 }}
          style={sideItem}
        >
          {item}
        </motion.div>
      ))}
    </aside>
  );
}

/* ================= HEADER ================= */
function Header() {
  return (
    <div style={header}>
      <h2 style={{ margin: 0 }}>LinkedIn Intelligence Dashboard</h2>
      <button style={primaryBtn}>+ New Search</button>
    </div>
  );
}

/* ================= KPI ================= */
function KPI({ title, value }: { title: string; value: string }) {
  return (
    <motion.div
      style={kpiCard}
      whileHover={{ y: -5 }}
    >
      <p style={kpiLabel}>{title}</p>
      <h3>{value}</h3>
    </motion.div>
  );
}

/* ================= FIELD ================= */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

/* ================= MULTI SELECT ================= */
function MultiSelectChips({
  options,
  values,
  onChange,
}: {
  options: readonly string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  return (
    <div style={chipWrap}>
      {options.map((option) => {
        const active = values.includes(option);

        return (
          <motion.button
            key={option}
            whileTap={{ scale: 0.9 }}
            onClick={() => toggle(option)}
            style={{
              ...chip,
              ...(active ? chipActive : {}),
            }}
          >
            {option}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ================= STYLES ================= */

const layout = {
  display: "flex",
  height: "100vh",
  background: "#020617",
  color: "#e2e8f0",
};

const sidebar = {
  width: 220,
  background: "#020617",
  borderRight: "1px solid #1e293b",
  padding: 20,
};

const logo = {
  marginBottom: 30,
  fontSize: "1.3rem",
};

const sideItem = {
  padding: "10px 12px",
  borderRadius: 8,
  cursor: "pointer",
  marginBottom: 10,
};

const main = {
  flex: 1,
  padding: 24,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 20,
};

const primaryBtn = {
  background: "linear-gradient(90deg, #2563eb, #7c3aed)",
  border: "none",
  padding: "8px 14px",
  borderRadius: 8,
  color: "white",
  cursor: "pointer",
};

const card = {
  background: "rgba(15,23,42,0.6)",
  border: "1px solid #334155",
  padding: 20,
  borderRadius: 16,
  backdropFilter: "blur(12px)",
};

const title = {
  marginBottom: 16,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px,1fr))",
  gap: 20,
};

const field = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const labelStyle = {
  fontSize: "0.85rem",
  color: "#93c5fd",
};

const chipWrap = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 10,
};

const chip = {
  padding: "6px 14px",
  borderRadius: 999,
  border: "1px solid #334155",
  background: "#020617",
  cursor: "pointer",
  color: "#cbd5e1",
};

const chipActive = {
  background: "linear-gradient(90deg,#2563eb,#7c3aed)",
  border: "none",
  color: "#fff",
  boxShadow: "0 0 12px rgba(99,102,241,0.6)",
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))",
  gap: 16,
  marginBottom: 20,
};

const kpiCard = {
  padding: 16,
  borderRadius: 12,
  border: "1px solid #334155",
  background: "rgba(15,23,42,0.6)",
};

const kpiLabel = {
  fontSize: "0.8rem",
  color: "#93c5fd",
};
