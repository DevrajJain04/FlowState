import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import {
  generateFlowchartFromPrompt,
  refineFlowchartFromPrompt
} from "./flowchartService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ai-flowchart-generator-api",
    timestamp: new Date().toISOString()
  });
});

app.post("/api/generate", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const detailLevel =
    typeof req.body?.detailLevel === "string" ? req.body.detailLevel : "balanced";
  const audience = typeof req.body?.audience === "string" ? req.body.audience.trim() : "";

  if (!prompt || prompt.length < 10) {
    res.status(400).json({
      error: "Prompt must contain at least 10 characters."
    });
    return;
  }

  try {
    const flowchart = await generateFlowchartFromPrompt({
      prompt,
      detailLevel,
      audience
    });
    res.json({ flowchart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("GROQ_API_KEY") ? 500 : 502;
    res.status(status).json({ error: message });
  }
});

app.post("/api/refine", async (req, res) => {
  const followUpPrompt =
    typeof req.body?.followUpPrompt === "string" ? req.body.followUpPrompt.trim() : "";
  const detailLevel =
    typeof req.body?.detailLevel === "string" ? req.body.detailLevel : "balanced";
  const audience = typeof req.body?.audience === "string" ? req.body.audience.trim() : "";
  const currentFlowchart = req.body?.flowchart;

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
    res.json({ flowchart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("GROQ_API_KEY") ? 500 : 502;
    res.status(status).json({ error: message });
  }
});

const distPath = path.resolve(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`AI Flowchart Generator API running on http://localhost:${port}`);
});
