"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import clsx from "clsx";

import {
  defaultADHDCustomSettings,
  loadADHDCustomSettings,
  saveADHDCustomSettings,
  clearADHDCustomSettings,
  FONT_FAMILIES,
  CONTRAST_PRESETS,
  ADHDCustomSettings
} from "@/lib/adhdCustomSettings";

import {
  classifyIntentLocal,
  loadLocalIntentModel
} from "@/lib/intentClassifierLocal";

/* Sample text (constant for SSR parity) */
const PREVIEW =
  "Attention-friendly text improves focus. Regular spacing and measured highlighting guide the eyes naturally.";

interface ChatMsg {
  from: "user" | "agent";
  text: string;
}

type Mode = "dark" | "light";

/* ---------- Intent Heuristic (adds highlight logic) ---------- */
function normalize(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const INC_RE = /\b(increase|bigger|larger|more|double|boost|raise|higher|stronger)\b/;
const DEC_RE = /\b(decrease|reduce|smaller|less|lower|weaker|fewer|remove|drop|diminish)\b/;

function deriveIntentOverride(input: string): string | null {
  const text = normalize(input);

  if (/\b(reset|default|normal|start over|undo all|restore|revert|back to default)\b/.test(text))
    return "undo_changes";
  if (/\b(change|next|shift|cycle|rotate|switch)\b.*\bcontrast\b|\bcontrast\b.*\b(change|next|shift|cycle|rotate|switch)\b/.test(text))
    return "increase_contrast";

  const inc = INC_RE.test(text);
  const dec = DEC_RE.test(text);
  if (inc && dec) return null;

  const has = (r: RegExp) => r.test(text);
  const letter = has(/\bletter(s)?|kerning|character(s)?\b/);
  const word = has(/\bword(s)?|sentence(s)?\b/);
  const line = has(/\bline(s)?|paragraph(s)?\b/);
  const font = has(/\bfont(s)?|typeface\b/);
  const contrast = has(/\bcontrast|background\b/);
  const sizeOnly = has(/\bsize\b/);

  // Highlight commands (no explicit enable/disable; automatic logic)
  if (/\bhighlight(ing)?\b/.test(text)) {
    if (inc || /\b(highlight more|more highlight|more words)\b/.test(text)) return "increase_highlight";
    if (dec || /\b(highlight less|less highlight|fewer words|reduce highlight)\b/.test(text)) return "decrease_highlight";
  }

  if (!inc && !dec) {
    if (/\bsmol|smaller|too big|go smaller|make it small\b/.test(text)) return "decrease_font";
    if (/\bbig|bigger|larger|too small|make it big|make it bigger|increase size\b/.test(text)) return "increase_font";
  }
  if (font) {
    if (/\b(previous|back|prior|revert)\b/.test(text)) return "cycle_font_prev";
    if (inc || /\b(next|another|different|change|swap|switch|rotate|cycle)\b/.test(text)) return "cycle_font_next";
  }
  if (contrast) {
    if (inc || /\b(darker|pop|boost|higher)\b/.test(text)) return "increase_contrast";
    if (dec || /\b(softer|calmer|lower|less harsh|tone down|ease|lighter)\b/.test(text)) return "decrease_contrast";
  }
  if (letter) {
    if (inc || /\b(spread|loosen|widen|more space|airier|space out)\b/.test(text)) return "increase_letter_spacing";
    if (dec || /\b(tight|closer|narrow|squeeze|compress|condense)\b/.test(text)) return "decrease_letter_spacing";
  }
  if (word) {
    if (inc || /\b(spread|loosen|more space|further apart|space out)\b/.test(text)) return "increase_word_spacing";
    if (dec || /\b(tight|closer|narrow|squeeze|compress|condense)\b/.test(text)) return "decrease_word_spacing";
  }
  if (line) {
    if (inc || /\b(spread|loosen|more space|bigger gaps|double space|add space)\b/.test(text)) return "increase_line_spacing";
    if (dec || /\b(tight|closer|narrow|compress|less space|smaller gaps|reduce space|shorter)\b/.test(text)) return "decrease_line_spacing";
  }
  if (sizeOnly) {
    if (inc) return "increase_font";
    if (dec) return "decrease_font";
  }
  if (!inc && /\b(smaller|tight|narrow)\b/.test(text)) return "decrease_font";
  if (!dec && /\b(bigger|larger|looser|wider)\b/.test(text)) return "increase_font";
  return null;
}

/* ---------- Component ---------- */
export default function ADHDCustomPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<ADHDCustomSettings>(() => ({
    ...defaultADHDCustomSettings
  }));
  const [mode, setMode] = useState<Mode>("dark");
  const [chat, setChat] = useState<ChatMsg[]>([
    { from: "agent", text: "Hi! Adjust ADHD text: 'increase highlight', 'highlight less', 'make it bigger', 'contrast change', 'cycle font'." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      return;
    }

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds(v => v + 1);
    }, 1000);

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [isRecording]);

  const formatRecordingTime = useCallback((seconds: number) => {
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, []);

  // Mount + model load
  useEffect(() => {
    setMounted(true);
    setTimeout(() => {
      try {
        const stored = loadADHDCustomSettings();
        if (stored) setSettings(stored);
      } catch (e) {
        console.warn("[ADHD Custom] load failed", e);
      }
    }, 0);
    loadLocalIntentModel().catch(() => {});
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const applyIntent = useCallback((intent: string, prev: ADHDCustomSettings) => {
    const LETTER_STEP = 0.06;
    const WORD_STEP = 0.12;
    const LINE_STEP = 0.25;
    let next = { ...prev };
    let msg = "";

    switch (intent) {
      case "increase_font":
        next.fontSize = clamp(next.fontSize + 2, 10, 72); msg = "Font size increased."; break;
      case "decrease_font":
        next.fontSize = clamp(next.fontSize - 2, 10, 72); msg = "Font size decreased."; break;
      case "cycle_font_next":
        next.fontFamilyIndex = (next.fontFamilyIndex + 1) % FONT_FAMILIES.length; msg = "Font changed."; break;
      case "cycle_font_prev":
        next.fontFamilyIndex = (next.fontFamilyIndex - 1 + FONT_FAMILIES.length) % FONT_FAMILIES.length; msg = "Font changed."; break;
      case "increase_contrast":
        next.contrastIndex = (next.contrastIndex + 1) % CONTRAST_PRESETS.length; msg = "Contrast changed."; break;
      case "decrease_contrast":
        next.contrastIndex = (next.contrastIndex - 1 + CONTRAST_PRESETS.length) % CONTRAST_PRESETS.length; msg = "Contrast changed."; break;
      case "increase_letter_spacing":
        next.letterSpacing = clamp(next.letterSpacing + LETTER_STEP, 0, 1.2); msg = `Letter spacing increased (${next.letterSpacing.toFixed(2)}em).`; break;
      case "decrease_letter_spacing":
        next.letterSpacing = clamp(next.letterSpacing - LETTER_STEP, 0, 1.2); msg = `Letter spacing decreased (${next.letterSpacing.toFixed(2)}em).`; break;
      case "increase_line_spacing":
        next.lineSpacing = clamp(next.lineSpacing + LINE_STEP, 1, 4); msg = `Line spacing increased (${next.lineSpacing.toFixed(2)}).`; break;
      case "decrease_line_spacing":
        next.lineSpacing = clamp(next.lineSpacing - LINE_STEP, 1, 4); msg = `Line spacing decreased (${next.lineSpacing.toFixed(2)}).`; break;
      case "increase_word_spacing":
        next.wordSpacing = clamp(next.wordSpacing + WORD_STEP, 0, 3); msg = `Word spacing increased (${next.wordSpacing.toFixed(2)}em).`; break;
      case "decrease_word_spacing":
        next.wordSpacing = clamp(next.wordSpacing - WORD_STEP, 0, 3); msg = `Word spacing decreased (${next.wordSpacing.toFixed(2)}em).`; break;

      case "increase_highlight": {
        // More frequent highlight = reduce interval
        if (!next.highlightEnabled) {
          // Re-enable at a starting interval
            next.highlightEnabled = true;
            next.highlightEvery = 8;
            msg = "Highlight enabled.";
            break;
        }
        if (next.highlightEvery <= 2) {
          next.highlightEvery = 2;
          msg = "Maximum highlight already.";
        } else {
          next.highlightEvery = clamp(next.highlightEvery - 1, 2, 20);
          msg = `Highlight frequency increased (every ${next.highlightEvery} words).`;
        }
        break;
      }
      case "decrease_highlight": {
        if (!next.highlightEnabled) {
          msg = "Highlight already off.";
          break;
        }
        next.highlightEvery = next.highlightEvery + 1;
        if (next.highlightEvery > 8) {
          // Auto-disable
          next.highlightEnabled = false;
          msg = "Highlight removed.";
        } else {
          msg = `Highlight frequency decreased (every ${next.highlightEvery} words).`;
        }
        break;
      }

      case "undo_changes":
        next = { ...defaultADHDCustomSettings };
        msg = "Settings reset to defaults.";
        break;
      default:
        msg = "Try: 'increase highlight', 'highlight less', 'make it bigger', 'contrast change', 'cycle font'.";
    }

    // Derive font & contrast after changes
    next.fontFamily = FONT_FAMILIES[next.fontFamilyIndex];
    const palette = CONTRAST_PRESETS[next.contrastIndex];
    next.fontColor = palette.fontColor;
    next.backgroundColor = palette.backgroundColor;

    return { next, msg };
  }, []);

  async function handleSend() {
    if (!mounted) return;
    const userText = input.trim();
    if (!userText) return;
    setChat(c => [...c, { from: "user", text: userText }]);
    setInput("");
    setLoading(true);

    const overrideIntent = deriveIntentOverride(userText);
    let intent = overrideIntent || "other";

    if (!overrideIntent) {
      try {
        const res = await classifyIntentLocal(userText, 0);
        const allowed = new Set([
          "increase_font","decrease_font",
          "increase_line_spacing","decrease_line_spacing",
          "increase_letter_spacing","decrease_letter_spacing",
          "increase_word_spacing","decrease_word_spacing",
          "increase_contrast","decrease_contrast",
          "cycle_font_next","cycle_font_prev",
          "undo_changes"
        ]);
        if (allowed.has(res.intent)) intent = res.intent;
      } catch {
        // ignore
      }
    }

    const { next, msg } = applyIntent(intent, settings);
    setSettings(next);
    setChat(c => [...c, { from: "agent", text: msg }]);
    setLoading(false);
  }

  const stopMicStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const transcribeAudioBlob = useCallback(async (blob: Blob) => {
    const backend = "/api/backend";
    setIsTranscribing(true);
    setMicError("");
    try {
      const formData = new FormData();
      formData.append("audio", blob, `mic-${Date.now()}.webm`);
      formData.append("language", "en");
      const res = await fetch(`${backend}/api/transcribe`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Transcription failed.");
      }

      const transcript = String(data?.text || "").trim();
      if (!transcript) {
        setMicError("No speech detected. Try again and speak a bit louder.");
        return;
      }

      setInput(prev => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
    } catch (e: any) {
      setMicError(e?.message || "Unable to transcribe audio.");
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!mounted || isRecording || isTranscribing) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Microphone is not supported in this browser.");
      return;
    }

    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = ev => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        stopMicStream();
        if (blob.size > 0) {
          await transcribeAudioBlob(blob);
        }
      };

      recorder.start();
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (e: any) {
      setMicError(e?.message || "Microphone permission denied.");
      stopMicStream();
      setIsRecording(false);
    }
  }, [mounted, isRecording, isTranscribing, stopMicStream, transcribeAudioBlob]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state !== "inactive") recorder.stop();
    setIsRecording(false);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !loading) handleSend();
  }

  const theme = mode === "dark"
    ? {
        bg: "radial-gradient(circle at 15% 20%, #142034 0%, #08101b 55%, #04070a 85%)",
        panelBg: "bg-white/5",
        border: "border-white/10",
        textSoft: "text-indigo-100/80",
        previewBorder: "border-white/15",
        chatUser: "bg-indigo-500/80 text-white",
        chatBot: "bg-white/10 text-indigo-50",
        inputBg: "bg-white/10 text-indigo-50 placeholder:text-indigo-200/40 border-white/20",
        btnPrimary: "bg-indigo-600 hover:bg-indigo-500",
        gradientBtn: "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500",
      }
    : {
        bg: "radial-gradient(circle at 30% 30%, #ffffff 0%, #eef5ff 55%, #e2efff 90%)",
        panelBg: "bg-white/80",
        border: "border-indigo-200",
        textSoft: "text-indigo-700/70",
        previewBorder: "border-indigo-200/70",
        chatUser: "bg-indigo-600 text-white",
        chatBot: "bg-indigo-100 text-indigo-900",
        inputBg: "bg-white text-indigo-900 placeholder:text-indigo-400 border-indigo-300",
        btnPrimary: "bg-indigo-600 hover:bg-indigo-500",
        gradientBtn: "bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400",
      };

  const renderSettings = mounted
    ? settings
    : {
        ...defaultADHDCustomSettings,
        fontColor: "#111",
        backgroundColor: "#fff",
        letterSpacing: 0,
        wordSpacing: 0,
        lineSpacing: 1.6
      };

  const highlightSentence = (sentence: string) => {
    if (!renderSettings.highlightEnabled) return sentence;
    const every = Math.max(2, Math.min(8, renderSettings.highlightEvery)); // active only up to 8
    const words = sentence.split(/\s+/);
    return (
      <span>
        {words.map((w, i) => {
          const mark = ((i + 1) % every) === 0;
          return (
            <span
              key={i}
              className={mark ? "px-1 rounded-sm" : undefined}
              style={
                mark
                  ? {
                      backgroundColor: `color-mix(in oklab, var(--primary) ${Math.min(
                        Math.round(renderSettings.highlightOpacity * 100),
                        65
                      )}%, transparent)`
                    }
                  : undefined
              }
            >
              {w}{i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <main
      className="relative min-h-dvh"
      style={{
        background: theme.bg,
        color: mode === "dark" ? "#f5faff" : "#0b2540"
      }}
    >
      <Header variant="adhd-adapt" />
      <section className="relative mx-auto max-w-5xl px-4 md:px-8 pt-5 pb-24">
        <div className={clsx("backdrop-blur-md rounded-2xl overflow-hidden shadow-xl border",
          theme.panelBg, theme.border)}>
          {/* Top bar */}
          <div className={clsx("px-5 py-3 border-b flex items-center justify-between", theme.border)}>
            <div className="text-sm font-medium tracking-wide flex items-center gap-3">
              <span>ADHD Customization</span>
              <Button
                size="sm"
                variant="outline"
                className={clsx("text-xs", mode === "dark" ? "border-white/30 text-white" : "border-indigo-300 text-indigo-800")}
                onClick={() => setMode(m => m === "dark" ? "light" : "dark")}
              >
                {mode === "dark" ? "Light Mode" : "Dark Mode"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className={mode === "dark" ? "border-white/30 text-white" : "border-indigo-300 text-indigo-800"}
                onClick={() => {
                  clearADHDCustomSettings();
                  setSettings({ ...defaultADHDCustomSettings });
                }}
              >
                Reset
              </Button>
              <Button
                variant="secondary"
                className={mode === "dark" ? "bg-indigo-500/80 hover:bg-indigo-500 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"}
                onClick={() => {
                  saveADHDCustomSettings(settings);
                  window.location.href = "/adhd/adapt";
                }}
                disabled={!mounted}
              >
                Save & Apply
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-0 md:gap-10 p-6 md:p-10">
            {/* Preview */}
            <div>
              <div className={clsx("mb-2 text-base font-semibold", theme.textSoft)}>Live Preview</div>
              <div
                suppressHydrationWarning
                className={clsx(
                  "rounded-lg border p-6 shadow-inner transition-all backdrop-blur-sm",
                  theme.previewBorder,
                  theme.panelBg,
                  mounted && "animate-[fadeIn_.3s_ease]"
                )}
                style={{
                  fontSize: `${renderSettings.fontSize}px`,
                  fontFamily: FONT_FAMILIES[renderSettings.fontFamilyIndex],
                  letterSpacing: mounted && renderSettings.letterSpacing ? `${renderSettings.letterSpacing}em` : undefined,
                  lineHeight: renderSettings.lineSpacing,
                  wordSpacing: mounted && renderSettings.wordSpacing ? `${renderSettings.wordSpacing}em` : undefined,
                  color: mounted ? renderSettings.fontColor : "#111",
                  background: mounted ? renderSettings.backgroundColor : "#fff",
                  minHeight: 180,
                  transition: "color .25s, background .25s, font-size .2s, letter-spacing .2s, word-spacing .2s, line-height .2s"
                }}
              >
                {PREVIEW.split("\n").map((p, i) => (
                  <p key={i} className="mb-3 last:mb-0">
                    {renderSettings.highlightEnabled ? highlightSentence(p) : p}
                  </p>
                ))}
              </div>
              <div className={clsx("mt-3 text-xs space-y-1", theme.textSoft)}>
                <div>Font: <code>{FONT_FAMILIES[renderSettings.fontFamilyIndex].split(",")[0].replace(/'/g, "")}</code></div>
                <div>Contrast: <code>{renderSettings.fontColor}</code> / <code>{renderSettings.backgroundColor}</code></div>
                <div>
                  Spacing: letters <code>{renderSettings.letterSpacing.toFixed(2)}</code> |
                  {" "}words <code>{renderSettings.wordSpacing.toFixed(2)}</code> |
                  {" "}lines <code>{renderSettings.lineSpacing.toFixed(2)}</code>
                </div>
                <div>
                  Highlight: {renderSettings.highlightEnabled
                    ? <code>every {Math.min(renderSettings.highlightEvery, 8)}</code>
                    : <code>off</code>}
                </div>
              </div>
            </div>

            {/* Chat */}
            <div>
              <div className={clsx("mb-2 text-base font-semibold", theme.textSoft)}>Chat Agent</div>
              <div className={clsx(
                "rounded-lg h-72 p-3 overflow-y-auto scrollbar-thin scrollbar-track-transparent hover:scrollbar-thumb-white/40 border space-y-0.5",
                theme.panelBg,
                theme.previewBorder
              )}>
                {chat.map((m, i) => (
                  <div key={i} className={clsx("my-1 flex", m.from === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={clsx(
                        "px-3 py-2 rounded-2xl text-sm max-w-[75%] leading-snug shadow",
                        m.from === "user" ? theme.chatUser : theme.chatBot
                      )}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className={clsx(
                    "w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring",
                    theme.inputBg,
                    mode === "dark" ? "focus:ring-indigo-400/40" : "focus:ring-indigo-500/40"
                  )}
                  placeholder="e.g. increase highlight, highlight less, make it bigger..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={!mounted || loading || isTranscribing}
                />
                <Button
                  disabled={!input.trim() || loading || !mounted || isTranscribing || isRecording}
                  onClick={handleSend}
                  className={theme.btnPrimary}
                >
                  {loading ? "..." : "Send"}
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {!isRecording ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={mode === "dark" ? "border-white/30 text-white" : "border-indigo-300 text-indigo-800"}
                    onClick={startRecording}
                    disabled={!mounted || loading || isTranscribing}
                    aria-label="Start microphone"
                    title="Start microphone"
                  >
                    {isTranscribing ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={stopRecording}
                    aria-label="Stop microphone"
                    title="Stop microphone"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                )}
                <div className={clsx("text-xs", theme.textSoft)}>
                  {isRecording
                    ? `Recording ${formatRecordingTime(recordingSeconds)}... click Stop Mic to insert transcript in the box.`
                    : "After Stop, the transcript appears in the input. Press Enter to send."}
                </div>
              </div>
              {micError && (
                <div className="mt-2 text-xs text-red-400">{micError}</div>
              )}
              <Button
                className={clsx("w-full mt-4", theme.gradientBtn)}
                disabled={!mounted}
                onClick={() => {
                  saveADHDCustomSettings(settings);
                  window.location.href = "/adhd/adapt";
                }}
              >
                Save & Use on Reading Page
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
