import { useCallback, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  getNodesBounds,
  getViewportForBounds,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import { toJpeg, toPng, toSvg } from "html-to-image";
import { FlowNode } from "./components/FlowNode";
import {
  createThemeVariables,
  DEFAULT_PALETTE,
  NODE_TYPE_LABELS,
  normalizePalette
} from "./lib/colors";
import { estimateNodeDimensions, getLayoutedElements } from "./lib/layout";

const TEMPLATE_PROMPTS = [
  {
    label: "ML Paper Pipeline",
    prompt:
      "Generate a research flowchart for an ML paper covering problem framing, data collection, preprocessing, model design, training, evaluation, error analysis, and publication-ready conclusions."
  },
  {
    label: "Business Onboarding",
    prompt:
      "Create a customer onboarding flow for a SaaS company including lead qualification, demo, security review, contract approval, setup, training, adoption checks, and renewal."
  },
  {
    label: "Classroom Explainability",
    prompt:
      "Build an educational flowchart explaining how photosynthesis works with clear decision points for light availability, water availability, and output products."
  }
];

const NODE_TYPE_ORDER = [
  "start",
  "process",
  "decision",
  "data",
  "subprocess",
  "end",
  "actor",
  "document"
];

function normalizeFlowchartInput(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Imported content is not a valid JSON object.");
  }

  if (Array.isArray(raw.nodes) && raw.nodes.length > 0 && raw.nodes[0].data) {
    return {
      title: raw.title || "Imported Diagram",
      summary: raw.summary || "",
      rationale: raw.rationale || "",
      suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
      sourcePrompt: raw.sourcePrompt || "",
      palette: normalizePalette(raw.palette),
      nodes: raw.nodes.map((node, index) => ({
        id: node.id || `node-${index + 1}`,
        label: node.data?.label || "Untitled",
        type: node.data?.kind || "process",
        details: node.data?.details || "",
        notes: node.data?.notes || ""
      })),
      edges: (raw.edges || []).map((edge, index) => ({
        id: edge.id || `edge-${index + 1}`,
        source: edge.source,
        target: edge.target,
        label: edge.label || "",
        condition: edge.data?.condition || ""
      }))
    };
  }

  if (raw.flowchart && typeof raw.flowchart === "object") {
    return normalizeFlowchartInput(raw.flowchart);
  }

  if (Array.isArray(raw.nodes)) {
    return {
      ...raw,
      palette: normalizePalette(raw.palette)
    };
  }

  throw new Error("Unsupported JSON shape for import.");
}

function makeDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createEdgeModel(edge, index) {
  return {
    id:
      edge.id ||
      `edge-${edge.source || "unknown"}-${edge.target || "unknown"}-${index + 1}`,
    source: String(edge.source),
    target: String(edge.target),
    label: edge.label || edge.condition || "",
    data: { condition: edge.condition || "" },
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge-color)" },
    style: {
      stroke: "var(--edge-color)",
      strokeWidth: 1.9
    },
    labelStyle: {
      fill: "var(--text-main)",
      fontWeight: 600,
      fontSize: 12
    },
    labelBgStyle: {
      fill: "var(--panel-bg-solid)",
      fillOpacity: 0.95,
      stroke: "var(--panel-border)"
    },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 5
  };
}

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [prompt, setPrompt] = useState("");
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [detailLevel, setDetailLevel] = useState("balanced");
  const [audience, setAudience] = useState("");
  const [layoutDirection, setLayoutDirection] = useState("TB");
  const [themeMode, setThemeMode] = useState("light");
  const [palette, setPalette] = useState(DEFAULT_PALETTE);
  const [aiPalette, setAiPalette] = useState(DEFAULT_PALETTE);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flowMeta, setFlowMeta] = useState({
    title: "",
    summary: "",
    rationale: "",
    suggestions: [],
    sourcePrompt: ""
  });

  const canvasRef = useRef(null);
  const importInputRef = useRef(null);
  const reactFlowRef = useRef(null);
  const nodeTypes = useMemo(() => ({ conceptNode: FlowNode }), []);
  const themeVariables = useMemo(
    () => createThemeVariables(palette, themeMode),
    [palette, themeMode]
  );
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;

  const serializeFlowchart = useCallback(() => {
    return {
      title: flowMeta.title || "Generated Flowchart",
      summary: flowMeta.summary || "",
      rationale: flowMeta.rationale || "",
      suggestions: flowMeta.suggestions || [],
      sourcePrompt: flowMeta.sourcePrompt || prompt,
      palette,
      nodes: nodes.map((node) => ({
        id: node.id,
        label: node.data?.label || "",
        type: node.data?.kind || "process",
        details: node.data?.details || "",
        notes: node.data?.notes || ""
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label || "",
        condition: edge.data?.condition || ""
      }))
    };
  }, [edges, flowMeta, nodes, palette, prompt]);

  const applyFlowchart = useCallback(
    (flowchart, direction = layoutDirection) => {
      const normalizedPalette = normalizePalette(flowchart.palette || palette);

      const rawNodes = (flowchart.nodes || []).map((node) => {
        const kind = node.type || "process";
        const data = {
          label: node.label || "Untitled",
          details: node.details || "",
          notes: node.notes || "",
          kind
        };
        const size = estimateNodeDimensions(kind, data);

        return {
          id: String(node.id),
          type: "conceptNode",
          position: { x: 0, y: 0 },
          width: size.width,
          height: size.height,
          style: { width: size.width, height: size.height },
          data: {
            ...data,
            size
          }
        };
      });

      const rawEdges = (flowchart.edges || []).map(createEdgeModel);
      const layouted = getLayoutedElements(rawNodes, rawEdges, direction);

      setNodes(layouted.nodes);
      setEdges(layouted.edges);
      setSelectedNodeId(layouted.nodes[0]?.id || "");
      setPalette(normalizedPalette);
      setAiPalette(normalizedPalette);
      setFlowMeta({
        title: flowchart.title || "Generated Flowchart",
        summary: flowchart.summary || "",
        rationale: flowchart.rationale || "",
        suggestions: Array.isArray(flowchart.suggestions) ? flowchart.suggestions : [],
        sourcePrompt: flowchart.sourcePrompt || prompt
      });

      window.requestAnimationFrame(() => {
        reactFlowRef.current?.fitView({ padding: 0.2, duration: 700 });
      });
    },
    [layoutDirection, palette, prompt, setEdges, setNodes]
  );

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
      const url = baseUrl ? `${baseUrl}/api/generate` : "/api/generate";

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          detailLevel,
          audience
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to generate flowchart.");
      }

      const payload = await response.json();
      applyFlowchart(payload.flowchart, layoutDirection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [prompt, detailLevel, audience, applyFlowchart, layoutDirection]);

  const handleRefine = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
      const url = baseUrl ? `${baseUrl}/api/refine` : "/api/refine";

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowchart: serializeFlowchart(),
          followUpPrompt,
          detailLevel,
          audience
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to refine flowchart.");
      }

      const payload = await response.json();
      applyFlowchart(payload.flowchart, layoutDirection);
      setFollowUpPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [
    applyFlowchart,
    audience,
    detailLevel,
    followUpPrompt,
    layoutDirection,
    serializeFlowchart
  ]);

  const handleRelayout = useCallback(
    (direction) => {
      if (nodes.length === 0) {
        return;
      }

      setLayoutDirection(direction);
      const layouted = getLayoutedElements(nodes, edges, direction);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
      window.requestAnimationFrame(() => {
        reactFlowRef.current?.fitView({ padding: 0.2, duration: 450 });
      });
    },
    [edges, nodes, setEdges, setNodes]
  );

  const handleConnect = useCallback(
    (connection) => {
      setEdges((existing) =>
        addEdge(
          {
            ...createEdgeModel(
              {
                id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
                source: connection.source,
                target: connection.target,
                label: ""
              },
              Date.now()
            ),
            source: connection.source,
            target: connection.target
          },
          existing
        )
      );
    },
    [setEdges]
  );

  const exportJson = useCallback(() => {
    makeDownload(
      "flowchart.json",
      JSON.stringify(serializeFlowchart(), null, 2),
      "application/json"
    );
  }, [serializeFlowchart]);

  const exportImage = useCallback(
    async (format) => {
      if (!canvasRef.current || nodes.length === 0) {
        return;
      }

      const viewport = canvasRef.current.querySelector(".react-flow__viewport");
      if (!viewport) {
        return;
      }

      const bounds = getNodesBounds(nodes);
      const padding = 120;
      const width = Math.min(5000, Math.max(1000, Math.ceil(bounds.width + padding * 2)));
      const height = Math.min(5000, Math.max(700, Math.ceil(bounds.height + padding * 2)));
      const viewportTransform = getViewportForBounds(
        bounds,
        width,
        height,
        0.1,
        3,
        0.12
      );

      const backgroundColor =
        themeMode === "dark" ? "#0d1629" : createThemeVariables(palette, "light")["--bg-base"];
      const options = {
        cacheBust: true,
        backgroundColor,
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${viewportTransform.x}px, ${viewportTransform.y}px) scale(${viewportTransform.zoom})`,
          transformOrigin: "top left"
        }
      };

      try {
        let dataUrl;
        if (format === "png") {
          dataUrl = await toPng(viewport, {
            ...options,
            pixelRatio: 2
          });
        } else if (format === "jpeg") {
          dataUrl = await toJpeg(viewport, {
            ...options,
            quality: 0.96,
            pixelRatio: 2
          });
        } else {
          dataUrl = await toSvg(viewport, options);
        }

        const anchor = document.createElement("a");
        anchor.href = dataUrl;
        anchor.download = format === "jpeg" ? "flowchart.jpg" : `flowchart.${format}`;
        anchor.click();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to export image.");
      }
    },
    [nodes, palette, themeMode]
  );

  const handleImport = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const flowchart = normalizeFlowchartInput(parsed);
        applyFlowchart(flowchart, layoutDirection);
        if (flowchart.sourcePrompt) {
          setPrompt(flowchart.sourcePrompt);
        }
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      } finally {
        event.target.value = "";
      }
    },
    [applyFlowchart, layoutDirection]
  );

  const updateSelectedNode = useCallback(
    (key, value) => {
      if (!selectedNodeId) {
        return;
      }

      setNodes((existing) =>
        existing.map((node) => {
          if (node.id !== selectedNodeId) {
            return node;
          }

          const nextData = { ...node.data, [key]: value };
          const size = estimateNodeDimensions(nextData.kind || "process", nextData);

          return {
            ...node,
            width: size.width,
            height: size.height,
            style: { ...(node.style || {}), width: size.width, height: size.height },
            data: {
              ...nextData,
              size
            }
          };
        })
      );
    },
    [selectedNodeId, setNodes]
  );

  const updatePaletteField = useCallback((field, value) => {
    setPalette((previous) =>
      normalizePalette({
        ...previous,
        [field]: value
      })
    );
  }, []);

  const updateNodeTypeColor = useCallback((type, value) => {
    setPalette((previous) =>
      normalizePalette({
        ...previous,
        nodeColors: {
          ...previous.nodeColors,
          [type]: value
        }
      })
    );
  }, []);

  const canGenerate = prompt.trim().length >= 10 && !loading;
  const canRefine = nodes.length > 0 && followUpPrompt.trim().length >= 5 && !loading;
  const hasDiagram = nodes.length > 0;

  return (
    <div
      className={`app-shell ${themeMode === "dark" ? "theme-dark" : "theme-light"}`}
      style={themeVariables}
    >
      <header className="app-header">
        <div className="header-main">
          <h1>AI Flowchart Generator</h1>
          <p>
            Convert natural language into interactive, explainable diagrams for
            presentations, technical papers, education, and business workflows.
          </p>
        </div>
        <button
          className="btn btn-secondary mode-toggle"
          onClick={() => setThemeMode((prev) => (prev === "light" ? "dark" : "light"))}
        >
          {themeMode === "light" ? "Dark Mode" : "Light Mode"}
        </button>
      </header>

      <main className="workspace">
        <section className="control-panel">
          <h2>Prompt Designer</h2>
          <label htmlFor="prompt-input">Scenario Description</label>
          <textarea
            id="prompt-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Example: Create a healthcare triage flow with intake, symptom scoring, urgency classification, specialist routing, and follow-up."
          />

          <label htmlFor="audience-input">Audience (optional)</label>
          <input
            id="audience-input"
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            placeholder="e.g. MBA students, engineering managers, high-school science"
          />

          <label htmlFor="detail-level">Detail Level</label>
          <select
            id="detail-level"
            value={detailLevel}
            onChange={(event) => setDetailLevel(event.target.value)}
          >
            <option value="concise">Concise</option>
            <option value="balanced">Balanced</option>
            <option value="detailed">Detailed</option>
          </select>

          <button className="btn btn-primary" disabled={!canGenerate} onClick={handleGenerate}>
            {loading ? "Working..." : "Generate Flowchart"}
          </button>

          <label htmlFor="refine-input">Follow-up Refinement</label>
          <textarea
            id="refine-input"
            value={followUpPrompt}
            onChange={(event) => setFollowUpPrompt(event.target.value)}
            placeholder="Example: Add a compliance review branch before final approval and include failure loops."
          />
          <button className="btn btn-secondary" disabled={!canRefine} onClick={handleRefine}>
            Refine Existing Flowchart
          </button>

          <div className="template-grid">
            {TEMPLATE_PROMPTS.map((item) => (
              <button
                key={item.label}
                className="btn btn-template"
                onClick={() => setPrompt(item.prompt)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error ? <p className="error-text">{error}</p> : null}
        </section>

        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <div className="toolbar-group">
              <button
                className="btn btn-secondary"
                disabled={!hasDiagram}
                onClick={() => handleRelayout("TB")}
              >
                Vertical Layout
              </button>
              <button
                className="btn btn-secondary"
                disabled={!hasDiagram}
                onClick={() => handleRelayout("LR")}
              >
                Horizontal Layout
              </button>
              <button
                className="btn btn-secondary"
                disabled={!hasDiagram}
                onClick={() => handleRelayout("COMPACT")}
              >
                Compact Layout
              </button>
            </div>

            <div className="toolbar-group">
              <button
                className="btn btn-secondary"
                disabled={!hasDiagram}
                onClick={() => exportImage("png")}
              >
                Export PNG
              </button>
              <button
                className="btn btn-secondary"
                disabled={!hasDiagram}
                onClick={() => exportImage("jpeg")}
              >
                Export JPG
              </button>
              <button
                className="btn btn-secondary"
                disabled={!hasDiagram}
                onClick={() => exportImage("svg")}
              >
                Export SVG
              </button>
              <button className="btn btn-secondary" disabled={!hasDiagram} onClick={exportJson}>
                Export JSON
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => importInputRef.current?.click()}
              >
                Import JSON
              </button>
              <input
                ref={importInputRef}
                className="hidden-input"
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
              />
            </div>
          </div>

          <div className="canvas" ref={canvasRef}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onInit={(instance) => {
                reactFlowRef.current = instance;
              }}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => palette.nodeColors[node.data?.kind] || palette.accent}
              />
              <Controls />
              <Background color="var(--panel-border)" gap={20} size={1} />
            </ReactFlow>
          </div>
        </section>

        <aside className="insight-panel">
          <h2>{flowMeta.title || "Flowchart Insights"}</h2>
          <p className="meta-summary">
            {flowMeta.summary || "Generate a diagram to view summary and rationale."}
          </p>
          <p className="meta-rationale">{flowMeta.rationale}</p>

          {flowMeta.suggestions?.length ? (
            <div>
              <h3>Prompt Improvement Tips</h3>
              <ul>
                {flowMeta.suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="theme-controls">
            <h3>Theme & Colors</h3>
            <p className="muted-text">AI Palette: {aiPalette.name}</p>
            <div className="color-grid">
              <label htmlFor="palette-canvas">
                Canvas
                <input
                  id="palette-canvas"
                  type="color"
                  value={palette.canvas}
                  onChange={(event) => updatePaletteField("canvas", event.target.value)}
                />
              </label>
              <label htmlFor="palette-edge">
                Edge
                <input
                  id="palette-edge"
                  type="color"
                  value={palette.edge}
                  onChange={(event) => updatePaletteField("edge", event.target.value)}
                />
              </label>
              <label htmlFor="palette-accent">
                Accent
                <input
                  id="palette-accent"
                  type="color"
                  value={palette.accent}
                  onChange={(event) => updatePaletteField("accent", event.target.value)}
                />
              </label>
            </div>

            <div className="node-color-grid">
              {NODE_TYPE_ORDER.map((type) => (
                <label key={type} htmlFor={`color-${type}`}>
                  {NODE_TYPE_LABELS[type]}
                  <input
                    id={`color-${type}`}
                    type="color"
                    value={palette.nodeColors[type]}
                    onChange={(event) => updateNodeTypeColor(type, event.target.value)}
                  />
                </label>
              ))}
            </div>

            <button className="btn btn-secondary" onClick={() => setPalette(aiPalette)}>
              Use AI Suggested Colors
            </button>
          </div>

          <div className="node-editor">
            <h3>Selected Node</h3>
            {selectedNode ? (
              <>
                <label htmlFor="node-label">Label</label>
                <input
                  id="node-label"
                  value={selectedNode.data?.label || ""}
                  onChange={(event) => updateSelectedNode("label", event.target.value)}
                />

                <label htmlFor="node-type">Type</label>
                <select
                  id="node-type"
                  value={selectedNode.data?.kind || "process"}
                  onChange={(event) => updateSelectedNode("kind", event.target.value)}
                >
                  {NODE_TYPE_ORDER.map((type) => (
                    <option key={type} value={type}>
                      {NODE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>

                <label htmlFor="node-details">Details</label>
                <textarea
                  id="node-details"
                  value={selectedNode.data?.details || ""}
                  onChange={(event) => updateSelectedNode("details", event.target.value)}
                />
              </>
            ) : (
              <p className="muted-text">Click a node to edit its label and explanation.</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
