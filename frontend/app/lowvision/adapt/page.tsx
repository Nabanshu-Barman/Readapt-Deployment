"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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
import Link from "next/link"

import {
  loadLowVisionCustomSettings,
  clearLowVisionCustomSettings,
} from "@/lib/lowVisionCustomSettings"

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

interface ReadaptSettingsLowVision {
  mode: "lowvision"
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
}

function sanitizeCustomSettings(s: any): CustomSettings | null {
  if (!s || typeof s !== "object") return null
  const num = (v: any, fb: number): number => {
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
    fontFamily: typeof s.fontFamily === "string" ? s.fontFamily : s.fontFamily,
    contrastIndex: Number.isInteger(s.contrastIndex) ? s.contrastIndex : 0,
    dyslexiaHighlights: Boolean(s.dyslexiaHighlights),
  }
}

/* Inactivity-only agent (parity with ADHD) */
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

export default function LowVisionAdaptPage() {
  const [rawText, setRawText] = useState("Loading...")
  const [preset, setPreset] = useState<number>(1) // 1..3 step 0.25
  const [showPrompt, setShowPrompt] = useState(false)
  const [customSettings, setCustomSettings] = useState<CustomSettings | null>(null)
  const [justSynced, setJustSynced] = useState(false)

  // ADHD-style agent state
  const [agentDisabled, setAgentDisabled] = useState(false)

  // TTS
  const [speaking, setSpeaking] = useState(false)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Initialize (check for custom first)
  useEffect(() => {
    const text = localStorage.getItem("readapt:text") ?? "No text found. Go back and paste some text."
    setRawText(text)

    const cs = loadLowVisionCustomSettings()
    if (cs) {
      const sanitized = sanitizeCustomSettings(cs)
      if (sanitized) {
        setCustomSettings(sanitized)
      }
    } else {
      const stored = Number(localStorage.getItem("readapt:lowvisionPreset") || "1")
      const init = Math.max(1, Math.min(3, stored || 1))
      setPreset(init)
    }

    // Persist last mode
    localStorage.setItem("readapt:lastMode", "lowvision")

    // Load agent disabled flag (reusing the same key for parity)
    const disabled = localStorage.getItem("readapt:agentDisabled") === "true"
    setAgentDisabled(disabled)
  }, [])

  // Inactivity-only agent hook (parity with ADHD)
  const { snooze, markActivity, lastActivity } = useInactivityAgent(() => {
    if (!customSettings && Math.floor(preset) < 3 && !agentDisabled) {
      setShowPrompt(true)
    }
  })

  // Close prompt once we hit max preset
  useEffect(() => {
    if (!customSettings && Math.floor(preset) >= 3) setShowPrompt(false)
  }, [preset, customSettings])

  const updatePreset = (val: number) => {
    const next = Math.max(1, Math.min(3, Number(val.toFixed(2))))
    setPreset(next)
    localStorage.setItem("readapt:lowvisionPreset", String(next))
    if (Math.floor(next) >= 3) setShowPrompt(false)
    markActivity()
  }

  const incPreset = (delta: number) => {
    const target = preset + delta
    updatePreset(target)
  }

  // Larger font for all presets (only this line changed: baseFont 16 -> 20)
  const baseFont = 20
  const floorPreset = Math.floor(preset)
  const mag =
    preset <= 2
      ? 1.25 + (preset - 1) * (1.5 - 1.25) // 1 => 1.25x, 2 => 1.5x
      : 1.5 + (preset - 2) * (2.0 - 1.5)    // 3 => 2.0x
  const fontSize = baseFont * mag
  const letterSpacing =
    preset <= 2
      ? (preset - 1) * (0.02 - 0.0)
      : 0.02 + (preset - 2) * (0.04 - 0.02) // em: 1=>0, 2=>0.02, 3=>0.04
  const lineHeight =
    preset <= 2
      ? 1.6 + (preset - 1) * (1.8 - 1.6) // 1=>1.6, 2=>1.8
      : 1.8 + (preset - 2) * (2.0 - 1.8) // 3=>2.0

  // Word spacing is not part of original LV preset mapping (keep at 0)
  const wordSpacing = 0

  // TTS visibility: top preset OR any custom mode
  const showTTS = !!customSettings || floorPreset >= 3

  // Dyslexia-style strict TTS (identical logic)
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

  const headerPresetLabel = `Preset ${preset.toFixed(2)}`

  // Color treatment ONLY for preset mode (keep original except preset 2 change)
  const articleColors = customSettings
    ? {}
    : floorPreset === 3
      ? { backgroundColor: "#000000", color: "#ffffff" }
      : floorPreset === 2
        ? { backgroundColor: "#142850", color: "#ffffff" } // changed to dark blue/white contrast
        : {}

  const resetCustom = () => {
    clearLowVisionCustomSettings()
    setCustomSettings(null)
    window.location.reload()
  }

  /* -------- Extension Sync (parity) -------- */

  const gatherCurrentSettings = useCallback((): ReadaptSettingsLowVision => {
    if (customSettings) {
      return {
        mode: "lowvision",
        timestamp: Date.now(),
        source: "custom",
        fontSize: customSettings.fontSize ?? 18,
        fontFamily: customSettings.fontFamily,
        fontFamilyIndex: customSettings.fontFamilyIndex,
        contrastIndex: customSettings.contrastIndex,
        fontColor: customSettings.fontColor || "#111",
        backgroundColor: customSettings.backgroundColor || "#fff",
        letterSpacing: customSettings.letterSpacing ?? 0,
        wordSpacing: customSettings.wordSpacing ?? 0,
        lineSpacing: customSettings.lineSpacing ?? 1.6
      }
    }

    // Preset mapping to a unified structure
    const { color: presetFontColor = "#111", backgroundColor: presetBg = "#fff" } = (articleColors as any) || {}
    const fontColor = customSettings ? (customSettings.fontColor || "#111") : (presetFontColor || "#111")
    const backgroundColor = customSettings ? (customSettings.backgroundColor || "#fff") : (presetBg || "#fff")

    return {
      mode: "lowvision",
      timestamp: Date.now(),
      source: "preset",
      fontSize,
      fontFamily: "system-ui, sans-serif",
      fontFamilyIndex: 0,
      contrastIndex: 0,
      fontColor,
      backgroundColor,
      letterSpacing,
      wordSpacing,
      lineSpacing: lineHeight
    }
  }, [customSettings, fontSize, letterSpacing, wordSpacing, lineHeight, articleColors])

  const sendToExtension = useCallback(() => {
    const settings = gatherCurrentSettings()
    window.postMessage(
      {
        type: "READAPT_TRIGGER_EXTENSION",
        mode: "lowvision",
        preset,
        settings
      },
      "*"
    )
    setJustSynced(true)
    setTimeout(() => setJustSynced(false), 2500)
  }, [gatherCurrentSettings, preset])

  // ADHD-style agent actions
  const acceptAgent = () => {
    if (preset < 3) {
      incPreset(0.25)
    }
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

  return (
    <main className="relative min-h-dvh">
      <Header variant="results" />
      <section className="mx-auto max-w-6xl px-4 md:px-6 pt-5 pb-24">
        <div className="glass rounded-2xl overflow-hidden">
          {/* Top Bar: Manual Toggle identical to Dyslexia Adapt Page */}
          <div className="px-5 py-3 border-b border-border/60 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Left cluster: manual toggle and preset info */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
              {customSettings ? (
                <div className="text-sm flex items-center flex-wrap gap-2">
                  <span className="font-medium">Custom Mode</span>
                  <Button
                    className="ml-1"
                    variant="outline"
                    onClick={resetCustom}
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
                          localStorage.setItem("readapt:lowvisionPreset", String(next))
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

            {/* Right cluster: identical to Dyslexia Adapt */}
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
                onClick={() => (window.location.href = "/lowvision/custom")}
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
                  onClick={enableAgent}
                >
                  Enable Agent
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-10">
            {customSettings ? (
              <article
                className="prose prose-neutral max-w-none text-pretty"
                style={{
                  fontSize: customSettings.fontSize ? `${customSettings.fontSize}px` : undefined,
                  color: customSettings.fontColor,
                  backgroundColor: customSettings.backgroundColor,
                  letterSpacing: customSettings.letterSpacing
                    ? `${customSettings.letterSpacing}em`
                    : undefined,
                  wordSpacing: customSettings.wordSpacing
                    ? `${customSettings.wordSpacing}em`
                    : undefined,
                  lineHeight: customSettings.lineSpacing || 1.6,
                  fontFamily: customSettings.fontFamily,
                  transition: "all .18s ease"
                }}
              >
                <div className="space-y-4">
                  {rawText.split(/\n+/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </article>
            ) : (
              <article
                className="prose prose-neutral max-w-none text-pretty"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight,
                  letterSpacing: `${letterSpacing}em`,
                  ...articleColors,
                  transition: "all .18s ease"
                }}
              >
                <div className="space-y-4">
                  {rawText.split(/\n+/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </article>
            )}
          </div>

          {/* Footer Controls (only legacy preset mode) */}
          {!customSettings && (
            <div className="sticky bottom-0 glass px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button asChild variant="outline">
                  <Link href="/lowvision/paste">Back to Paste</Link>
                </Button>
              </div>

              {/* ADHD-style Agent Dialog */}
              <Dialog open={showPrompt && !agentDisabled && Math.floor(preset) < 3} onOpenChange={setShowPrompt}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Need a boost?</DialogTitle>
                    <DialogDescription>
                      We noticed 15s of inactivity. Increase preset by +0.25?
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
                    <Button onClick={acceptAgent} disabled={preset >= 3}>
                      Yes, enhance
                    </Button>
                    <Button variant="secondary" onClick={rejectAgent}>
                      No, thanks
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}