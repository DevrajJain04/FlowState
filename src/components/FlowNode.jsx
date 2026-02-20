import { Handle, Position } from "@xyflow/react";

const TYPE_LABELS = {
  start: "Start",
  process: "Process",
  decision: "Decision",
  data: "Data",
  subprocess: "Subprocess",
  end: "End",
  actor: "Actor",
  document: "Document"
};

export function FlowNode({ data }) {
  const kind = data.kind || "process";

  return (
    <div className={`flow-node flow-node-${kind}`}>
      <Handle className="flow-handle" type="target" position={Position.Top} />
      <Handle className="flow-handle" type="target" position={Position.Left} />
      <div className="flow-node-inner">
        <div className="flow-node-content">
          <div className="flow-node-head">{TYPE_LABELS[kind] || "Step"}</div>
          <h4 className="flow-node-title">{data.label}</h4>
          {data.details ? <p className="flow-node-details">{data.details}</p> : null}
          {data.notes ? <p className="flow-node-notes">{data.notes}</p> : null}
        </div>
      </div>
      <Handle className="flow-handle" type="source" position={Position.Bottom} />
      <Handle className="flow-handle" type="source" position={Position.Right} />
    </div>
  );
}
