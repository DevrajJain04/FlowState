# AI Flowchart Generator (Groq + React Flow)

AI-powered flowchart generator that converts natural language into interactive diagrams.  
It is designed for explainability-heavy use cases across presentations, technical papers, education, and business process mapping.

## Tech Stack

- Frontend: React + Vite + React Flow (`@xyflow/react`)
- Layout engine: Dagre
- Backend: Node.js + Express
- LLM provider: Groq API (`groq-sdk`)
- Exports: JSON + PNG + JPG + SVG

## Features

- Natural language to diagram generation using Groq LLMs
- Follow-up refinement prompts to iteratively update an existing flowchart
- AI-selected color palettes tuned to prompt/domain context
- Interactive node/edge editing with pan, zoom, minimap, and controls
- Manual palette customization for canvas, edges, accent, and node types
- Distinct node shapes per type (start, process, decision, data, subprocess, actor, document, end)
- Auto layout switching (vertical/horizontal/compact)
- Dark mode and light mode with palette-aware rendering
- Explainability panel with summary, rationale, and prompt improvement tips
- Presentation/technical-paper friendly export to PNG, JPG, SVG, and JSON
- JSON import for iterative refinement and collaboration

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set your key:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant
PORT=3001
VITE_API_BASE_URL=
```

`VITE_API_BASE_URL` can stay empty for same-origin `/api` calls.

3. Start full stack in development:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`

## Production Build

```bash
npm run build
npm start
```

If `dist` exists, the server serves the built frontend and API from one process.

## Vercel Deployment

This project is prepared for Vercel with:

- Static frontend from `dist` (Vite build output)
- Serverless API routes in `api/generate.js`, `api/refine.js`, `api/health.js`
- SPA fallback routing in `vercel.json`

### Deploy steps

1. Push this project to GitHub.
2. Import the repo in Vercel.
3. Keep root directory as `projects/ai-flowchart-generator` if deploying from your home monorepo, or repo root if standalone.
4. Set environment variables in Vercel Project Settings:
   - `GROQ_API_KEY`
   - `GROQ_MODEL` (optional, defaults to `llama-3.1-8b-instant`)
   - `VITE_API_BASE_URL` (optional, leave empty to use same-origin `/api`)
5. Deploy.

## API

### `POST /api/generate`

Request body:

```json
{
  "prompt": "Describe the process to diagram...",
  "detailLevel": "concise | balanced | detailed",
  "audience": "optional audience context"
}
```

### `POST /api/refine`

Request body:

```json
{
  "flowchart": { "existing": "flowchart-json" },
  "followUpPrompt": "Add a compliance review branch before final approval.",
  "detailLevel": "concise | balanced | detailed",
  "audience": "optional audience context"
}
```

Response format is the same as `POST /api/generate`.

### `GET /api/health`

Returns service health metadata and timestamp.

Response:

```json
{
  "flowchart": {
    "title": "string",
    "summary": "string",
    "rationale": "string",
    "suggestions": ["string"],
    "nodes": [
      {
        "id": "string",
        "label": "string",
        "type": "start|process|decision|data|subprocess|end|actor|document",
        "details": "string",
        "notes": "string"
      }
    ],
    "edges": [
      {
        "id": "string",
        "source": "string",
        "target": "string",
        "label": "string",
        "condition": "string"
      }
    ]
  }
}
```

## Notes

- The backend enforces schema validation and normalizes node/edge IDs.
- The backend also validates and normalizes an AI-generated palette object.
- If the LLM response is malformed, a fallback explainable flowchart is generated.
- Missing `GROQ_API_KEY` returns an explicit server error.
- Node sizing is content-aware to reduce text clipping across shape-specific node styles.
