type Props = {
  agents: { id: string; name: string; status: string }[];
  onSelect: (id: string) => void;
};

export default function PipelineFlow({ agents, onSelect }: Props) {
  return (
    <div className="glass-panel pipeline-wrap">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="m-0">Agent Pipeline Visualization</h3>
        <small className="text-secondary">Click a node to open its dedicated workspace</small>
      </div>
      <div className="pipeline-grid">
        {agents.map((agent, idx) => (
          <div key={agent.id} className="node-group">
            <button className={`pipeline-node ${agent.status.toLowerCase()}`} onClick={() => onSelect(agent.id)}>
              <span>{idx + 1}</span>
              <strong>{agent.name}</strong>
              <small>{agent.status}</small>
            </button>
            {idx !== agents.length - 1 && <div className="edge" />}
          </div>
        ))}
      </div>
    </div>
  );
}
