export default function ScoreCard({ score }) {
  return (
    <div className="bg-black/40 p-6 rounded-xl text-center">
      <h2 className="text-purple-400">Opportunity Score</h2>
      <p className="text-4xl font-bold mt-3">
        {score?.final_score || 0}
      </p>
      <p className="text-sm mt-2">{score?.classification}</p>
    </div>
  );
}
