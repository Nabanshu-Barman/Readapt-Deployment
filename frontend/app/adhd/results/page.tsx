"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import Link from "next/link"

/**
 * Final ADHD severity rule:
 *   finalSeverity = quizClass + (gazeResult == "ADHD" ? 1 : 0)
 *   Clamped to max 3
 */

type Metric = {
  key: string
  label: string
  explain: string
  getter: (d: Ctx) => string | number | null
}

interface Ctx {
  quizClass: number
  gazeVariability: number | null
  gazePoints: number | null
  adhdResult: string | null
  adhdPrediction: string
  finalClass: number
}

const CLASS_META: Record<number, {
  title: string
  desc: string
  chip: string
  preset: string
  color: string
  mappedPreset: number
}> = {
  0: {
    title: "No ADHD (Class 0)",
    desc: "Minimal ADHD traits in quiz & gaze signals. Standard reading mode recommended.",
    chip: "bg-emerald-500/15 text-emerald-400",
    preset: "Preset 1 • Normal reading (no cadence highlighting)",
    color: "emerald",
    mappedPreset: 1
  },
  1: {
    title: "Inattentive (Class 1)",
    desc: "Inattention signals present. Cadence highlighting (every 3rd word) may help sustain focus.",
    chip: "bg-sky-500/15 text-sky-400",
    preset: "Preset 2 • Highlight every 3rd word",
    color: "sky",
    mappedPreset: 2
  },
  2: {
    title: "Hyperactive‑Impulsive (Class 2)",
    desc: "Hyperactivity / impulsivity patterns emerged. Sentence chunk spacing & cadence highlighting suggested.",
    chip: "bg-violet-500/15 text-violet-400",
    preset: "Preset 3 • Chunk sentences + highlight every 3rd word + TL;DR toggle",
    color: "violet",
    mappedPreset: 3
  },
  3: {
    title: "Combined (Class 3)",
    desc: "Both inattention and hyperactive traits appear. Full toolkit recommended (chunking, highlight, TTS, TL;DR).",
    chip: "bg-rose-500/15 text-rose-400",
    preset: "Preset 4 • Chunking + highlight + TTS + TL;DR + structural emphasis",
    color: "rose",
    mappedPreset: 4
  }
}

const METRICS: Metric[] = [
  {
    key: "quizClass",
    label: "Quiz Class",
    explain: "Heuristic severity from questionnaire responses",
    getter: ({ quizClass }) => quizClass
  },
  {
    key: "gazePoints",
    label: "Gaze Frames",
    explain: "Frames analyzed by gaze model (after stride sampling)",
    getter: ({ gazePoints }) => gazePoints ?? "—"
  },
  {
    key: "gazeVariability",
    label: "Gaze Variability (rad)",
    explain: "Mean inter‑frame angular displacement",
    getter: ({ gazeVariability }) => gazeVariability != null ? gazeVariability.toFixed(4) : "—"
  },
  {
    key: "adhdResult",
    label: "Gaze Heuristic Result",
    explain: "Binary threshold outcome (0.248 rad)",
    getter: ({ adhdResult }) => adhdResult ?? "—"
  },
  {
    key: "finalClass",
    label: "Final Combined Class",
    explain: "quizClass + (gazeResult == ADHD ? 1 : 0), clamped ≤ 3",
    getter: ({ finalClass }) => finalClass
  }
]

export default function ADHDResultsPage() {
  const [loading, setLoading] = useState(true)

  // Hydration/readiness
  const [hydrated, setHydrated] = useState(false)

  // Source values (raw)
  const [quizClass, setQuizClass] = useState(0)
  const [adhdPrediction, setAdhdPrediction] = useState("No ADHD")
  const [gazePoints, setGazePoints] = useState<number | null>(null)
  const [gazeVariability, setGazeVariability] = useState<number | null>(null)
  const [adhdResult, setAdhdResult] = useState<string | null>(null)
  const [rawBackendLog, setRawBackendLog] = useState<string | null>(null)

  // Prevent duplicate POST to backend final relay
  const postedFinalRef = useRef(false)

  // Computed final class (rule)
  const finalClass = useMemo(() => {
    const base = quizClass
    const bump = adhdResult === "ADHD" ? 1 : 0
    const fc = Math.min(3, Math.max(0, base + bump))
    return fc
  }, [quizClass, adhdResult])

  // Load from storage (hydrate)
  useEffect(() => {
    try {
      const q = Number(localStorage.getItem("readapt:adhdQuizClass") ?? "0")
      const pred = localStorage.getItem("readapt:adhdPrediction") ?? "No ADHD"
      const points = localStorage.getItem("readapt:adhdGazePoints")
      const varStr = localStorage.getItem("readapt:adhdGazeVariability")
      const res = localStorage.getItem("readapt:adhdGazeResult")
      const raw = localStorage.getItem("readapt:adhd_debug_log")

      console.groupCollapsed("%c[ADHD Results] Hydrate from localStorage", "color:#6b7280")
      console.log("adhdQuizClass        =", q)
      console.log("adhdPrediction       =", pred)
      console.log("adhdGazePoints       =", points ? Number(points) : null)
      console.log("adhdGazeVariability  =", varStr ? Number(varStr) : null)
      console.log("adhdGazeResult       =", res)
      console.groupEnd()

      setQuizClass(q)
      setAdhdPrediction(pred)
      setGazePoints(points ? Number(points) : null)
      setGazeVariability(varStr ? Number(varStr) : null)
      setAdhdResult(res || null)
      if (raw) setRawBackendLog(raw)

      // Mark hydrated immediately after we load localStorage
      setHydrated(true)

      // Loading spinner just for UX
      const timer = setTimeout(() => setLoading(false), 250)
      return () => clearTimeout(timer)
    } catch (e) {
      console.error("[ADHD Results] Hydration error:", e)
      setHydrated(true)
      setLoading(false)
    }
  }, [])

  // Persist new computed final class & preset + POST to backend relay
  useEffect(() => {
    // Do nothing until hydration finished (prevents early write of Preset 1)
    if (!hydrated) {
      // Helpful diagnostic
      console.debug("[ADHD Results] Persist skipped (not hydrated yet)")
      return
    }

    // Require a concrete gaze result string before persisting (either 'ADHD' or 'No ADHD')
    const hasGazeResult = adhdResult === "ADHD" || adhdResult === "No ADHD"
    if (!hasGazeResult) {
      console.debug("[ADHD Results] Persist deferred (gaze result not ready):", adhdResult)
      return
    }

    const mappedPreset = (CLASS_META[finalClass] ?? CLASS_META[0]).mappedPreset

    console.groupCollapsed("%c[ADHD Results] Persist computed result", "color:#10b981")
    console.log("hydrated      =", hydrated)
    console.log("quizClass     =", quizClass)
    console.log("adhdResult    =", adhdResult)
    console.log("finalClass    =", finalClass)
    console.log("mappedPreset  =", mappedPreset)
    console.groupEnd()

    // Persist to localStorage (Adapt page reads this first)
    try {
      localStorage.setItem("readapt:adhdFinalClass", String(finalClass))
      localStorage.setItem("readapt:adhdPreset", String(mappedPreset))
    } catch (e) {
      console.warn("[ADHD Results] localStorage persist failed:", e)
    }

    // Also POST to backend relay via proxy so Adapt can GET a reliable value
    // Only post once per page view (after hydration) to avoid racing with an early default
    if (!postedFinalRef.current) {
      postedFinalRef.current = true
      fetch("/api/adhd/final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          final_class: finalClass,
          mapped_preset: mappedPreset,
          quiz_class: quizClass,
          adhd_result: adhdResult,
          gaze_variability: gazeVariability,
          gaze_points: gazePoints
        })
      })
        .then(async (r) => {
          let data: any = {}
          try {
            data = await r.json()
          } catch {}
          console.groupCollapsed("%c[ADHD Results] Posted to /api/adhd/final", "color:#3b82f6")
          console.log("status        =", r.status)
          console.log("response      =", data)
          console.groupEnd()
        })
        .catch((e) => {
          console.error("[ADHD Results] POST /api/adhd/final failed:", e)
        })
    }
  }, [hydrated, finalClass, quizClass, adhdResult, gazeVariability, gazePoints])

  const clsMeta = CLASS_META[finalClass] ?? CLASS_META[0]

  const metricRows = useMemo(() => {
    const ctx: Ctx = {
      quizClass,
      finalClass,
      gazeVariability,
      gazePoints,
      adhdResult,
      adhdPrediction
    }
    return METRICS.map(m => ({
      ...m,
      value: m.getter(ctx)
    }))
  }, [quizClass, finalClass, gazeVariability, gazePoints, adhdResult, adhdPrediction])

  const synthesizedLog = useMemo(() => {
    if (rawBackendLog) return rawBackendLog
    return [
      "===== ADHD Result (Computed Client Rule) =====",
      `Quiz Class:               ${quizClass}`,
      `Gaze Frames:              ${gazePoints ?? "N/A"}`,
      `Gaze Variability (rad):   ${gazeVariability != null ? gazeVariability.toFixed(6) : "N/A"}`,
      `Threshold (rad):          0.248000`,
      `Gaze Heuristic Result:    ${adhdResult ?? "N/A"}`,
      `Classifier Tag:           ${adhdPrediction}`,
      `Computed Final Class:     ${finalClass}  (quiz ${quizClass} + ${adhdResult === "ADHD" ? "1" : "0"})`,
      `Mapped Preset:            ${CLASS_META[finalClass].mappedPreset}`,
      "NOTE: Heuristic, non-diagnostic.",
      "============================================="
    ].join("\n")
  }, [rawBackendLog, quizClass, gazePoints, gazeVariability, adhdResult, adhdPrediction, finalClass])

  // --- NEW: Finance Button Logic ---
  const financePresetPath = useMemo(() => {
    const mappedPreset = (CLASS_META[finalClass] ?? CLASS_META[0]).mappedPreset
    // Always route to dashboard of the correct preset
    return `/fintech/preset${mappedPreset}/dashboard`
  }, [finalClass])

  // --- END NEW ---

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Header variant="adhd-results" />
      <section className="mx-auto max-w-[1180px] px-4 md:px-8 pt-10 pb-24">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Summary Panel */}
          <div className="relative col-span-1 lg:col-span-2 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 backdrop-blur-xl shadow-[0_8px_40px_-14px_rgba(0,0,0,0.45)] overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_30%,rgba(255,255,255,0.18),transparent_60%),radial-gradient(circle_at_78%_70%,rgba(255,255,255,0.15),transparent_65%)]"
            />
            <div className="relative z-10 space-y-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="h-16 w-16 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
                  <h2 className="mt-6 text-2xl font-semibold tracking-tight">
                    Processing your signals...
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Combining questionnaire + gaze variability.
                  </p>
                </div>
              ) : (
                <>
                  <header className="space-y-4">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                      ADHD Assessment Result
                    </h1>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ring-inset ring-white/15 ${clsMeta.chip}`}>
                        <span className="h-2 w-2 rounded-full bg-current" /> {clsMeta.title}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Final Class {finalClass}
                      </span>
                      {gazeVariability != null && (
                        <span className="text-xs rounded-full bg-white/5 px-3 py-1 font-medium text-muted-foreground">
                          Variability {gazeVariability.toFixed(3)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm md:text-base leading-relaxed text-muted-foreground">
                      {clsMeta.desc}
                    </p>
                  </header>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                    <h3 className="text-sm font-semibold tracking-wide uppercase text-primary/80">
                      Applied / Recommended Preset
                    </h3>
                    <p className="text-sm leading-relaxed">
                      {clsMeta.preset}
                    </p>
                    <ul className="text-xs leading-relaxed text-muted-foreground space-y-1">
                      <li><strong>Preset 1</strong>: Normal text display.</li>
                      <li><strong>Preset 2</strong>: Highlight every 3rd word.</li>
                      <li><strong>Preset 3</strong>: Sentence chunk spacing + highlight + TL;DR toggle.</li>
                      <li><strong>Preset 4</strong>: Chunking + highlight + TTS + TL;DR + structure cues.</li>
                    </ul>
                    <p className="text-[11px] text-muted-foreground/70">
                      You can further tweak these in the adaptation or custom preset builder.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-xl h-11 px-6 font-medium"
                    >
                      <Link href="/adhd/quiz">Redo Assessment</Link>
                    </Button>
                    <Button
                      asChild
                      className="rounded-xl h-11 px-6 font-semibold"
                    >
                      <Link href="/adhd/paste">Paste Text</Link>
                    </Button>
                    {/* --- Readapt Finance Button removed --- */}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Breakdown Panel */}
          <div className="col-span-1 lg:col-span-3 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 backdrop-blur-xl shadow-[0_8px_40px_-14px_rgba(0,0,0,0.45)] flex flex-col">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-6">
              Signal Breakdown
            </h2>

            {!loading && (
              <>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      <tr className="border-b border-white/10">
                        <th className="py-3 pl-5 pr-3 text-left font-medium">Metric</th>
                        <th className="px-3 py-3 text-left font-medium">Meaning</th>
                        <th className="px-3 py-3 text-left font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricRows.map(m => (
                        <tr
                          key={m.key}
                          className="border-b border-white/5 last:border-none hover:bg-white/5 transition-colors"
                        >
                          <td className="py-3 pl-5 pr-3 font-medium">{m.label}</td>
                          <td className="px-3 py-3 text-muted-foreground">{m.explain}</td>
                          <td className="px-3 py-3">
                            {m.key === "adhdResult" ? (
                              <span
                                className={`text-xs font-extrabold tabular-nums ${
                                  adhdResult === "ADHD"
                                    ? "text-rose-500"
                                    : adhdResult === "No ADHD"
                                    ? "text-emerald-500"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {m.value as any}
                              </span>
                            ) : m.key === "quizClass" ? (
                              <span className="text-xs font-extrabold tabular-nums text-foreground">
                                {m.value as any}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold tabular-nums">
                                {m.value as any}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Raw Backend / Log */}
                <div className="mt-8">
                  <details className="group rounded-2xl border border-white/10 bg-white/5">
                    <summary className="cursor-pointer select-none list-none p-4 font-medium text-sm flex items-center justify-between">
                      <span>Raw Backend Result Log</span>
                      <span className="text-xs text-primary/70 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <pre className="pb-4 px-4 text-[11px] leading-relaxed overflow-auto whitespace-pre-wrap text-muted-foreground/90">
{synthesizedLog}
                    </pre>
                  </details>
                </div>
              </>
            )}

            {loading && (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-12 w-12 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Preparing signal breakdown…</p>
                </div>
              </div>
            )}

            <p className="mt-10 text-[11px] leading-relaxed text-muted-foreground">
              Prototype – not a diagnostic instrument. Fusion rule = quizClass + (gaze ADHD? 1 : 0) capped at 3.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}