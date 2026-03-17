# Readapt — Assistive Reading for Dyslexia, ADHD, and Low Vision

The Problem:
- Reading is not one-size-fits-all. Dyslexia, ADHD, and Low Vision each introduce distinct challenges: decoding and letter confusion (Dyslexia), sustained attention and cadence (ADHD), and visual acuity/contrast sensitivity (Low Vision).
- Our solution adapts the typography, spacing, contrast, and layout of text in real time, adds optional TL;DR and TTS, and can apply your preferred reading settings across the entire web via a browser extension.

What we built (TL;DR)
- Frontend: Next.js 14 + React 18 + TypeScript, Tailwind v4, shadcn/ui, next-themes, animated particles. Modes for Dyslexia, ADHD, and Low Vision include Paste → Adapt flows, quizzes where applicable, customizable presets, a chat-like “Custom” builder powered by a local intent classifier, TTS, and a monitoring agent that suggests gentle increases after inactivity.
- Backend: FastAPI serving three services: (1) dyslexia prediction from a 10-question quiz via a small scikit-learn model we trained, (2) OCR via Tesseract, (3) an ADHD gaze-variability pipeline that uses a pre-trained ResNet-18 (Gaze360) strictly as a gaze-angle estimator; we built the variability metric, decision rule, and data flow.
- Extension: A Chrome MV3 extension that applies your settings to any site as an overlay reader or as inline styles. Robust to MV3 reloads and with sensible guardrails (e.g., force Overlay for Custom and higher Low Vision presets).

Highlights of our solution READAPT
- OCR: Extract text from images/scans (backend Tesseract).
- TTS: Speak adapted text using the Web Speech API (voice selection with guardrails).
- Monitoring agent: Detects 15s inactivity and suggests incremental preset increases (+0.25), snoozable and disable-able.
- Custom agent: Client-side intent classifier (pure JS logistic regression) to adjust font, spacing, contrast, and fonts via natural language (“make it bigger”, “contrast change”, “cycle font”, “loosen letters”…).
- Browser extension: One click to apply your reading settings to any site (Overlay or Inline), with forced Overlay when needed to preserve readability.
- ADHD gaze pipeline: Our end-to-end signal: face → gaze angles → time-series variability → heuristic → fusion with quiz → preset.
- Dyslexia ML model: A lightweight, interpretable RandomForest pipeline (with scaling and CV) trained on six engineered features from the quiz.

Why a pre-trained ResNet-18 for gaze?
- Gaze360 is a large, 360° dataset with specialized preprocessing and multi-GB size. Training to parity requires serious GPU time and heavy engineering. Our goal isn’t “raw gaze SOTA,” it’s an assistive signal about stability while reading. Using a proven pre-trained estimator for pitch/yaw frees us to innovate on the product-specific part: a robust, privacy-preserving variability metric, smart thresholds, and fast UX.
- We only use the model as a sensor (pitch/yaw). ADHD inference is our own: compute variability over time and fuse with a quiz to decide a reading preset. This is pragmatic, ethical, and optimized for user impact.

---

## Architecture at a glance

- Frontend (Next.js App Router)
  - Modes: /adhd, /dyslexia, /lowvision
  - Pages: paste → results (where applicable) → adapt; custom builders; dashboards
  - Styling: Tailwind v4 with OKLCH tokens, shadcn/ui (Radix)
  - State: localStorage handoff between stages; extension sync over window.postMessage
  - Optional: TL;DR (Gemini), TTS (Web Speech API)

- Backend (FastAPI)
  - POST /api/predict-dyslexia → label (0..2) + features + debug_log
  - POST /api/ocr → extracted text (Tesseract)
  - POST /api/adhd-diagnose → gaze variability + heuristic “ADHD”|“No ADHD”
  - POST/GET /api/adhd/final → final mapping relay (quiz + gaze) for frontend auto-apply

- Extension (Chrome MV3)
  - background.js: storage for settings + configuration
  - contentScript.js: floating button, apply overlay/inline, resilience to MV3 reloads
  - popup.html/js: toggle overlay/inline, per-site disable, show latest settings

---

## How each disorder is handled

Dyslexia
- What we adapt:
  - Preset 1..3 (adjustable in 0.25 steps) interpolates font size, letter/word spacing, and line height:
    - ~24→31px font, ~0.16→0.55em letter spacing, ~0.22→0.85em word spacing, ~1.95→2.6 line height.
  - At preset ≥ 3:
    - Non-chipping words: keep words intact to avoid awkward intra-word wraps.
    - Optional dyslexia highlights: subtle hints on confusable letters (b/d/p/q/m/n/u).
  - TTS available at higher preset or always in Custom.
  - Monitoring agent: offers +0.25 after 15s inactivity, snoozable/disable-able.

- Assessment:
  - Quiz (10 items; mix of image/audio): after submission, frontend POSTs answers + time to /api/predict-dyslexia.
  - Backend computes six interpretable features:
    - Language_vocab, Memory, Speed (time-scaled), Visual_discrimination, Audio_Discrimination, Survey_Score
  - scikit-learn Pipeline (StandardScaler + RandomForest with CV) returns label: 2 (Normal), 1 (Mild), 0 (Severe).
  - Results page maps label → starting preset and stores it; Adapt applies it immediately (or user can choose Custom).

Low Vision
- What we adapt:
  - Preset 1..3 (0.25 steps) with magnification over a 20px base:
    - ~1.25× → ~1.5× → ~2.0× font scaling across the range.
  - Slight letter-spacing increases and generous line heights near 2.0 at the top preset.
  - Color presets for quick high-contrast modes:
    - Preset 2: white text on red background; Preset 3: white text on black background.
  - TTS available at top preset or always in Custom.
  - Monitoring agent identical to Dyslexia.

ADHD
- What we adapt:
  - Cadence highlighting, chunked reading (grouping for focus), optional TL;DR, and TTS at higher presets.
  - Final preset is derived by fusing local quiz severity with backend gaze variability (“ADHD” adds +1 class, clamped) → preset mapping.

- Gaze pipeline (our unique piece):
  - Upload short webcam video + quiz answers → /api/adhd-diagnose.
  - Backend: ffmpeg (WEBM→MP4), face detection (RetinaFace), every 5th frame, ResNet‑18 (Gaze360) for pitch/yaw → time-series in radians.
  - Variability metric: mean L2 norm of successive (pitch,yaw) differences. If > threshold → “ADHD” else “No ADHD.”
  - Immediate file cleanup; only aggregate stats returned.

---

## Frontend, in depth

Stack
- Next.js 14 (App Router), React 18, TypeScript
- Tailwind v4 via @tailwindcss/postcss; global OKLCH tokens in app/globals.css
- shadcn/ui (Radix) components; lucide-react icons
- next-themes for dark/light; fonts via next/font (Outfit, Geist Mono)
- Optional: @google/generative-ai for ADHD TL;DR

Flows
- Paste (all modes): paste or OCR text, stored in localStorage (readapt:text; readapt:lastMode).
- Dyslexia: quiz → results → adapt; label 0/1/2 maps to preset 3/2/1.
- Low Vision: paste → adapt; slider fine-tunes; Custom overrides.
- ADHD: quiz (local) + diagnose (backend gaze) → results fuse → adapt.

Custom builder (Dyslexia + Low Vision)
- Chat-like interface with two layers:
  - Regex overrides for frequent commands
  - Local pure-JS logistic regression classifier for intent (weights JSON), no network needed
- Adjusts font size, letter/word/line spacing, contrast, and fonts; saves to localStorage; Adapt uses Custom if present.

TTS and TL;DR
- TTS: Web Speech API, strict preferred voice (UK female). Toggle on Adapt.
- TL;DR (ADHD): POST /api/adhd-summarizer (Gemini) with text; toggle summarized/full view.

Monitoring agent
- 15s inactivity → dialog to suggest +0.25 preset; snooze 5 minutes; permanently disable via setting. Present in all modes where relevant.

Extension sync (“Adapt in real time”)
- Adapt composes normalized “settings” and posts window message:
  - { type: "READAPT_TRIGGER_EXTENSION", mode, preset?, settings }
- Extension caches settings and can apply them on any website (overlay/inline).

---

## Backend, in depth

Tech
- FastAPI, uvicorn, scikit-learn, numpy/pandas, Pillow, pytesseract, PyTorch/torchvision, OpenCV, uniface (RetinaFace), matplotlib
- System dependencies: ffmpeg, Tesseract

Endpoints
- POST /api/predict-dyslexia
  - Body: { answers: [10 × 0|1|2 or “Low/Medium/High”], time: seconds }
  - Output: { label: 0|1|2, features: [6 floats], debug_log: string }
  - Model: ml/model.pkl = GridSearchCV(Pipeline(StandardScaler + RandomForestClassifier)), tuned on f1_macro.
  - Feature order exactly matches training CSV columns.

- POST /api/ocr
  - multipart/form-data image; returns { text } from Tesseract OCR.
  - Note: default Windows path hardcoded in main.py; see “Local setup” to configure per OS.

- POST /api/adhd-diagnose
  - answers (JSON string) + video (UploadFile)
  - Flow: save temp WEBM → ffmpeg to MP4 → face detection → sample frames → ResNet-18 → softmax over bins → expected deg → radians → time-series → variability → heuristic, cleanup temp files
  - Output: { adhd_gaze_variability, adhd_result: "ADHD" | "No ADHD", num_gaze_frames }

- POST/GET /api/adhd/final
  - Prototype in-memory relay to store the fused decision (final_class, mapped_preset, gaze stats) so Adapt can GET and auto-apply.

Config
- config.py includes sensible defaults for Gaze360 binning:
  - { bins: 90, binwidth: 4, angle: 180 }

Dyslexia training (ml/train.py)
- Reads a CSV with columns:
  - Language_vocab, Memory, Speed, Visual_discrimination, Audio_Discrimination, Survey_Score, Label
- Pipeline: StandardScaler + RandomForestClassifier
- GridSearchCV over n_estimators {10, 100, 500, 1000}, 5-fold CV, scoring f1_macro
- Saves the best pipeline as model.pkl (adjust SAVE_DIR to align with main.py load path)
- Prints metrics and displays confusion matrix.

Why this backend design?
- Interpretability: Dyslexia features are logged and easy to reason about; we return the actual feature values with a debug log.
- Pragmatism: Pre-trained gaze estimation is used as a stable sensor, while our ADHD inference (variability + fusion) is novel and product-specific.
- Privacy: No user video is retained; only aggregate stats are returned. OCR and quiz data flow are minimal and transparent.

---

## Browser extension (MV3)

What it does
- Saves your latest Adapt settings from the site, then applies them on any webpage.
- Two modes:
  - Overlay reader: extracts main/article/body text into a styled panel.
  - Inline: applies global styles (font, size, spacing, colors) directly to the page.
- Guardrails:
  - Always force Overlay for Custom settings and for Low Vision preset ≥ 2 (when source is preset).
  - Detect “Extension context invalidated” and prompt the user to refresh (MV3 resilience).

Files and flow
- manifest.json: MV3 permissions (storage, activeTab, scripting), host_permissions, background worker, content script, popup UI.
- background.js: persists { readaptSettings, readaptConfig } in chrome.storage.sync; responds to GET/SET.
- contentScript.js:
  - Injects a floating “Readapt” button per page.
  - Listens for READAPT_TRIGGER_EXTENSION window message to save settings.
  - Toggles Overlay/Inline adaptation with cleanup, dyslexia hints, and ADHD “every N words” highlighting.
  - Robust to service worker reloads (invalidated).
- popup.html/js:
  - Shows latest settings, “Apply Mode” (Overlay/Inline), per-site disable, last updated time.
  - Mirrors force Overlay rules and disables Inline radio with a clear notice when applicable.

How to test locally
- Open Chrome → Extensions → Enable “Developer mode” → Load unpacked → select frontend/extension.
- In your app, go to an Adapt page and click “Adapt in real time” once to cache settings.
- Visit any site, use the floating “Readapt” button or the popup to apply.

---

## Local setup and running

Prerequisites
- Node.js 18+ (20+ recommended); pnpm 8+ or npm
- Python 3.10+
- System: ffmpeg, Tesseract OCR
  - Windows: Install Tesseract and set the path (example in code uses D:\OCR\tesseract.exe).
  - macOS: `brew install ffmpeg tesseract`
  - Linux: `sudo apt-get install ffmpeg tesseract-ocr`

1) Frontend

Install
```bash
cd frontend
pnpm install   # or: npm install
```

Environment (optional but recommended)
```
# .env.local
# For ADHD TL;DR summaries (optional)
GEMINI_API_KEY=your_google_generative_ai_key

# For the backend proxy (used by Adapt to GET ADHD final)
BACKEND_URL=http://localhost:8000
```

Run
```bash
pnpm dev   # or: npm run dev
# open http://localhost:3000
```

Build & start
```bash
pnpm build
pnpm start
```

2) Backend

Install
```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Run
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Tesseract path (Windows)
- In `backend/main.py` we set:
  - `pytesseract.pytesseract.tesseract_cmd = r"D:\OCR\tesseract.exe"`
- Update this to your installation path, or drive it from an environment variable, e.g.:
  - `pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD", "tesseract")`

3) Extension

- Load `frontend/extension` as “unpacked”.
- In your Adapt page click “Adapt in real time” to push settings.
- Visit any site; press the floating “Readapt” button.

---

## Commands and APIs (quick reference)

Frontend scripts
- `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`

Backend endpoints
- `POST /api/predict-dyslexia`
  - Body: `{ "answers":[...10 items...], "time": <seconds> }`
  - Returns: `{ "label": 0|1|2, "features":[6], "debug_log":"..." }`

- `POST /api/ocr` (multipart)
  - Field: `image` (file)
  - Returns: `{ "text": "...extracted..." }`

- `POST /api/adhd-diagnose` (multipart)
  - Fields: `answers`: JSON string of 10 numbers, `video`: webcam file
  - Returns: `{ "adhd_gaze_variability": float, "adhd_result": "ADHD"|"No ADHD", "num_gaze_frames": int }`

- `POST /api/adhd/final` (JSON)
  - Stores final fused outcome for Adapt to read
- `GET /api/adhd/final`
  - Returns latest stored record

---

## Data & training (Dyslexia and Custom Agent)

Dyslexia training (ml/train.py)
- Dataset CSV columns must be:
  - `Language_vocab, Memory, Speed, Visual_discrimination, Audio_Discrimination, Survey_Score, Label`
- Pipeline: StandardScaler + RandomForest, GridSearchCV over n_estimators.
- Saves `ml/model.pkl` (ensure it matches the path main.py loads).
- Repro:
```bash
python ml/train.py
# copy/ensure ml/model.pkl is in backend/ml/model.pkl or adjust load path
```

Custom agent (agent.ipynb)
- Trains a tiny CountVectorizer + LogisticRegression on labeled intent text pairs.
- Exports:
  - `intent_logreg_weights.json` (labels, vocab, coef, intercept) → used by pure JS classifier in the frontend.
  - Optional: ONNX `intent-classifier.onnx`, `intent_labels.json`, `intent_vectorizer_vocab.json`, and `intent_pipeline.joblib`.
- Benefits:
  - Runs fully offline in the browser
  - Small, fast, and easily swappable by refreshing the JSON

---

## Troubleshooting

- Tesseract not found (OCR)
  - Windows: update `tesseract_cmd` path in backend.
  - macOS/Linux: ensure `tesseract` is on PATH.

- Video diagnose fails (ADHD)
  - Ensure ffmpeg is installed and in PATH.
  - Try recording a few more seconds.
  - Verify the service handles WEBM uploads (Chrome) → conversion to MP4.

- Extension button disabled with notice
  - MV3 service worker likely reloaded; refresh the page.

- ADHD TL;DR returns empty
  - Set `GEMINI_API_KEY` and restart `pnpm dev`.

- Dyslexia model path mismatch
  - If you trained in a different folder, copy model.pkl to `backend/ml/model.pkl` or adjust `main.py` to your path.

---

## Why this approach is strong

- Accessibility-first UX: Presets for quick wins, Custom for control, guardrails to keep users safe and pages readable.
- Interpretable ML for Dyslexia: engineered features, transparent logs, and a small model tuned for macro-F1.
- Product-specific ADHD signal: leveraging a pre-trained gaze estimator ethically as a sensor, we built the variability heuristic, thresholds, fusion, and UX around it.
- Privacy and performance: Local intent classification; minimal backend payloads; no video persisted; extension adapts entirely client-side.
- Extensibility: ONNX pathways for the intent agent and gaze backbones, swappable models (MobileNet/MobileOne), and a simple settings contract shared across app and extension.

---

## Project structure (excerpt)

```
frontend/
  app/               # Next.js App Router pages (modes, quiz, results, adapt, custom)
  components/        # Header, Particles, shadcn/ui primitives, ThemeProvider
  lib/               # customSettings, lowVisionCustomSettings, intentClassifierLocal
  public/models/     # intent classifier JSON/ONNX (agent exports)
  extension/         # Chrome MV3 extension (manifest, background, contentScript, popup)
backend/
  main.py            # FastAPI app (OCR, Dyslexia, ADHD diagnose, ADHD final relay)
  ml/
    train.py         # Dyslexia training pipeline (scikit-learn)
    model.pkl        # Saved pipeline (scaler + RF + CV)
  utils/
    gaze_adapt_backend.py  # Gaze time-series + variability
  models/            # Gaze backbones (resnet, mobilenet, mobileone)
  weights/
    resnet18.pt      # Pre-trained gaze weights (Gaze360 baseline)
```

—

Built for Accessibility
