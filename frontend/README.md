# Vulcan OmniPro 220 - Technical Support Agent

A multimodal AI agent that answers deep technical questions about the Vulcan OmniPro 220 multiprocess welder. Built for the Prox founding engineer challenge.

![Agent Demo](product.webp)

---

## Quick Start

```bash
git clone <your-fork>
cd prox-challenge

# Backend
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
cp .env.example .env         # add your ANTHROPIC_API_KEY
python knowledge.py          # builds the knowledge base (run once)
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## How It Works

### Knowledge Extraction

The three PDFs (`owner-manual.pdf`, `quick-start-guide.pdf`, `selection-chart.pdf`) are processed once by `knowledge.py`:

- **Text extraction** - every page is chunked and stored with source + page metadata
- **Image extraction** - every embedded image is pulled out and saved to `backend/data/images/`. Images under 5KB (icons, bullets) are discarded. This gives the agent access to wiring schematics, duty cycle charts, weld diagnosis photos, and the full selection chart as actual images not described in text
- **TF-IDF index** - a local sklearn vectorizer indexes all text chunks for fast cosine similarity search. No external vector DB needed, no API calls, runs entirely on disk

Result: 87 chunks (50 text + 37 images) across all three documents.

### Agent Architecture

The agent runs a standard tool-use loop against `claude-opus-4-5`:

```
User message (text + optional image)
        ↓
  Tool loop begins
        ↓
  search_manual()        ← TF-IDF retrieval over text chunks
  get_page_images()      ← fetch images from specific pages
  get_all_images()       ← fetch all images (for visual questions)
        ↓
  Claude sees retrieved text + actual images
        ↓
  Final response: text + artifact tags
        ↓
  Frontend parses artifacts, renders in iframes
```

The key insight: when the agent calls `get_page_images` or `get_all_images`, we don't just return metadata, we pass the actual base64 image bytes back to Claude as vision input. This means Claude can literally read the wiring schematic, interpret the duty cycle chart, and understand the weld diagnosis photos. It's not describing images from text descriptions — it's seeing them.

### Multimodal Responses

The most important part of the challenge. The agent is prompted to never answer in text alone when a visual would be clearer. It generates artifacts self-contained HTML components rendered inline for:

| Question type | Artifact |
|---|---|
| Polarity / wiring setup | SVG diagram showing cable connections |
| Duty cycle questions | Interactive calculator or table |
| Troubleshooting | Decision tree / flowchart |
| Settings (material + thickness) | Interactive configurator |

Artifacts are embedded in the response using a custom tag format (`<artifact type="html" title="...">...</artifact>`), parsed on the backend, and rendered in sandboxed iframes on the frontend. This approach mirrors how Claude.ai renders artifacts — a clean separation between prose and interactive content.

### Image Input

Users can upload photos a bad weld, a confusing panel setting, a wiring question. The image is sent to the backend alongside the message, detected by magic bytes (not the Content-Type header, which browsers sometimes report incorrectly for webp files), and passed directly to Claude as a vision input. This lets the agent diagnose real problems from real photos.

---

## Design Decisions

**Why TF-IDF over embeddings?**
For a 48-page manual, TF-IDF is fast, free, and works well. Technical documents have highly specific terminology (DCEN, synergic, duty cycle, GMAW) that TF-IDF handles naturally rare terms get high IDF weight automatically. No embedding API calls, no latency, no cost per query.

**Why pass images directly to Claude vs. describing them?**
The selection chart and many wiring diagrams have zero text layer they exist only as images in the PDF. Any purely text-based RAG approach would miss them entirely. By extracting and passing the actual images, Claude can read the polarity diagram, interpret the duty cycle matrix visually, and reference the weld diagnosis photos by actually seeing them.

**Why iframes for artifacts?**
Sandboxed iframes give full HTML/CSS/JS execution without polluting the parent page's scope. Each artifact is a fully self-contained mini-app. This mirrors the architecture Claude.ai uses for its artifacts feature.

**Why FastAPI + Vite React?**
Simple, fast to set up, easy to run locally with a single API key. The backend is stateless all knowledge lives on disk, all session state lives in the frontend's message array sent with each request.

---

## Project Structure

```
prox-challenge/
├── files/
│   ├── owner-manual.pdf
│   ├── quick-start-guide.pdf
│   └── selection-chart.pdf
├── backend/
│   ├── main.py           # FastAPI app, /chat endpoint
│   ├── agent.py          # Claude agent loop + tool definitions
│   ├── knowledge.py      # PDF processing, image extraction, TF-IDF index
│   ├── requirements.txt
│   ├── .env.example
│   └── data/             # generated on first run
│       ├── chunks.json
│       ├── index.pkl
│       └── images/
├── frontend/
│   └── src/
│       ├── App.tsx        # full chat UI, artifact renderer
│       └── index.css
├── product.webp
├── product-inside.webp
└── README.md
```

---

## What It Can Do

- Answer questions requiring cross-referencing multiple manual sections
- Draw wiring and polarity diagrams on demand
- Generate interactive duty cycle calculators
- Build troubleshooting flowcharts and decision trees
- Analyze user-uploaded photos of welds or machine settings
- Surface relevant images directly from the manual

**Example questions it handles well:**
- "What's the duty cycle for MIG welding at 200A on 240V?"
- "I'm getting porosity in my flux-cored welds. What should I check?"
- "What polarity setup do I need for TIG welding? Which socket does the ground clamp go in?"
- *(upload a photo of a bad weld)* "What's wrong with this weld?"

---

## What's Next

- **Voice support** - the architecture already supports it; adding SIP/telephony is the next layer
- **Semantic embeddings** - swap TF-IDF for a proper embedding model for better recall on paraphrased questions
- **Knowledge graph** - relate entities (processes, materials, voltages, wire types) explicitly rather than relying purely on retrieval
- **Streaming responses** - stream tokens to the frontend for faster perceived response time
- **Hosting** - deploy backend to Railway/Fly.io and frontend to Vercel for zero-setup evaluation

---

## Stack

| Layer | Tech |
|---|---|
| AI | Anthropic Claude (claude-opus-4-5), tool use + vision |
| Backend | Python, FastAPI, PyMuPDF, scikit-learn |
| Frontend | React, TypeScript, Vite |
| Knowledge | TF-IDF index + raw image extraction, stored on disk |