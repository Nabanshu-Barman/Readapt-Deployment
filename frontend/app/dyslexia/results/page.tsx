"use client"

import { useEffect, useState, useMemo } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import Link from "next/link"

type FeatureMap = {
  key: string
  label: string
  explain: string
}

const FEATURE_ORDER: FeatureMap[] = [
  { key: "Language_vocab",       label: "Word & Language Skill",    explain: "Recognizing letters & familiar words" },
  { key: "Memory",               label: "Short‑Term Memory",        explain: "Holding word / letter info briefly" },
  { key: "Speed",                label: "Reading Pace Factor",      explain: "Relative speed (shorter time → higher score)" },
  { key: "Visual_discrimination",label: "Visual Letter Clarity",    explain: "Distinguishing similar letter shapes" },
  { key: "Audio_Discrimination", label: "Sound Recognition",        explain: "Separating similar speech sounds" },
  { key: "Survey_Score",         label: "Overall Difficulty Index", explain: "Self‑reported + aggregate challenge" },
]

const LABEL_TEXT: Record<number, { name: string; preset: string; desc: string; chip: string; mappedPreset: number }> = {
  2: {
    name: "Normal",
    preset: "Normal reading mode",
    desc: "No strong dyslexia indicators. Standard spacing & visuals applied.",
    chip: "bg-emerald-500/15 text-emerald-500",
    mappedPreset: 1
  },
  1: {
    name: "Mild",
    preset: "Moderate spacing & interline spacing",
    desc: "Some mild indicators. Gentle spacing adjustments will assist decoding.",
    chip: "bg-amber-500/15 text-amber-500",
    mappedPreset: 2
  },
  0: {
    name: "Severe",
    preset: "Heavy spacing + letter highlights + TTS suggestion",
    desc: "Stronger indicators. We’ll maximize spacing, highlight mirror letters, and suggest enabling TTS.",
    chip: "bg-rose-500/15 text-rose-500",
    mappedPreset: 3
  },
}

interface ComputationRow {
  rawName: string
  value: number
  meta?: FeatureMap
}

export default function ResultsPage() {
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState<number>(1)
  const [timeSeconds, setTimeSeconds] = useState<number | null>(null)
  const [features, setFeatures] = useState<number[] | null>(null)
  const [debugLog, setDebugLog] = useState<string | null>(null)

  useEffect(() => {
    const lbl = Number(localStorage.getItem("readapt:label") ?? "1")
    const normalizedLabel = [0,1,2].includes(lbl) ? lbl : 1
    setLabel(normalizedLabel)
    const t = Number(localStorage.getItem("readapt:time") ?? "0")
    if (!Number.isNaN(t)) setTimeSeconds(t)

    try {
      const fRaw = localStorage.getItem("readapt:features")
      if (fRaw) {
        const arr = JSON.parse(fRaw)
        if (Array.isArray(arr) && arr.length === 6) setFeatures(arr.map(Number))
      }
    } catch {}

    const dbg = localStorage.getItem("readapt:debug_log")
    if (dbg) setDebugLog(dbg)

    // Set initial preset suggestion (user can still adjust later on adapt page)
    const mappedPreset = LABEL_TEXT[normalizedLabel].mappedPreset
    localStorage.setItem("readapt:dyslexiaPreset", String(mappedPreset))

    const timer = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(timer)
  }, [])

  const featureRows: ComputationRow[] = useMemo(() => {
    if (!features) return []
    return FEATURE_ORDER.map((fm, idx) => ({
      rawName: fm.key,
      value: features[idx],
      meta: fm
    }))
  }, [features])

  const severity = LABEL_TEXT[label]

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Header variant="results" />

      <section className="mx-auto max-w-[1180px] px-4 md:px-8 pt-10 pb-24">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Summary */}
          <div className="relative col-span-1 lg:col-span-2 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 backdrop-blur-xl shadow-[0_8px_40px_-14px_rgba(0,0,0,0.45)] overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(255,255,255,0.18),transparent_60%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.15),transparent_65%)]" />
            <div className="relative z-10 space-y-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="h-16 w-16 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
                  <h2 className="mt-6 text-2xl font-semibold tracking-tight">Analyzing your responses...</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Determining optimal reading preset.</p>
                </div>
              ) : (
                <>
                  <header className="space-y-3">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                      Dyslexia Assessment Result
                    </h1>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ring-inset ring-white/15 ${severity.chip}`}>
                        <span className="h-2 w-2 rounded-full bg-current" /> Severity: {severity.name}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Label {label}
                      </span>
                      {timeSeconds !== null && (
                        <span className="text-xs rounded-full bg-white/5 px-3 py-1 font-medium text-muted-foreground">
                          Time: {timeSeconds}s
                        </span>
                      )}
                    </div>
                    <p className="text-sm md:text-base leading-relaxed text-muted-foreground">
                      {severity.desc}
                    </p>
                  </header>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                    <h3 className="text-sm font-semibold tracking-wide uppercase text-primary/80">
                      Applied / Recommended Preset
                    </h3>
                    <p className="text-sm leading-relaxed">{severity.preset}</p>
                    <ul className="text-xs leading-relaxed text-muted-foreground space-y-1">
                      <li><strong>Label 2</strong>: Normal reading mode.</li>
                      <li><strong>Label 1</strong>: Moderate spacing + moderate interline spacing.</li>
                      <li><strong>Label 0</strong>: Heavy spacing + heavy interline spacing + mirror letter highlight (b/d, p/q, etc.) + TTS suggestion.</li>
                    </ul>
                    <p className="text-[11px] text-muted-foreground/70">
                      You can still manually adjust on the adaptation page.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Button asChild variant="outline" className="rounded-xl h-11 px-6 font-medium">
                      <Link href="/dyslexia/quiz">Redo Assessment</Link>
                    </Button>
                    <Button asChild className="rounded-xl h-11 px-6 font-semibold">
                      <Link href="/dyslexia/paste">Paste Text</Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Feature Breakdown */}
          <div className="col-span-1 lg:col-span-3 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 backdrop-blur-xl shadow-[0_8px_40px_-14px_rgba(0,0,0,0.45)] flex flex-col">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-6">
              Feature Breakdown
            </h2>

            {!loading && (
              <>
                {featureRows.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wider text-muted-foreground/70">
                        <tr className="border-b border-white/10">
                          <th className="py-3 pl-5 pr-3 text-left font-medium">Component</th>
                          <th className="px-3 py-3 text-left font-medium">Plain Meaning</th>
                          <th className="px-3 py-3 text-left font-medium">Score (0–1)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {featureRows.map(row => (
                          <tr
                            key={row.rawName}
                            className="border-b border-white/5 last:border-none hover:bg-white/5 transition-colors"
                          >
                            <td className="py-3 pl-5 pr-3 font-medium">
                              {row.meta?.label}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {row.meta?.explain}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary via-sky-500 to-violet-500"
                                    style={{ width: `${(row.value * 100).toFixed(1)}%` }}
                                  />
                                </div>
                                <span className="w-14 tabular-nums text-xs font-semibold text-foreground/90">
                                  {row.value.toFixed(2)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-6">
                    Feature scores not stored for this session. Retake to populate them.
                  </p>
                )}

                {debugLog && (
                  <div className="mt-8">
                    <details className="group rounded-2xl border border-white/10 bg-white/5">
                      <summary className="cursor-pointer select-none list-none p-4 font-medium text-sm flex items-center justify-between">
                        <span>Raw Backend Computation Log</span>
                        <span className="text-xs text-primary/70 group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <pre className="pb-4 px-4 text-[11px] leading-relaxed overflow-auto whitespace-pre-wrap text-muted-foreground/90">
{debugLog}
                      </pre>
                    </details>
                  </div>
                )}

                {!debugLog && (
                  <p className="mt-6 text-[11px] text-muted-foreground/70">
                    Readapt
                  </p>
                )}
              </>
            )}

            {loading && (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-12 w-12 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Preparing feature breakdown…</p>
                </div>
              </div>
            )}

            <p className="mt-10 text-[11px] leading-relaxed text-muted-foreground">
              This tool is experimental and not a clinical diagnostic. Assistive use only.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}