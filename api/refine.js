import { refineFlowchartFromPrompt } from "../server/flowchartService.js";

function parseBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const body = parseBody(req);
  const followUpPrompt =
    typeof body.followUpPrompt === "string" ? body.followUpPrompt.trim() : "";
  const detailLevel = typeof body.detailLevel === "string" ? body.detailLevel : "balanced";
  const audience = typeof body.audience === "string" ? body.audience.trim() : "";
  const currentFlowchart = body.flowchart;

  if (!currentFlowchart || typeof currentFlowchart !== "object") {
    res.status(400).json({ error: "A valid existing flowchart object is required." });
    return;
  }

  if (followUpPrompt.length < 5) {
    res.status(400).json({ error: "Follow-up prompt must contain at least 5 characters." });
    return;
  }

  try {
    const flowchart = await refineFlowchartFromPrompt({
      currentFlowchart,
      followUpPrompt,
      detailLevel,
      audience
    });
    res.status(200).json({ flowchart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("GROQ_API_KEY") ? 500 : 502;
    res.status(status).json({ error: message });
  }
}
