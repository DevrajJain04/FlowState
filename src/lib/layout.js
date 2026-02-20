import dagre from "@dagrejs/dagre";
import { MarkerType } from "@xyflow/react";

const NODE_DIMENSIONS = {
  start: { width: 250, height: 130 },
  process: { width: 250, height: 140 },
  decision: { width: 240, height: 240 },
  data: { width: 260, height: 150 },
  subprocess: { width: 250, height: 150 },
  end: { width: 250, height: 130 },
  actor: { width: 250, height: 145 },
  document: { width: 255, height: 155 }
};

function getNodeDimensions(kind = "process") {
  return NODE_DIMENSIONS[kind] || NODE_DIMENSIONS.process;
}

function toNumber(value, fallback) {
  const numeric =
    typeof value === "string"
      ? Number.parseFloat(value.replace("px", ""))
      : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return numeric;
}

export function estimateNodeDimensions(kind = "process", payload = {}) {
  const base = getNodeDimensions(kind);
  const label = String(payload.label || "");
  const details = String(payload.details || "");
  const notes = String(payload.notes || "");

  const labelLines = Math.max(1, Math.ceil(label.length / 24));
  const detailLines = Math.ceil(details.length / 42);
  const noteLines = Math.ceil(notes.length / 44);
  const estimatedLines = labelLines + detailLines + noteLines;

  let width = base.width;
  let height = base.height;
  const extraLines = Math.max(0, estimatedLines - 5);
  height += extraLines * 18;

  if (kind === "decision") {
    width = Math.max(width, 280 + extraLines * 12);
    height = Math.max(height, 280 + extraLines * 24);
  }

  if (kind === "data") {
    width = Math.max(width, 280 + Math.max(0, detailLines - 3) * 10);
  }

  if (kind === "actor") {
    width = Math.max(width, 270);
    height += 8;
  }

  if (kind === "document") {
    width = Math.max(width, 270);
    height += 8;
  }

  width = Math.min(width, 420);
  height = Math.min(height, 560);

  return { width, height };
}

function getNodeSize(node) {
  const kind = node.data?.kind || "process";
  const dims = getNodeDimensions(kind);
  const configuredWidth =
    node?.data?.size?.width ?? node?.width ?? node?.style?.width ?? dims.width;
  const configuredHeight =
    node?.data?.size?.height ?? node?.height ?? node?.style?.height ?? dims.height;

  return {
    width: toNumber(configuredWidth, dims.width),
    height: toNumber(configuredHeight, dims.height)
  };
}

function normalizePositions(nodes, margin = 20) {
  if (nodes.length === 0) {
    return nodes;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
  });

  const shiftX = minX < margin ? margin - minX : 0;
  const shiftY = minY < margin ? margin - minY : 0;

  if (shiftX === 0 && shiftY === 0) {
    return nodes;
  }

  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + shiftX,
      y: node.position.y + shiftY
    }
  }));
}

function getBoundingArea(nodes) {
  if (nodes.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  nodes.forEach((node) => {
    const size = getNodeSize(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + size.width);
    maxY = Math.max(maxY, node.position.y + size.height);
  });

  return Math.max(1, maxX - minX) * Math.max(1, maxY - minY);
}

function runDagreLayout(nodes, edges, options) {
  const { direction, ranksep, nodesep, marginx, marginy } = options;
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    ranksep,
    nodesep,
    marginx,
    marginy
  });

  nodes.forEach((node) => {
    const size = getNodeSize(node);
    graph.setNode(node.id, {
      width: size.width,
      height: size.height
    });
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  const horizontal = direction === "LR";
  const layoutedNodes = nodes.map((node) => {
    const position = graph.node(node.id);
    const size = getNodeSize(node);
    return {
      ...node,
      sourcePosition: horizontal ? "right" : "bottom",
      targetPosition: horizontal ? "left" : "top",
      width: size.width,
      height: size.height,
      position: {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2
      }
    };
  });

  const nextNodes = normalizePositions(layoutedNodes);
  const nextEdges = edges.map((edge) => ({
    ...edge,
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge-color)" }
  }));

  return {
    nodes: nextNodes,
    edges: nextEdges,
    direction,
    area: getBoundingArea(nextNodes)
  };
}

export function getLayoutedElements(nodes, edges, direction = "TB") {
  if (direction === "COMPACT") {
    const compactCandidates = ["TB", "LR"].map((candidateDirection) =>
      runDagreLayout(nodes, edges, {
        direction: candidateDirection,
        ranksep: 45,
        nodesep: 30,
        marginx: 20,
        marginy: 20
      })
    );

    const best = compactCandidates.sort((a, b) => a.area - b.area)[0];
    return { nodes: best.nodes, edges: best.edges };
  }

  const safeDirection = direction === "LR" ? "LR" : "TB";
  const result = runDagreLayout(nodes, edges, {
    direction: safeDirection,
    ranksep: 100,
    nodesep: 80,
    marginx: 30,
    marginy: 30
  });

  return { nodes: result.nodes, edges: result.edges };
}
