"use client"

/*
  Dev notes (Nabanshu): Added opt-in 60s monitoring window for ADHD Adapt page.
  - "Monitor me" starts a 60s window; we record one random 20s WEBM clip inside that window and POST to /api/adhd-diagnose.
  - Thresholds: 0.229–<0.30 → suggest "Chunk text"; ≥0.30 → suggest "TL;DR".
  - After one suggestion popup, enforce a 5-minute cooldown (persisted). Clicking "Monitor me" again is allowed anytime.
  - Removed the previous 15s inactivity agent and its dialog as requested. All other functionality is unchanged.
*/

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  loadADHDCustomSettings,
  clearADHDCustomSettings,
  ADHDCustomSettings,
} from "@/lib/adhdCustomSettings"

/* =========================================================
   Types
========================================================= */
type AdhdClass = 0 | 1 | 2 | 3

interface ReadaptSettingsADHD {
  mode: "adhd"
  timestamp: number
  source: "custom" | "preset"
  fontSize: number
  fontFamily?: string
  fontFamilyIndex?: number
  contrastIndex?: number
  fontColor: string
  backgroundColor: string
  letterSpacing: number
  wordSpacing: number
  lineSpacing: number
  adhdHighlightEvery?: number
  adhdHighlightOpacity?: number
}

/* =========================================================
   Gaze diagnose thresholds + helpers
========================================================= */
const VAR_CHUNK_MIN = 0.229
const VAR_TLDR_MIN = 0.30
const MONITOR_WINDOW_MS = 12_000
const CAPTURE_MS = 8_000
const COOLDOWN_MS = 5 * 60_000

function pickBackendUrl() {
  return "/api/backend"
}

/* =========================================================
   Text Utilities
========================================================= */
function splitIntoSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/).map(s => s.trim())
  const filtered = parts.filter(Boolean)
  if (filtered.length <= 1) {
    return text
      .split(/\n+/)
      .map(l => l.trim())
      .filter(Boolean)
  }
  return filtered
}

function chunkBy<T>(arr: T[], size: number): T[][] {
  const res: T[][] = []
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size))
  return res
}

function HighlightEveryThird({ text, opacity }: { text: string; opacity: number }) {
  const words = text.split(/\s+/)
  return (
    <span>
      {words.map((w, i) => {
        const isThird = (i + 1) % 3 === 0
        return (
          <span
            key={i}
            style={
              isThird
                ? {
                    backgroundColor: `color-mix(in oklab, var(--primary) ${Math.min(
                      Math.round(opacity * 100),
                      60
                    )}%, transparent)`,
                  }
                : undefined
            }
            className={isThird ? "px-0.5 rounded-sm" : undefined}
          >
            {w}{i < words.length - 1 ? " " : ""}
          </span>
        )
      })}
    </span>
  )
}

function HighlightCustom({
  text,
  every,
  opacity,
}: {
  text: string
  every: number
  opacity: number
}) {
  if (every < 2 || every > 8) return <>{text}</>
  const words = text.split(/\s+/)
  return (
    <span>
      {words.map((w, i) => {
        const mark = (i + 1) % every === 0
        return (
          <span
            key={i}
            className={mark ? "px-1 rounded-sm" : undefined}
            style={
              mark
                ? {
                    backgroundColor: `color-mix(in oklab, var(--primary) ${Math.min(
                      Math.round(opacity * 100),
                      65
                    )}%, transparent)`,
                  }
                : undefined
            }
          >
            {w}{i < words.length - 1 ? " " : ""}
          </span>
        )
      })}
    </span>
  )
}

/* =========================================================
   Component
========================================================= */
export default function ADHDAdaptPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const urlPresetAppliedRef = useRef(false)

  // States
  const [rawText, setRawText] = useState("Loading...")
  const [cls, setCls] = useState<AdhdClass>(0)
  const [preset, setPreset] = useState<number>(1)

  // Monitoring (new)
  const [monitoring, setMonitoring] = useState(false)
  const [monitorStatus, setMonitorStatus] = useState<string>("")
  const [monitorDialogOpen, setMonitorDialogOpen] = useState(false)
  const [monitorSuggestion, setMonitorSuggestion] = useState<"none" | "chunk" | "tldr">("none")
  const [monitorVariability, setMonitorVariability] = useState<number | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number>(() => {
    const s = typeof window !== "undefined" ? localStorage.getItem("readapt:adhdMonitorCooldownUntil") : null
    return s ? Number(s) : 0
  })

  const windowTimerRef = useRef<number | null>(null)
  const scheduleTimerRef = useRef<number | null>(null)
  const captureStopTimerRef = useRef<number | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

  const [chunked, setChunked] = useState(false)
  const [notEnoughDialog, setNotEnoughDialog] = useState(false)
  const [useTldr, setUseTldr] = useState(false)
  const [tldrText, setTldrText] = useState<string | null>(null)
  const [chunkIndex, setChunkIndex] = useState(0)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [customSettings, setCustomSettings] = useState<ADHDCustomSettings | null>(null)
  const [justSynced, setJustSynced] = useState(false)

  // TTS toggle (strict UK female, no fallback)
  const [speaking, setSpeaking] = useState(false)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Initialize with clear precedence:
  // 1) URL ?preset= (apply + persist, ignore custom for this load)
  // 2) Custom settings (if present)
  // 3) LocalStorage (final/preset/quiz)
  // Then: Background GET /api/adhd/final to refresh unless URL preset or Custom is active.
  useEffect(() => {
    console.group("[ADHD Adapt] init")
    try {
      const text = localStorage.getItem("readapt:text") ?? "No text found. Go back and paste some text."
      setRawText(text)
      console.log("rawText length:", text?.length ?? 0)

      const urlPresetStr = searchParams.get("preset")
      const urlPreset = urlPresetStr ? Number(urlPresetStr) : NaN
      if (!Number.isNaN(urlPreset) && urlPreset >= 1 && urlPreset <= 4) {
        // URL wins and disables custom for this load
        urlPresetAppliedRef.current = true
        setCustomSettings(null)
        setPreset(urlPreset)
        setCls(Math.max(0, Math.min(3, urlPreset - 1)) as AdhdClass)
        localStorage.setItem("readapt:adhdPreset", String(urlPreset))
        localStorage.setItem("readapt:adhdFinalClass", String(Math.max(0, Math.min(3, urlPreset - 1))))
        console.log("Applied preset from URL:", urlPreset)
        console.groupEnd()
        return
      }

      // 1) Custom settings (if any)
      const cs = loadADHDCustomSettings()
      if (cs) {
        console.log("Custom settings found:", cs)
        setCustomSettings(cs)
        console.groupEnd()
        return
      }

      // 2) From localStorage (final/preset/quiz)
      const resultsPresetStr = localStorage.getItem("readapt:adhdPreset")
      const finalClassStr = localStorage.getItem("readapt:adhdFinalClass")
      const quizClassStr = localStorage.getItem("readapt:adhdQuizClass")
      const adhdResultStr = localStorage.getItem("readapt:adhdGazeResult")

      const resultsPreset = Number(resultsPresetStr ?? "0")
      const finalClass = Number(finalClassStr ?? "0") as AdhdClass
      const quizClass = Number(quizClassStr ?? "0") as AdhdClass

      console.log("localStorage read:", {
        resultsPresetStr,
        resultsPreset,
        finalClassStr,
        finalClass,
        quizClassStr,
        quizClass,
        adhdResultStr,
      })

      if (!Number.isNaN(finalClass)) setCls(finalClass as AdhdClass)

      let initialPreset = 1
      let source: "resultsPreset" | "finalClass" | "quizClass" | "fallback" = "fallback"

      if (resultsPreset >= 1 && resultsPreset <= 4) {
        initialPreset = resultsPreset
        source = "resultsPreset"
      } else if (finalClass >= 0 && finalClass <= 3) {
        initialPreset = finalClass + 1
        source = "finalClass"
      } else if (quizClass >= 0 && quizClass <= 3) {
        initialPreset = quizClass + 1
        source = "quizClass"
      }

      console.log("Computed initial preset from LS:", { initialPreset, source })
      setPreset(initialPreset)
      localStorage.setItem("readapt:adhdPreset", String(initialPreset))
      console.log("Applied preset from LS:", initialPreset, "source:", source)
    } catch (err) {
      console.error("[ADHD Adapt] init error:", err)
    } finally {
      console.groupEnd()
    }
  }, [searchParams])

  // Background refresh from server relay (unless URL preset was used or Custom is active)
  useEffect(() => {
    if (customSettings) return
    if (urlPresetAppliedRef.current) return

    let aborted = false
    ;(async () => {
      try {
        const r = await fetch("/api/adhd/final", { headers: { Accept: "application/json" } })
        const data = await r.json().catch(() => ({}))
        console.log("GET /api/adhd/final (background):", data)
        const serverPreset = Number(data?.mapped_preset ?? 0)
        const serverClass = Number(data?.final_class ?? 0) as AdhdClass
        if (!aborted && serverPreset >= 1 && serverPreset <= 4) {
          setPreset(prev => {
            if (prev !== serverPreset) {
              console.log("Applying preset from server relay:", serverPreset)
            }
            return serverPreset
          })
          setCls(serverClass as AdhdClass)
          localStorage.setItem("readapt:adhdPreset", String(serverPreset))
          localStorage.setItem("readapt:adhdFinalClass", String(serverClass))
        }
      } catch (e) {
        console.warn("Background GET /api/adhd/final failed:", e)
      }
    })()
    return () => {
      aborted = true
    }
  }, [customSettings])

  // Manual preset adjust
  const updatePreset = (val: number) => {
    const next = Math.min(4, Math.max(1, Number(val.toFixed(2))))
    console.log("[Preset] updatePreset →", next)
    setPreset(next)
    localStorage.setItem("readapt:adhdPreset", String(next))
  }

  const incPreset = (delta: number) => {
    const target = preset + delta
    console.log("[Preset] incPreset", { from: preset, delta, to: target })
    updatePreset(target)
  }

  // TL;DR generation
  const summarizeText = async () => {
    setSummaryLoading(true)
    console.log("[TL;DR] Requesting summary …")
    try {
      const res = await fetch("/api/adhd-summarizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      })
      const data = await res.json()
      setTldrText(data.summary || "")
      setUseTldr(true)
      setChunkIndex(0)
      console.log("[TL;DR] Summary received. length:", (data.summary || "").length)
    } catch (e) {
      console.error("[TL;DR] Summarization failed:", e)
      setTldrText("Sorry, summarization failed.")
      setUseTldr(true)
    } finally {
      setSummaryLoading(false)
    }
  }

  /* ---------- TTS Toggle (strict voice, no fallback) ---------- */
  const toggleTTS = useCallback(() => {
    if (speaking) {
      console.log("[TTS] Stop requested")
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    try {
      window.speechSynthesis.cancel()
      const voices = window.speechSynthesis.getVoices()
      const strict = voices.find(v =>
        /en-GB/i.test(v.lang) &&
        /female/i.test(`${v.name} ${v.voiceURI}`) &&
        /Google|UK|Female/i.test(`${v.name} ${v.voiceURI}`)
      )
      if (!strict) {
        console.warn("[TTS] Strict UK female voice not found (no fallback).")
        return
      }
      const baseText = useTldr && tldrText ? tldrText : rawText
      const utter = new SpeechSynthesisUtterance(baseText.slice(0, 6000))
      utter.voice = strict
      utter.rate = 0.9
      utter.onend = () => {
        setSpeaking(false)
        console.log("[TTS] Completed")
      }
      utter.onerror = (e) => {
        setSpeaking(false)
        console.warn("[TTS] Error:", e)
      }
      utterRef.current = utter
      setSpeaking(true)
      console.log("[TTS] Start speaking, chars:", baseText.slice(0, 6000).length)
      window.speechSynthesis.speak(utter)
    } catch (e) {
      console.warn("[TTS] unavailable:", e)
    }
  }, [rawText, tldrText, useTldr, speaking])

  useEffect(() => {
    const end = () => setSpeaking(false)
    window.speechSynthesis.addEventListener("end", end as any)
    window.speechSynthesis.addEventListener("error", end as any)
    return () => {
      window.speechSynthesis.removeEventListener("end", end as any)
      window.speechSynthesis.removeEventListener("error", end as any)
    }
  }, [])

  /* ---------- Derived values (Preset mode) ---------- */
  const step = useMemo(() => preset - 1, [preset])
  const baseFont = 20 // increased normal font size
  const lineHeight = useMemo(() => 1.7 + 0.18 * step, [step])
  const letterSpacing = useMemo(() => 0.018 * step, [step])
  const wordSpacing = useMemo(() => 0.09 * step, [step])
  const highlightOpacity = useMemo(() => 0.32 + 0.1 * (step / 3), [step])
  const headerPresetLabel = `Preset ${preset.toFixed(2)}`

  const legacyText = useTldr && tldrText ? tldrText : rawText
  const legacySentences = useMemo(() => splitIntoSentences(legacyText || ""), [legacyText])
  const legacyGroups = useMemo(() => chunkBy(legacySentences, 4), [legacySentences])
  const legacyLineCount = useMemo(
    () =>
      legacyText
        ? legacyText
            .split(/\n+/)
            .map(l => l.trim())
            .filter(Boolean).length
        : 0,
    [legacyText]
  )
  const canChunk = legacySentences.length >= 3 || legacyLineCount >= 3
  const showChunkControls = Math.floor(preset) >= 3

  /* ---------- Custom mode derived ---------- */
  const isCustom = !!customSettings
  const customEffectiveText = useTldr && tldrText ? tldrText : rawText
  const customSentences = useMemo(
    () => (isCustom ? splitIntoSentences(customEffectiveText || "") : []),
    [isCustom, customEffectiveText]
  )
  const highlightEvery =
    customSettings &&
    customSettings.highlightEnabled &&
    customSettings.highlightEvery <= 8
      ? customSettings.highlightEvery
      : 0

  /* ---------- Gather settings for extension sync ---------- */
  const gatherCurrentSettings = useCallback((): ReadaptSettingsADHD => {
    if (customSettings) {
      return {
        mode: "adhd",
        timestamp: Date.now(),
        source: "custom",
        fontSize: customSettings.fontSize ?? baseFont,
        fontFamily: (customSettings as any).fontFamily,
        fontFamilyIndex: customSettings.fontFamilyIndex,
        contrastIndex: customSettings.contrastIndex,
        fontColor: customSettings.fontColor,
        backgroundColor: customSettings.backgroundColor,
        letterSpacing: customSettings.letterSpacing ?? 0,
        wordSpacing: customSettings.wordSpacing ?? 0,
        lineSpacing: customSettings.lineSpacing ?? 1.6,
        adhdHighlightEvery: highlightEvery >= 2 ? highlightEvery : undefined,
        adhdHighlightOpacity: customSettings.highlightOpacity
      }
    }
    // Preset mapping: emulate extension behavior
    return {
      mode: "adhd",
      timestamp: Date.now(),
      source: "preset",
      fontSize: baseFont,
      fontFamily: "system-ui, sans-serif",
      fontFamilyIndex: 0,
      contrastIndex: 0,
      fontColor: "#111",
      backgroundColor: "#fff",
      letterSpacing,
      wordSpacing,
      lineSpacing: lineHeight,
      adhdHighlightEvery: Math.floor(preset) >= 2 ? 3 : undefined,
      adhdHighlightOpacity: highlightOpacity
    }
  }, [
    customSettings,
    highlightEvery,
    baseFont,
    letterSpacing,
    wordSpacing,
    lineHeight,
    preset,
    highlightOpacity
  ])

  const sendToExtension = useCallback(() => {
    const settings = gatherCurrentSettings()
    console.log("[Extension] postMessage READAPT_TRIGGER_EXTENSION", { mode: "adhd", preset, settings })
    window.postMessage(
      {
        type: "READAPT_TRIGGER_EXTENSION",
        mode: "adhd",
        preset,
        settings
      },
      "*"
    )
    setJustSynced(true)
    setTimeout(() => setJustSynced(false), 2500)
  }, [gatherCurrentSettings, preset])

  /* =========================================================
     Monitoring: orchestrate one random 20s capture in 60s
  ========================================================= */
  const cleanupMedia = () => {
    try {
      mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop()
    } catch {}
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
    recordedChunksRef.current = []
  }

  const clearTimers = () => {
    if (windowTimerRef.current) clearTimeout(windowTimerRef.current)
    if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current)
    if (captureStopTimerRef.current) clearTimeout(captureStopTimerRef.current)
    windowTimerRef.current = null
    scheduleTimerRef.current = null
    captureStopTimerRef.current = null
  }

  const analyzeGazeBlob = async (blob: Blob) => {
    const backend = pickBackendUrl()
    const form = new FormData()
    // We don't have quiz answers here; send zeros (backend requires 10 items).
    form.append("answers", JSON.stringify(new Array(10).fill(0)))
    form.append("video", new File([blob], "gaze.webm", { type: blob.type || "video/webm" }))

    try {
      const res = await fetch(`${backend}/api/adhd-diagnose`, {
        method: "POST",
        body: form
      })
      const data = await res.json()
      const variability: number = Number(data.adhd_gaze_variability ?? NaN)
      if (!Number.isFinite(variability)) throw new Error("Invalid variability")
      return variability
    } catch (e: any) {
      console.warn("[Monitor] analyze failed:", e?.message || e)
      return null
    }
  }

  const beginMonitoring = async () => {
    // UI lock for 60s window; label "Monitoring…"
    setMonitoring(true)
    setMonitorStatus("Monitoring…")

    // Schedule one capture randomly so that it finishes within the 60s window.
    // Start capture immediately to reduce end-to-end monitoring latency.
    const startDelay = 0
    scheduleTimerRef.current = window.setTimeout(async () => {
      setMonitorStatus("Capturing 20s…")
      recordedChunksRef.current = []

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 180 }, frameRate: { ideal: 15, max: 15 }, facingMode: "user" },
          audio: false
        })
        mediaStreamRef.current = stream
        const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" })
        mediaRecorderRef.current = rec
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data)
        }
        rec.onstop = async () => {
          setMonitorStatus("Analyzing…")
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" })
          recordedChunksRef.current = []
          const variability = await analyzeGazeBlob(blob)
          if (variability != null) {
            setMonitorVariability(Number(variability.toFixed(6)))
            let suggestion: "none" | "chunk" | "tldr" = "none"
            if (variability >= VAR_TLDR_MIN) suggestion = "tldr"
            else if (variability >= VAR_CHUNK_MIN && variability < VAR_TLDR_MIN) suggestion = "chunk"

            setMonitorSuggestion(suggestion)

            // Respect cooldown unless the user explicitly started monitoring (they did).
            // As per requirement: clicking "Monitor me" allows showing a popup even if cooldown not expired.
            if (suggestion !== "none") {
              setMonitorDialogOpen(true)
              const until = Date.now() + COOLDOWN_MS
              setCooldownUntil(until)
              try { localStorage.setItem("readapt:adhdMonitorCooldownUntil", String(until)) } catch {}
            } else {
              toast?.({
                title: "All set",
                description: "Your gaze looked stable during the check.",
              })
            }
          } else {
            toast?.({
              variant: "destructive",
              title: "Analysis failed",
              description: "We couldn't analyze the clip. Please try again.",
            })
          }
          setMonitorStatus("Monitoring…")
        }

        rec.start(1000) // gather in 1s chunks
        captureStopTimerRef.current = window.setTimeout(() => {
          try { rec.stop() } catch {}
          stream.getTracks().forEach((t) => t.stop())
        }, CAPTURE_MS) as unknown as number
      } catch (e) {
        console.warn("[Monitor] getUserMedia failed:", e)
        setMonitorStatus("Monitoring…")
      }
    }, startDelay) as unknown as number

    // End of 60s window
    windowTimerRef.current = window.setTimeout(() => {
      setMonitoring(false)
      setMonitorStatus("")
      clearTimers()
      cleanupMedia()
    }, MONITOR_WINDOW_MS) as unknown as number
  }

  useEffect(() => {
    return () => {
      clearTimers()
      cleanupMedia()
    }
  }, [])

  /* ---------- Render ---------- */
  const legacyCanChunkNow = showChunkControls && canChunk

  return (
    <main className="relative min-h-dvh">
      <Header variant="adhd-adapt" />
      <section className="mx-auto max-w-6xl px-4 md:px-6 pt-5 pb-24">
        <div className="glass rounded-2xl overflow-hidden">
          {/* Top Bar (Manual adjust moved here; show preset value) */}
          <div className="px-5 py-3 border-b border-border/60 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Left cluster */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
              {isCustom ? (
                <div className="text-sm flex items-center flex-wrap gap-2">
                  <span className="font-medium">Custom Mode</span>
                  <Button
                    className="ml-1"
                    variant="outline"
                    onClick={() => {
                      clearADHDCustomSettings()
                      window.location.reload()
                    }}
                  >
                    Reset Custom
                  </Button>
                  <Button
                    className="ml-1"
                    variant={justSynced ? "secondary" : "outline"}
                    onClick={sendToExtension}
                  >
                    {justSynced ? "Synced ✓" : "Re-sync Extension"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-5">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Manual Adjust
                    </span>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[preset]}
                        min={1}
                        max={4}
                        step={0.25}
                        onValueChange={(v) => updatePreset(v[0])}
                        className="w-56"
                      />
                      <span className="text-sm font-medium tabular-nums">
                        Preset {preset.toFixed(2)}
                      </span>
                      <span className="h-2 w-24 bg-muted rounded overflow-hidden" aria-hidden>
                        <span
                          className="block h-2 bg-primary"
                          style={{ width: `${((preset - 1) / 3) * 100}%` }}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right cluster */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/adhd/custom")}
              >
                Custom
              </Button>
              {!isCustom && (
                <Button
                  variant={justSynced ? "secondary" : "outline"}
                  onClick={sendToExtension}
                >
                  {justSynced ? "Synced ✓" : "Adapt in real time"}
                </Button>
              )}
              <Button
                variant={speaking ? "secondary" : (isCustom ? "secondary" : "outline")}
                onClick={toggleTTS}
                aria-pressed={speaking}
                className={speaking ? "ring-2 ring-primary/60" : ""}
                disabled={isCustom ? false : Math.floor(preset) < 4}
              >
                {speaking ? "Stop TTS" : "Listen (TTS)"}
              </Button>
              <Button
                variant={useTldr ? "default" : "outline"}
                onClick={() => {
                  if (!useTldr && !tldrText) {
                    summarizeText()
                  } else {
                    setUseTldr(v => !v)
                    setChunkIndex(0)
                  }
                }}
                disabled={summaryLoading || (!isCustom && Math.floor(preset) < 4)}
              >
                {useTldr ? "Disable TL;DR" : summaryLoading ? "Summarizing..." : "TL;DR"}
              </Button>

              {/* NEW: Monitor me */}
              <Button
                variant={monitoring ? "secondary" : "outline"}
                disabled={monitoring}
                onClick={() => {
                  // Allow starting even if cooldown hasn't elapsed (explicit user action).
                  beginMonitoring()
                }}
              >
                {monitoring ? (monitorStatus || "Monitoring…") : "Monitor me"}
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="relative">
            {summaryLoading && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm grid place-items-center z-10">
                <div className="text-center">
                  <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Summarizing text with AI...
                  </p>
                </div>
              </div>
            )}

            <div className="relative z-0 p-6 md:p-10">
              {isCustom ? (
                <article
                  className="prose prose-neutral max-w-none text-pretty transition-all"
                  style={{
                    fontSize: `${customSettings!.fontSize ?? baseFont}px`,
                    lineHeight: customSettings!.lineSpacing ?? 1.6,
                    letterSpacing: customSettings!.letterSpacing
                      ? `${customSettings!.letterSpacing}em`
                      : undefined,
                    wordSpacing: customSettings!.wordSpacing
                      ? `${customSettings!.wordSpacing}em`
                      : undefined,
                    fontFamily: (customSettings as any).fontFamily,
                    color: customSettings!.fontColor,
                    backgroundColor: customSettings!.backgroundColor,
                  }}
                >
                  <div className="space-y-4">
                    {customSentences.map((s, i) => (
                      <p key={i}>
                        {highlightEvery >= 2 ? (
                          <HighlightCustom
                            text={s}
                            every={highlightEvery}
                            opacity={customSettings!.highlightOpacity || 0.35}
                          />
                        ) : (
                          s
                        )}
                      </p>
                    ))}
                  </div>
                </article>
              ) : (
                <article
                  className="prose prose-neutral max-w-none text-pretty"
                  style={{
                    fontSize: `${baseFont}px`,
                    lineHeight,
                    letterSpacing: `${letterSpacing}em`,
                    wordSpacing: `${wordSpacing}em`,
                  }}
                >
                  {showChunkControls && chunked ? (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-muted-foreground">
                          Chunk {chunkIndex + 1} / {legacyGroups.length}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          Chunking active (4 lines per view)
                        </div>
                      </div>
                      <div className="space-y-4">
                        {(legacyGroups[chunkIndex] || []).map((s, i) => (
                          <p key={i}>
                            {Math.floor(preset) >= 2 ? (
                              <HighlightEveryThird
                                text={s}
                                opacity={highlightOpacity}
                              />
                            ) : (
                              s
                            )}
                          </p>
                        ))}
                      </div>
                      <div className="mt-6 flex items-center justify-between">
                        <Button
                          variant="outline"
                          onClick={() =>
                            setChunkIndex(i => Math.max(0, i - 1))
                          }
                          disabled={chunkIndex === 0}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setChunkIndex(i =>
                              Math.min(legacyGroups.length - 1, i + 1)
                            )
                          }
                          disabled={chunkIndex >= legacyGroups.length - 1}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {legacySentences.map((s, i) => (
                        <p key={i}>
                          {Math.floor(preset) >= 2 ? (
                            <HighlightEveryThird
                              text={s}
                              opacity={highlightOpacity}
                            />
                          ) : (
                            s
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              )}
            </div>
          </div>

          {/* Footer Controls */}
          {!isCustom && (
            <div className="sticky bottom-0 glass px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {Math.floor(preset) >= 3 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const canChunkLocal = canChunk
                      if (!canChunkLocal) {
                        setNotEnoughDialog(true)
                        return
                      }
                      setChunkIndex(0)
                      setChunked(c => !c)
                      console.log("[Chunk] toggled", { now: !chunked })
                    }}
                  >
                    {chunked ? "Disable chunking" : "Chunk text"}
                  </Button>
                )}

                {/* NEW: Monitoring-driven suggestion dialog */}
                <Dialog
                  open={monitorDialogOpen}
                  onOpenChange={setMonitorDialogOpen}
                >
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>We can help now</DialogTitle>
                      <DialogDescription>
                        {monitorVariability != null
                          ? `Gaze variability ≈ ${monitorVariability.toFixed(3)} rad`
                          : "We analyzed a short clip to estimate your reading stability."}
                      </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2">
                      {monitorSuggestion === "chunk" && (
                        <Button
                          onClick={() => {
                            if (Math.floor(preset) < 3) {
                              updatePreset(3)
                            }
                            if (!canChunk) {
                              setMonitorDialogOpen(false)
                              setNotEnoughDialog(true)
                              return
                            }
                            setChunkIndex(0)
                            setChunked(true)
                            setMonitorDialogOpen(false)
                          }}
                        >
                          Chunk text
                        </Button>
                      )}
                      {monitorSuggestion === "tldr" && (
                        <Button
                          onClick={async () => {
                            if (Math.floor(preset) < 4) {
                              updatePreset(4)
                            }
                            if (!tldrText) {
                              await summarizeText()
                            } else {
                              setUseTldr(true)
                            }
                            setMonitorDialogOpen(false)
                          }}
                        >
                          TL;DR
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => setMonitorDialogOpen(false)}
                      >
                        Not now
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Not enough text dialog */}
                <Dialog
                  open={notEnoughDialog}
                  onOpenChange={setNotEnoughDialog}
                >
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Not enough text</DialogTitle>
                      <DialogDescription>
                        Chunking requires at least 3 lines of text.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button onClick={() => setNotEnoughDialog(false)}>
                        OK
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
