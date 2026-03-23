export default function JobCard({ job }) {
  return (
    <div className="bg-black/40 p-4 rounded-xl">
      <h3 className="font-bold">{job.job.title}</h3>
      <p className="text-sm text-purple-300">{job.intent}</p>
      <p className="text-xs mt-2">{job.tech?.join(", ")}</p>
    </div>
  );
}
