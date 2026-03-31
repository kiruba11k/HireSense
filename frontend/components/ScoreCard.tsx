export default function ScoreCard({ score }) {
  return (
    <div className="score-card">
      <h2>Opportunity Score</h2>
      <p className="score">{score?.final_score || 0}</p>
      <p>{score?.classification || "No classification yet"}</p>
      <p className="reason">{score?.reason || "Run the pipeline to calculate score."}</p>

      <style jsx>{`
        .score-card {
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 22px;
          text-align: center;
          animation: pulse 3s ease-in-out infinite;
        }
        h2 { color: #c4b5fd; margin: 0; }
        .score { font-size: 52px; font-weight: 700; margin: 12px 0; }
        .reason { opacity: 0.8; font-size: 13px; margin-top: 10px; }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 rgba(109, 77, 255, 0.2); }
          50% { box-shadow: 0 0 30px rgba(109, 77, 255, 0.32); }
        }
      `}</style>
    </div>
  );
}
