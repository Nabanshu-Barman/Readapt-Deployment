"use client";

/**
 * Instrumented intent classifier for developer debugging.
 * Returns just the intent label (string).
 *
 * Public assets required:
 *   /public/models/intent-classifier.onnx
 *   /public/models/intent_labels.json
 *
 * Debug info is attached to:
 *   window.__READAPT_INTENT_DBG
 *
 * You can call in console:
 *   await window.__READAPT_INTENT_DBG.debugClassify("make it bigger")
 */

import type * as ortTypes from "onnxruntime-web";

const MODEL_URL = "/models/intent-classifier.onnx";
const LABELS_URL = "/models/intent_labels.json";

let ort: typeof import("onnxruntime-web") | null = null;
let session: ortTypes.InferenceSession | null = null;
let labels: string[] | null = null;
let initialized = false;

interface DebugStore {
  modelUrl: string;
  labelsUrl: string;
  inputNames?: string[];
  outputNames?: string[];
  lastRun?: {
    text: string;
    usedInputShape: string;
    outputKeys: string[];
    tensors: Record<string, any>;
    chosenIntent: string;
    path: string;
    error?: any;
  };
  labels?: string[];
  errorDuringInit?: any;
  debugClassify?: (t: string) => Promise<string>;
}

declare global {
  interface Window {
    __READAPT_INTENT_DBG?: DebugStore;
  }
}

function ensureGlobalStore(): DebugStore {
  if (typeof window === "undefined") return { modelUrl: MODEL_URL, labelsUrl: LABELS_URL };
  if (!window.__READAPT_INTENT_DBG) {
    window.__READAPT_INTENT_DBG = {
      modelUrl: MODEL_URL,
      labelsUrl: LABELS_URL,
    };
  }
  return window.__READAPT_INTENT_DBG;
}

function softmax(logits: number[]) {
  const m = Math.max(...logits);
  const exps = logits.map(v => Math.exp(v - m));
  const s = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / s);
}

async function importOrt() {
  if (!ort) {
    ort = await import("onnxruntime-web");
    // Optional performance tweaks
    try {
      ort.env.wasm.simd = true;
      ort.env.wasm.numThreads = 1;
    } catch {
      /* ignore */
    }
  }
}

export async function loadIntentModel() {
  const dbg = ensureGlobalStore();
  if (initialized) return;
  try {
    if (typeof window === "undefined") return;
    await importOrt();

    if (!labels) {
      const res = await fetch(LABELS_URL, { cache: "force-cache" });
      if (!res.ok) throw new Error("Failed to fetch labels JSON");
      labels = await res.json();
      dbg.labels = labels;
    }

    if (!session) {
      session = await ort!.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
      });
      dbg.inputNames = session.inputNames.slice();
      dbg.outputNames = session.outputNames.slice();
      // eslint-disable-next-line no-console
      console.log("[IntentModel] Loaded. inputNames=", dbg.inputNames, "outputNames=", dbg.outputNames);
    }

    initialized = true;
  } catch (e) {
    const dbgStore = ensureGlobalStore();
    dbgStore.errorDuringInit = e;
    // eslint-disable-next-line no-console
    console.error("[IntentModel] Initialization error:", e);
    throw e;
  }

  // Expose helper
  if (typeof window !== "undefined") {
    ensureGlobalStore().debugClassify = async (t: string) => classifyIntent(t);
  }
}

function summarizeTensor(data: any) {
  if (!data) return "null";
  if (data instanceof Float32Array || data instanceof Int32Array || data instanceof BigInt64Array) {
    return `TypedArray(len=${data.length}, first3=[${Array.from(data).slice(0, 3).join(", ")}])`;
  }
  if (Array.isArray(data)) {
    return `Array(len=${data.length}, first3=[${data.slice(0, 3).join(", ")}])`;
  }
  if (typeof data === "object") {
    return `{keys:${Object.keys(data)}}`;
  }
  return String(data);
}

export async function classifyIntent(text: string): Promise<string> {
  const dbg = ensureGlobalStore();
  if (typeof window === "undefined") return "other";
  await loadIntentModel();
  if (!session || !labels || !ort) return "other";

  const outputsSummary: Record<string, any> = {};

  const runWithShape = async (shape: "1x1" | "1") => {
    const inputName = session!.inputNames[0];
    try {
      let tensor;
      if (shape === "1x1") {
        tensor = new ort!.Tensor("string", [text], [1, 1]);
      } else {
        tensor = new ort!.Tensor("string", [text], [1]);
      }
      const output = await session!.run({ [inputName]: tensor });

      Object.keys(output).forEach(k => {
        const d = output[k].data;
        outputsSummary[k] = summarizeTensor(d);
      });

      // 1. Direct label outputs
      const labelKey = Object.keys(output).find(k => /label/i.test(k));
      if (labelKey) {
        const rawData = output[labelKey].data as any;
        const first = rawData[0];
        if (typeof first === "string") {
            dbg.lastRun = {
              text,
              usedInputShape: shape,
              outputKeys: Object.keys(output),
              tensors: outputsSummary,
              chosenIntent: first,
              path: "label:string",
            };
            return first as string;
        }
        if (typeof first === "number" || typeof first === "bigint") {
          const idx = Number(first);
          const label = labels[idx] || "other";
          dbg.lastRun = {
            text,
            usedInputShape: shape,
            outputKeys: Object.keys(output),
            tensors: outputsSummary,
            chosenIntent: label,
            path: "label:index",
          };
          return label;
        }
      }

      // 2. Probability-like outputs (choose largest length Float32Array)
      let probTensor: Float32Array | null = null;
      for (const k of Object.keys(output)) {
        const d = output[k].data;
        if (d instanceof Float32Array) {
          if (!probTensor || d.length > probTensor.length) probTensor = d;
        }
      }
      if (probTensor) {
        const logits = Array.from(probTensor);
        const probs = softmax(logits);
        let best = 0;
        for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
        const chosen = labels[best] || "other";
        dbg.lastRun = {
          text,
          usedInputShape: shape,
            outputKeys: Object.keys(output),
            tensors: outputsSummary,
            chosenIntent: chosen,
            path: "probabilities",
        };
        return chosen;
      }

      dbg.lastRun = {
        text,
        usedInputShape: shape,
        outputKeys: Object.keys(output),
        tensors: outputsSummary,
        chosenIntent: "other",
        path: "no-match",
      };
      return "other";
    } catch (e) {
      outputsSummary["__errorShape" + shape] = String(e);
      return null;
    }
  };

  // Try preferred shape [1,1] first
  let result = await runWithShape("1x1");
  if (result == null) {
    // fallback to [1] shape
    result = await runWithShape("1") || "other";
  }

  // eslint-disable-next-line no-console
  console.log("[IntentModel] finalDecision:", dbg.lastRun);
  return result;
}