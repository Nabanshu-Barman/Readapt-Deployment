/**
 * Pure JS Logistic Regression intent classifier.
 * Requires /public/models/intent_logreg_weights.json (generated in Python).
 *
 * Usage:
 *   await loadLocalIntentModel();
 *   const intent = classifyIntentLocal("make it bigger");
 */

interface WeightsFile {
  labels: string[];
  vocab: string[];
  coef: number[][];
  intercept: number[];
}

let WEIGHTS: WeightsFile | null = null;
let TOKEN_TO_INDEX: Record<string, number> = {};
let NUM_CLASSES = 0;
let VOCAB_SIZE = 0;

export async function loadLocalIntentModel() {
  if (WEIGHTS) return;
  const res = await fetch("/models/intent_logreg_weights.json", { cache: "force-cache" });
  if (!res.ok) throw new Error("Failed to load intent_logreg_weights.json");
  WEIGHTS = await res.json();
  NUM_CLASSES = WEIGHTS.labels.length;
  VOCAB_SIZE = WEIGHTS.vocab.length;
  TOKEN_TO_INDEX = {};
  WEIGHTS.vocab.forEach((tok, i) => { TOKEN_TO_INDEX[tok] = i; });
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function vectorize(tokens: string[]): Float32Array {
  const vec = new Float32Array(VOCAB_SIZE);
  for (const t of tokens) {
    const idx = TOKEN_TO_INDEX[t];
    if (idx !== undefined) vec[idx] += 1;
  }
  return vec;
}

function softmax(logits: number[]) {
  const m = Math.max(...logits);
  const exps = logits.map(v => Math.exp(v - m));
  const s = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / s);
}

export async function classifyIntentLocal(text: string, minConfidence = 0): Promise<{ intent: string; confidence: number; probs: number[] }> {
  await loadLocalIntentModel();
  if (!WEIGHTS) return { intent: "other", confidence: 0, probs: [] };

  const tokens = tokenize(text);
  const vec = vectorize(tokens);

  // Compute logits: (coef * x + intercept) per class
  const logits: number[] = new Array(NUM_CLASSES).fill(0);
  for (let c = 0; c < NUM_CLASSES; c++) {
    let sum = WEIGHTS.intercept[c];
    const row = WEIGHTS.coef[c];
    // Sparse iteration possible; simple dense loop is fast enough for tiny vocab
    for (let i = 0; i < VOCAB_SIZE; i++) {
      const val = vec[i];
      if (val !== 0) sum += row[i] * val;
    }
    logits[c] = sum;
  }

  const probs = softmax(logits);
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  const confidence = probs[best];
  const rawIntent = WEIGHTS.labels[best];

  // Optionally treat very low confidence as "other"
  const intent = confidence < minConfidence ? "other" : rawIntent;
  return { intent, confidence, probs };
}