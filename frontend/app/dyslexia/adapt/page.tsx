"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

/* =========================================================
   Types
========================================================= */
type DyslexiaLabel = 0 | 1 | 2

interface CustomSettings {
  fontSize?: number
  fontColor?: string
  backgroundColor?: string
  letterSpacing?: number
  wordSpacing?: number
  lineSpacing?: number
  lineHeight?: number
  fontFamilyIndex?: number
  fontFamily?: string
  contrastIndex?: number
  dyslexiaHighlights?: boolean
  [k: string]: any
}

interface ReadaptSettings {
  mode: "dyslexia"
  timestamp: number
  fontSize: number
  fontFamily?: string
  fontFamilyIndex?: number
  contrastIndex?: number
  fontColor: string
  backgroundColor: string
  letterSpacing: number
  wordSpacing: number
  lineSpacing: number
  dyslexiaHighlights?: boolean
  source: "custom" | "preset"
}

/* =========================================================
   Persistence Helpers
========================================================= */
function loadCustomSettings(): CustomSettings | null {
  try {
    const raw = localStorage.getItem("readapt:customSettings")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return sanitizeCustomSettings(parsed)
  } catch {
    return null
  }
}

function sanitizeCustomSettings(s: any): CustomSettings | null {
  if (!s || typeof s !== "object") return null
  const num = (v: any, fb: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fb
  }
  return {
    fontSize: num(s.fontSize, 18),
    fontColor: typeof s.fontColor === "string" ? s.fontColor : "#111",
    backgroundColor: typeof s.backgroundColor === "string" ? s.backgroundColor : "#fff",
    letterSpacing: num(s.letterSpacing, 0),
    wordSpacing: num(s.wordSpacing, 0),
    lineSpacing: Number.isFinite(Number(s.lineSpacing))
      ? Number(s.lineSpacing)
      : (Number.isFinite(Number(s.lineHeight)) ? Number(s.lineHeight) : 1.6),
    fontFamilyIndex: Number.isInteger(s.fontFamilyIndex) ? s.fontFamilyIndex : 0,
    fontFamily: typeof s.fontFamily === "string" ? s.fontFamily : "system-ui, sans-serif",
    contrastIndex: Number.isInteger(s.contrastIndex) ? s.contrastIndex : 0,
    dyslexiaHighlights: Boolean(s.dyslexiaHighlights),
  }
}

function clearCustomSettings() {
  localStorage.removeItem("readapt:customSettings")
}

/* =========================================================
   Inactivity Agent (15s)
========================================================= */
function useInactivityAgent(onSuggest: () => void) {
  const [snoozedUntil, setSnoozedUntil] = useState<number>(0)
  const lastActivity = useRef<number>(performance.now())
  const timerRef = useRef<number | null>(null)

  const markActivity = useCallback(() => {
    lastActivity.current = performance.now()
  }, [])

  useEffect(() => {
    const onAny = () => markActivity()
    window.addEventListener("mousemove", onAny)
    window.addEventListener("keydown", onAny)
    window.addEventListener("pointerdown", onAny)
    window.addEventListener("scroll", onAny, { passive: true })

    timerRef.current = window.setInterval(() => {
      if (
        performance.now() > snoozedUntil &&
        performance.now() - lastActivity.current > 15000
      ) {
        onSuggest()
        lastActivity.current = performance.now()
      }
    }, 1000)

    return () => {
      window.removeEventListener("mousemove", onAny)
      window.removeEventListener("keydown", onAny)
      window.removeEventListener("pointerdown", onAny)
      window.removeEventListener("scroll", onAny)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [onSuggest, markActivity, snoozedUntil])

  const snooze = (ms: number) => setSnoozedUntil(performance.now() + ms)
  return { snooze, markActivity, lastActivity }
}

/* =========================================================
   Highlights
========================================================= */
function DyslexicHighlights({ text }: { text: string }) {
  const confuser = /[bdpqmnun]/i
  return (
    <span>
      {text.split("").map((ch, i) =>
        confuser.test(ch) ? (
          <span
            key={i}
            className="inline-block rounded-[2px] bg-primary/18 dark:bg-primary/20 text-foreground/90 px-[1px] py-[1px] leading-none"
          >
            {ch}
          </span>
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </span>
  )
}

/* =========================================================
   Contrast Presets
========================================================= */
const CONTRAST_PRESETS: { bg: string; fg: string }[] = [
  { bg: "#ffffff", fg: "#111111" },
  { bg: "#0d1117", fg: "#f1f5f9" },
  { bg: "#fffce8", fg: "#1f2937" },
  { bg: "#1a2030", fg: "#e2e8f0" },
]

/* =========================================================
   Main
========================================================= */
export default function DyslexiaAdaptPage() {
  const [rawText, setRawText] = useState("Loading...")
  const [customSettings, setCustomSettings] = useState<CustomSettings | null>(null)
  const [label, setLabel] = useState<DyslexiaLabel>(1)
  const [preset, setPreset] = useState<number>(2)
  const [showPrompt, setShowPrompt] = useState(false)
  const [justSynced, setJustSynced] = useState(false)
  const [agentDisabled, setAgentDisabled] = useState(false)

  // TTS
  const [speaking, setSpeaking] = useState(false)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Init
  useEffect(() => {
    const text = localStorage.getItem("readapt:text") ?? "No text found. Go back and paste some text."
    setRawText(text)
    const storedLabel = Number(localStorage.getItem("readapt:label") ?? "1") as DyslexiaLabel
    setLabel(storedLabel)
    const storedPreset = Number(localStorage.getItem("readapt:dyslexiaPreset") || "0")
    const mappedDefault = storedLabel === 2 ? 1 : storedLabel === 1 ? 2 : 3
    setPreset(Math.max(1, Math.min(3, storedPreset >= 1 ? storedPreset : mappedDefault)))

    const cs = loadCustomSettings()
    if (cs) setCustomSettings(cs)

    setAgentDisabled(localStorage.getItem("readapt:agentDisabled") === "true")
  }, [])

  const { snooze, markActivity, lastActivity } = useInactivityAgent(() => {
    if (!agentDisabled && !customSettings && Math.floor(preset) < 3) {
      setShowPrompt(true)
    }
  })

  useEffect(() => {
    if (!customSettings && Math.floor(preset) >= 3) setShowPrompt(false)
  }, [preset, customSettings])

  const incPreset = (delta: number) => {
    setPreset(prev => {
      const next = Math.max(1, Math.min(3, Number((prev + delta).toFixed(2))))
      localStorage.setItem("readapt:dyslexiaPreset", String(next))
      return next
    })
    markActivity()
  }

  /* Strict TTS (no fallback) */
  const toggleTTS = () => {
    if (speaking) {
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
        console.warn("Strict UK female voice not found (no fallback).")
        return
      }
      const utter = new SpeechSynthesisUtterance(rawText.slice(0, 6000))
      utter.voice = strict
      utter.rate = 0.9
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      utterRef.current = utter
      setSpeaking(true)
      window.speechSynthesis.speak(utter)
    } catch (e) {
      console.warn("TTS error:", e)
    }
  }

  useEffect(() => {
    const end = () => setSpeaking(false)
    window.speechSynthesis.addEventListener("end", end as any)
    window.speechSynthesis.addEventListener("error", end as any)
    return () => {
      window.speechSynthesis.removeEventListener("end", end as any)
      window.speechSynthesis.removeEventListener("error", end as any)
    }
  }, [])

  /* Spacing & scaling */
  const points = useMemo(() => ({
    fontSize: [24, 27, 31],
    letter:   [0.16, 0.32, 0.55],
    word:     [0.22, 0.45, 0.85],
    line:     [1.95, 2.25, 2.6]
  }), [])

  function interp(v: number, arr: number[]) {
    const i = Math.floor(v) - 1
    const frac = v - Math.floor(v)
    if (i >= arr.length - 1) return arr[arr.length - 1]
    return arr[i] + (arr[i + 1] - arr[i]) * frac
  }

  const fontSize = interp(preset, points.fontSize)
  const letterSpacing = interp(preset, points.letter)
  const wordSpacing = interp(preset, points.word)
  const lineHeight = interp(preset, points.line)
  const showTTS = Math.floor(preset) >= 3

  /* Extension Sync (manual) */
  const gatherCurrentSettings = useCallback((): ReadaptSettings => {
    if (customSettings) {
      const cIdx = customSettings.contrastIndex ?? 0
      const cp = CONTRAST_PRESETS[cIdx % CONTRAST_PRESETS.length]
      return {
        mode: "dyslexia",
        timestamp: Date.now(),
        fontSize: customSettings.fontSize ?? 18,
        fontFamily: customSettings.fontFamily || "system-ui, sans-serif",
        fontFamilyIndex: customSettings.fontFamilyIndex ?? 0,
        contrastIndex: customSettings.contrastIndex ?? 0,
        fontColor: customSettings.fontColor || cp.fg,
        backgroundColor: customSettings.backgroundColor || cp.bg,
        letterSpacing: customSettings.letterSpacing ?? 0,
        wordSpacing: customSettings.wordSpacing ?? 0,
        lineSpacing: customSettings.lineSpacing ?? 1.6,
        dyslexiaHighlights: !!customSettings.dyslexiaHighlights,
        source: "custom"
      }
    }
    return {
      mode: "dyslexia",
      timestamp: Date.now(),
      fontSize,
      fontFamily: "system-ui, sans-serif",
      fontFamilyIndex: 0,
      contrastIndex: 0,
      fontColor: "#111",
      backgroundColor: "#fff",
      letterSpacing,
      wordSpacing,
      lineSpacing: lineHeight,
      dyslexiaHighlights: Math.floor(preset) >= 3,
      source: "preset"
    }
  }, [customSettings, fontSize, letterSpacing, wordSpacing, lineHeight, preset])

  const sendToExtension = useCallback(() => {
    const settings = gatherCurrentSettings()
    window.postMessage(
      {
        type: "READAPT_TRIGGER_EXTENSION",
        mode: "dyslexia",
        preset,
        settings
      },
      "*"
    )
    setJustSynced(true)
    setTimeout(() => setJustSynced(false), 2500)
  }, [gatherCurrentSettings, preset])

  /* Agent actions */
  const acceptAgent = () => {
    if (preset < 3) incPreset(0.25)
    lastActivity.current = performance.now()
    setShowPrompt(false)
  }
  const rejectAgent = () => {
    snooze(5 * 60 * 1000)
    setShowPrompt(false)
  }
  const enableAgent = () => {
    setAgentDisabled(false)
    localStorage.setItem("readapt:agentDisabled", "false")
    lastActivity.current = performance.now()
  }

  /* Word non-chipping for preset === 3
     We render each word as a nowrap span when preset >=3 (not splitting in middle) */
  function renderParagraph(p: string, withHighlights: boolean, key: number) {
    if (Math.floor(preset) < 3) {
      return (
        <p key={key}>
          {withHighlights ? <DyslexicHighlights text={p} /> : p}
        </p>
      )
    }
    // Split words; each word inside nowrap span
    const words = p.split(/\s+/)
    return (
      <p key={key} className="flex flex-wrap gap-x-3 gap-y-2">
        {words.map((w, i) => {
          const inner = withHighlights ? <DyslexicHighlights text={w} /> : w
            // tight container so long words may scroll if too long
          return (
            <span
              key={i}
              className="whitespace-nowrap inline-block"
              style={{ lineHeight: "inherit" }}
            >
              {inner}
            </span>
          )
        })}
      </p>
    )
  }

  const contrastForCustom = customSettings
    ? CONTRAST_PRESETS[(customSettings.contrastIndex ?? 0) % CONTRAST_PRESETS.length]
    : null

  const articleStyle: React.CSSProperties = customSettings
    ? {
        fontSize: customSettings.fontSize ? `${customSettings.fontSize}px` : "18px",
        color: customSettings.fontColor || contrastForCustom?.fg || "#111",
        backgroundColor: customSettings.backgroundColor || contrastForCustom?.bg || "#fff",
        letterSpacing: customSettings.letterSpacing ? `${customSettings.letterSpacing}em` : undefined,
        wordSpacing: customSettings.wordSpacing ? `${customSettings.wordSpacing}em` : undefined,
        lineHeight: customSettings.lineSpacing || 1.6,
        fontFamily: customSettings.fontFamily || "system-ui, sans-serif",
        transition: "all .2s ease",
      }
    : {
        fontSize: `${fontSize}px`,
        lineHeight,
        letterSpacing: `${letterSpacing}em`,
        wordSpacing: `${wordSpacing}em`,
        fontFamily: "system-ui, sans-serif",
        transition: "all .25s cubic-bezier(.22,1,.24,1)",
      }

  return (
    <main className="relative min-h-dvh">
      <Header variant="dyslexia-adapt" />
      <section className="mx-auto max-w-6xl px-4 md:px-6 pt-5 pb-24">
        <div className="glass rounded-2xl overflow-hidden">
          {/* Top Bar (Manual adjust integrated, current preset number shown only here) */}
          <div className="px-5 py-3 border-b border-border/60 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Left cluster */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
              {customSettings ? (
                <div className="text-sm flex items-center flex-wrap gap-2">
                  <span className="font-medium">Custom Mode</span>
                  <Button
                    className="ml-1"
                    variant="outline"
                    onClick={() => {
                      clearCustomSettings()
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
                        max={3}
                        step={0.25}
                        onValueChange={(v) => {
                          const next = Math.max(1, Math.min(3, Number(v[0].toFixed(2))))
                          setPreset(next)
                          localStorage.setItem("readapt:dyslexiaPreset", String(next))
                          markActivity()
                        }}
                        className="w-56"
                      />
                      <span className="text-sm font-medium tabular-nums">
                        Preset {preset.toFixed(2)}
                      </span>
                      <span className="h-2 w-24 bg-muted rounded overflow-hidden" aria-hidden>
                        <span
                          className="block h-2 bg-primary"
                          style={{ width: `${((preset - 1) / 2) * 100}%` }}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right cluster */}
            <div className="flex items-center gap-2 flex-wrap">
              {!customSettings && (
                <Button
                  variant={justSynced ? "secondary" : "outline"}
                  onClick={sendToExtension}
                >
                  {justSynced ? "Synced ✓" : "Adapt in real time"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/dyslexia/custom")}
              >
                Custom
              </Button>
              {(customSettings || showTTS) && (
                <Button
                  variant={speaking ? "secondary" : "outline"}
                  onClick={toggleTTS}
                  aria-pressed={speaking}
                  className={speaking ? "ring-2 ring-primary/60" : ""}
                >
                  {speaking ? "Stop TTS" : "Listen (TTS)"}
                </Button>
              )}
              {agentDisabled && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setAgentDisabled(false)
                    localStorage.setItem("readapt:agentDisabled", "false")
                    lastActivity.current = performance.now()
                  }}
                >
                  Enable Agent
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-10">
            <article
              className="prose prose-neutral max-w-none text-pretty space-y-6"
              style={articleStyle}
            >
              {rawText.split(/\n+/).map((para, i) =>
                renderParagraph(
                  para,
                  (customSettings?.dyslexiaHighlights || (!customSettings && Math.floor(preset) >= 3)),
                  i
                )
              )}
            </article>
          </div>

          {/* Agent Dialog */}
          <Dialog open={showPrompt && !agentDisabled && Math.floor(preset) < 3} onOpenChange={setShowPrompt}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Struggling to read?</DialogTitle>
                <DialogDescription>
                  We detected inactivity. Increase preset by +0.25?
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 py-2">
                <Checkbox
                  id="disable-agent"
                  checked={agentDisabled}
                  onCheckedChange={(v) => {
                    const val = Boolean(v)
                    setAgentDisabled(val)
                    localStorage.setItem("readapt:agentDisabled", String(val))
                    if (val) setShowPrompt(false)
                  }}
                />
                <label htmlFor="disable-agent" className="text-xs text-muted-foreground cursor-pointer">
                  Disable agent permanently
                </label>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  onClick={() => {
                    acceptAgent()
                  }}
                  disabled={preset >= 3}
                >
                  Yes, enhance
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    rejectAgent()
                  }}
                >
                  No, thanks
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </main>
  )

  /* Helper: render paragraph with optional no-chipping logic */
  function renderParagraph(
    p: string,
    withHighlights: boolean,
    key: number
  ) {
    if (Math.floor(preset) < 3) {
      return (
        <p key={key}>
          {withHighlights ? <DyslexicHighlights text={p} /> : p}
        </p>
      )
    }
    // preset >=3: prevent any intra-word wrap, keep each word intact
    const words = p.split(/\s+/)
    return (
      <p key={key} className="flex flex-wrap gap-x-3 gap-y-2">
        {words.map((w, i) => {
          const inner = withHighlights ? <DyslexicHighlights text={w} /> : w
          return (
            <span
              key={i}
              className="whitespace-nowrap inline-block"
              style={{ lineHeight: "inherit" }}
            >
              {inner}
            </span>
          )
        })}
      </p>
    )
  }
}