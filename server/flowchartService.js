import Groq from "groq-sdk";
import { z } from "zod";

const NODE_TYPES = [
  "start",
  "process",
  "decision",
  "data",
  "subprocess",
  "end",
  "actor",
  "document"
];

const HEX_COLOR_REGEX = /^#([0-9a-f]{6})$/i;

const DEFAULT_PALETTE = {
  name: "Clean Blueprint",
  canvas: "#eef3ff",
  panel: "#ffffff",
  text: "#1e2b43",
  mutedText: "#5d6e90",
  edge: "#48658f",
  accent: "#0f8b8d",
  nodeColors: {
    start: "#2a9d8f",
    process: "#4f7cff",
    decision: "#f4a261",
    data: "#e76f51",
    subprocess: "#9b7de6",
    end: "#e63973",
    actor: "#22b8b0",
    document: "#e9c46a"
  }
};

const DOMAIN_PALETTES = [
  {
    keywords: ["health", "medical", "hospital", "patient", "triage"],
    palette: {
      name: "Clinical Signal",
      canvas: "#edf8fb",
      panel: "#ffffff",
      text: "#1b2b40",
      mutedText: "#5b6f87",
      edge: "#2c728f",
      accent: "#168aad",
      nodeColors: {
        start: "#2a9d8f",
        process: "#3a86ff",
        decision: "#ff9f1c",
        data: "#f28482",
        subprocess: "#6f5cc2",
        end: "#d7263d",
        actor: "#00a896",
        document: "#e9c46a"
      }
    }
  },
  {
    keywords: ["finance", "bank", "business", "sales", "customer", "onboarding"],
    palette: {
      name: "Executive Deck",
      canvas: "#f4f6fb",
      panel: "#ffffff",
      text: "#1f2a3d",
      mutedText: "#60708d",
      edge: "#4f5d95",
      accent: "#1f7a8c",
      nodeColors: {
        start: "#2e8b57",
        process: "#2d6cdf",
        decision: "#f4a259",
        data: "#b56576",
        subprocess: "#7a5ad9",
        end: "#d1495b",
        actor: "#1f9e89",
        document: "#d4a72c"
      }
    }
  },
  {
    keywords: ["education", "student", "classroom", "learning", "school"],
    palette: {
      name: "Classroom Focus",
      canvas: "#f9f6ef",
      panel: "#fffefb",
      text: "#2c2a3a",
      mutedText: "#69657e",
      edge: "#5f6f9c",
      accent: "#2a9d8f",
      nodeColors: {
        start: "#2b9348",
        process: "#4361ee",
        decision: "#ff8800",
        data: "#ef476f",
        subprocess: "#8e7dbe",
        end: "#d90429",
        actor: "#1ea896",
        document: "#e9c46a"
      }
    }
  }
];

const paletteSchema = z.object({
  name: z.string().min(2).max(80).default(DEFAULT_PALETTE.name),
  canvas: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.canvas),
  panel: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.panel),
  text: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.text),
  mutedText: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.mutedText),
  edge: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.edge),
  accent: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.accent),
  nodeColors: z.object({
    start: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.nodeColors.start),
    process: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.nodeColors.process),
    decision: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.nodeColors.decision),
    data: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.nodeColors.data),
    subprocess: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.nodeColors.subprocess),
    end: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.nodeColors.end),
    actor: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.nodeColors.actor),
    document: z.string().regex(HEX_COLOR_REGEX).default(DEFAULT_PALETTE.nodeColors.document)
  })
});

const flowchartSchema = z.object({
  title: z.string().min(3).max(140),
  summary: z.string().min(10).max(1000),
  rationale: z.string().min(10).max(1200),
  suggestions: z.array(z.string().min(2).max(160)).max(8).default([]),
  nodes: z.array(
    z.object({
      id: z.string().min(1).max(60),
      label: z.string().min(1).max(120),
      type: z.enum(NODE_TYPES),
      details: z.string().max(350).optional().default(""),
      notes: z.string().max(220).optional().default("")
    })
  ).min(2).max(35),
  edges: z.array(
    z.object({
      id: z.string().max(80).optional(),
      source: z.string().min(1).max(60),
      target: z.string().min(1).max(60),
      label: z.string().max(120).optional().default(""),
      condition: z.string().max(120).optional().default("")
    })
  ).max(90),
  palette: paletteSchema.optional()
});

const DETAIL_GUIDE = {
  concise: "Keep it compact with fewer nodes and short edge labels.",
  balanced: "Use medium depth with enough detail for presentations.",
  detailed: "Use higher depth with explicit logic and explainability hints."
};

const refineInputSchema = z.object({
  title: z.string().max(140).optional().default("Refined Flowchart"),
  summary: z.string().max(1000).optional().default("Refined flowchart based on follow-up instructions."),
  rationale: z
    .string()
    .max(1200)
    .optional()
    .default("Refinement preserves structure and applies the requested update."),
  suggestions: z.array(z.string().min(1).max(160)).max(8).optional().default([]),
  nodes: flowchartSchema.shape.nodes,
  edges: flowchartSchema.shape.edges,
  palette: paletteSchema.optional(),
  sourcePrompt: z.string().max(5000).optional().default("")
});

function normalizePalette(rawPalette, fallbackPalette = DEFAULT_PALETTE) {
  const attemptedPalette = rawPalette || fallbackPalette || DEFAULT_PALETTE;
  const parsed = paletteSchema.safeParse(attemptedPalette);
  if (parsed.success) {
    return parsed.data;
  }

  const fallback = paletteSchema.safeParse(DEFAULT_PALETTE);
  return fallback.success ? fallback.data : DEFAULT_PALETTE;
}

function pickPaletteFromPrompt(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  for (const entry of DOMAIN_PALETTES) {
    if (entry.keywords.some((word) => lowerPrompt.includes(word))) {
      return entry.palette;
    }
  }
  return DEFAULT_PALETTE;
}

function buildSystemMessage() {
  return [
    "You convert natural-language descriptions into flowchart data for React Flow.",
    "Return a strict JSON object and nothing else.",
    "Use this schema exactly:",
    "{",
    '  "title": "string",',
    '  "summary": "string",',
    '  "rationale": "string",',
    '  "suggestions": ["string"],',
    '  "palette": {',
    '    "name": "string",',
    '    "canvas": "#RRGGBB",',
    '    "panel": "#RRGGBB",',
    '    "text": "#RRGGBB",',
    '    "mutedText": "#RRGGBB",',
    '    "edge": "#RRGGBB",',
    '    "accent": "#RRGGBB",',
    '    "nodeColors": {',
    '      "start": "#RRGGBB",',
    '      "process": "#RRGGBB",',
    '      "decision": "#RRGGBB",',
    '      "data": "#RRGGBB",',
    '      "subprocess": "#RRGGBB",',
    '      "end": "#RRGGBB",',
    '      "actor": "#RRGGBB",',
    '      "document": "#RRGGBB"',
    "    }",
    "  },",
    '  "nodes": [',
    "    {",
    '      "id": "kebab-case-id",',
    '      "label": "string",',
    '      "type": "start|process|decision|data|subprocess|end|actor|document",',
    '      "details": "string",',
    '      "notes": "string"',
    "    }",
    "  ],",
    '  "edges": [',
    "    {",
    '      "id": "optional-kebab-case",',
    '      "source": "node-id",',
    '      "target": "node-id",',
    '      "label": "optional-short-string",',
    '      "condition": "optional-short-string"',
    "    }",
    "  ]",
    "}",
    "Rules:",
    "1) Every edge source/target must reference an existing node id.",
    "2) Keep labels concise and presentation-friendly.",
    "3) Include decision branches when uncertainty or alternatives exist.",
    "4) Build explainable logic suitable for technical papers and education/business use cases.",
    "5) Ensure at least one start and one end node.",
    "6) Select a cohesive color palette appropriate for the domain and readability."
  ].join("\n");
}

function buildGenerateMessages({ prompt, detailLevel, audience }) {
  const detailInstruction = DETAIL_GUIDE[detailLevel] ?? DETAIL_GUIDE.balanced;
  const audienceInstruction = audience
    ? `Primary audience: ${audience}.`
    : "Primary audience: mixed technical and non-technical stakeholders.";

  const suggestedPalette = pickPaletteFromPrompt(prompt);

  const user = [
    detailInstruction,
    audienceInstruction,
    `Use this starting palette direction (you may improve it, but keep accessibility): ${JSON.stringify(
      suggestedPalette
    )}`,
    "Generate a high-quality flowchart from this request:",
    prompt
  ].join("\n\n");

  return [
    { role: "system", content: buildSystemMessage() },
    { role: "user", content: user }
  ];
}

function buildRefineMessages({
  currentFlowchart,
  followUpPrompt,
  detailLevel,
  audience
}) {
  const detailInstruction = DETAIL_GUIDE[detailLevel] ?? DETAIL_GUIDE.balanced;
  const audienceInstruction = audience
    ? `Primary audience: ${audience}.`
    : "Primary audience: mixed technical and non-technical stakeholders.";

  const user = [
    "Refine this existing flowchart while preserving existing IDs where practical.",
    detailInstruction,
    audienceInstruction,
    "Existing flowchart JSON:",
    JSON.stringify(currentFlowchart),
    "Follow-up instruction:",
    followUpPrompt,
    "Return full updated flowchart JSON in the required schema."
  ].join("\n\n");

  return [
    { role: "system", content: buildSystemMessage() },
    { role: "user", content: user }
  ];
}

function extractJson(payload) {
  const trimmed = payload.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return codeBlockMatch ? codeBlockMatch[1] : trimmed;
}

function sanitizeId(value, fallback) {
  const safe = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return safe || fallback;
}

function normalizeFlowchart(rawFlowchart, prompt, fallbackPalette = DEFAULT_PALETTE) {
  const parsed = flowchartSchema.parse(rawFlowchart);
  const usedIds = new Set();
  const idMap = new Map();
  const palette = normalizePalette(parsed.palette, fallbackPalette);

  const nodes = parsed.nodes.map((node, index) => {
    let candidate = sanitizeId(node.id, `node-${index + 1}`);
    if (usedIds.has(candidate)) {
      candidate = `${candidate}-${index + 1}`;
    }

    usedIds.add(candidate);
    idMap.set(node.id, candidate);

    return {
      ...node,
      id: candidate
    };
  });

  const validIdSet = new Set(nodes.map((node) => node.id));
  let edges = parsed.edges
    .map((edge, index) => {
      const source = idMap.get(edge.source) ?? sanitizeId(edge.source, "");
      const target = idMap.get(edge.target) ?? sanitizeId(edge.target, "");
      if (!validIdSet.has(source) || !validIdSet.has(target)) {
        return null;
      }

      const edgeId = edge.id
        ? sanitizeId(edge.id, `edge-${index + 1}`)
        : `edge-${source}-${target}-${index + 1}`;

      return {
        ...edge,
        id: edgeId,
        source,
        target
      };
    })
    .filter(Boolean);

  if (!nodes.some((node) => node.type === "start")) {
    nodes[0].type = "start";
  }
  if (!nodes.some((node) => node.type === "end")) {
    nodes[nodes.length - 1].type = "end";
  }

  if (edges.length === 0) {
    for (let i = 0; i < nodes.length - 1; i += 1) {
      edges.push({
        id: `edge-${nodes[i].id}-${nodes[i + 1].id}-${i + 1}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        label: "",
        condition: ""
      });
    }
  }

  return {
    title: parsed.title,
    summary: parsed.summary,
    rationale: parsed.rationale,
    suggestions: parsed.suggestions,
    palette,
    nodes,
    edges,
    sourcePrompt: prompt
  };
}

function fallbackFlowchart(prompt, detailLevel, audience) {
  const shortPrompt = prompt.length > 120 ? `${prompt.slice(0, 117)}...` : prompt;
  const summary = [
    "This fallback diagram was generated because the model response was incomplete.",
    "It provides a safe baseline flow that you can edit directly in React Flow."
  ].join(" ");

  const nodes = [
    {
      id: "problem-definition",
      label: "Define Problem",
      type: "start",
      details: shortPrompt,
      notes: audience ? `Audience: ${audience}` : ""
    },
    {
      id: "requirements",
      label: "Extract Requirements",
      type: "process",
      details: "Identify goals, constraints, and success metrics.",
      notes: `Detail level: ${detailLevel}`
    },
    {
      id: "modeling",
      label: "Model Diagram Logic",
      type: "subprocess",
      details: "Draft node semantics, decision points, and transitions.",
      notes: "Explainability and presentation clarity are prioritized."
    },
    {
      id: "review",
      label: "Review & Iterate",
      type: "decision",
      details: "Check correctness, readability, and audience fit.",
      notes: "If no, refine structure. If yes, finalize."
    },
    {
      id: "final-diagram",
      label: "Final Diagram",
      type: "end",
      details: "Interactive flowchart ready for slides and technical documentation.",
      notes: ""
    }
  ];

  const edges = [
    {
      id: "edge-problem-requirements-1",
      source: "problem-definition",
      target: "requirements",
      label: "clarify goal",
      condition: ""
    },
    {
      id: "edge-requirements-modeling-2",
      source: "requirements",
      target: "modeling",
      label: "structure steps",
      condition: ""
    },
    {
      id: "edge-modeling-review-3",
      source: "modeling",
      target: "review",
      label: "validate",
      condition: ""
    },
    {
      id: "edge-review-modeling-4",
      source: "review",
      target: "modeling",
      label: "No",
      condition: "needs improvement"
    },
    {
      id: "edge-review-final-5",
      source: "review",
      target: "final-diagram",
      label: "Yes",
      condition: "ready"
    }
  ];

  return {
    title: "Fallback Flowchart",
    summary,
    rationale:
      "Fallback logic keeps the system usable even when model output is malformed, while preserving explainability-first structure.",
    suggestions: [
      "Use precise domain language in your prompt.",
      "Specify target audience and depth.",
      "Mention decision branches explicitly."
    ],
    palette: pickPaletteFromPrompt(prompt),
    nodes,
    edges,
    sourcePrompt: prompt
  };
}

async function requestCompletion(groq, params) {
  return groq.chat.completions.create(params);
}

async function runModel({
  messages,
  model,
  groq
}) {
  let completion;
  try {
    completion = await requestCompletion(groq, {
      model,
      temperature: 0.2,
      max_tokens: 2200,
      response_format: { type: "json_object" },
      messages
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.toLowerCase().includes("response_format")) {
      throw error;
    }
    completion = await requestCompletion(groq, {
      model,
      temperature: 0.2,
      max_tokens: 2200,
      messages
    });
  }

  const text = completion.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Model returned empty content.");
  }

  return JSON.parse(extractJson(text));
}

function refinedFallback(currentFlowchart, followUpPrompt) {
  return {
    ...currentFlowchart,
    summary: `${currentFlowchart.summary} Refinement applied: ${followUpPrompt}`,
    rationale:
      "Model refinement failed, so the system preserved the existing diagram with a traceable refinement note.",
    suggestions: [
      ...(currentFlowchart.suggestions || []).slice(0, 5),
      "Try a shorter follow-up prompt with one change request at a time."
    ]
  };
}

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY in environment.");
  }

  return new Groq({ apiKey });
}

export async function generateFlowchartFromPrompt({
  prompt,
  detailLevel = "balanced",
  audience = ""
}) {
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  const groq = getGroqClient();
  const messages = buildGenerateMessages({ prompt, detailLevel, audience });
  const fallbackPalette = pickPaletteFromPrompt(prompt);

  try {
    const parsed = await runModel({ messages, model, groq });
    return normalizeFlowchart(parsed, prompt, fallbackPalette);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown LLM error";
    if (message.includes("Missing GROQ_API_KEY")) {
      throw error;
    }

    return fallbackFlowchart(prompt, detailLevel, audience);
  }
}

export async function refineFlowchartFromPrompt({
  currentFlowchart,
  followUpPrompt,
  detailLevel = "balanced",
  audience = ""
}) {
  const parsedCurrent = refineInputSchema.parse(currentFlowchart);
  const summary =
    parsedCurrent.summary.trim().length >= 10
      ? parsedCurrent.summary
      : "Refined flowchart based on follow-up instructions.";
  const rationale =
    parsedCurrent.rationale.trim().length >= 10
      ? parsedCurrent.rationale
      : "Refinement preserves structure and applies the requested update.";
  const safeCurrent = normalizeFlowchart(
    {
      ...parsedCurrent,
      summary,
      rationale
    },
    parsedCurrent.sourcePrompt || "",
    normalizePalette(parsedCurrent.palette)
  );

  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  const groq = getGroqClient();
  const messages = buildRefineMessages({
    currentFlowchart: safeCurrent,
    followUpPrompt,
    detailLevel,
    audience
  });

  try {
    const parsed = await runModel({ messages, model, groq });
    return normalizeFlowchart(
      parsed,
      safeCurrent.sourcePrompt || followUpPrompt,
      safeCurrent.palette
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown LLM error";
    if (message.includes("Missing GROQ_API_KEY")) {
      throw error;
    }

    return refinedFallback(safeCurrent, followUpPrompt);
  }
}
