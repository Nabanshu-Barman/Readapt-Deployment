"use client"

import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type Q = { id: number; text: string; group: "Hyperactivity" | "Inattention" }

const QUESTIONS: Q[] = [
  { id: 1, text: "I feel restless or fidgety while reading.", group: "Hyperactivity" },
  { id: 2, text: "I frequently interrupt my own reading flow.", group: "Hyperactivity" },
  { id: 3, text: "I rush through lines and miss words.", group: "Hyperactivity" },
  { id: 4, text: "I find it hard to sit still and read.", group: "Hyperactivity" },
  { id: 5, text: "I act impulsively while scanning text.", group: "Hyperactivity" },
  { id: 6, text: "I lose track of where I am on the page.", group: "Inattention" },
  { id: 7, text: "I often re-read lines to understand.", group: "Inattention" },
  { id: 8, text: "My mind wanders while reading.", group: "Inattention" },
  { id: 9, text: "I struggle to maintain focus on long passages.", group: "Inattention" },
  { id: 10, text: "I have difficulty organizing notes from reading.", group: "Inattention" },
]

const LABELS = ["None", "Mild", "Moderate", "Severe"]

function getBackendBaseUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
}

/**
 * Compute the quiz-based class (0-3) BEFORE sending to backend.
 * Your backend /api/adhd-diagnose currently does NOT compute quiz_class,
 * so the returned value defaults to 0. We fix that here client-side.
 *
 * Heuristic:
 *  - Hyperactivity raw score = sum of first 5 responses (0..3 each) -> 0..15
 *  - Inattention  raw score = sum of last 5 responses -> 0..15
 *  - Threshold chosen = 8 ( > ~53% of max ) to count a domain as elevated.
 *    (Adjust later if you calibrate.)
 *  - Class mapping:
 *        both elevated      => 3 (Combined)
 *        only inattention   => 1 (Inattentive)
 *        only hyperactivity => 2 (Hyperactive-Impulsive)
 *        none elevated      => 0 (No ADHD)
 */
function deriveQuizClass(ans: number[]): number {
  const hyper = ans.slice(0, 5).reduce((a, b) => a + b, 0)
  const inatt = ans.slice(5).reduce((a, b) => a + b, 0)
  const THRESH = 8
  const hyperHigh = hyper >= THRESH
  const inattHigh = inatt >= THRESH
  if (hyperHigh && inattHigh) return 3
  if (inattHigh) return 1
  if (hyperHigh) return 2
  return 0
}

export default function ADHDQuizPage() {
  const router = useRouter()
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<number[]>(Array(QUESTIONS.length).fill(0))
  const answersRef = useRef<number[]>(answers)
  const [analyzing, setAnalyzing] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

  const current = QUESTIONS[idx]

  useEffect(() => {
    let streamRef: MediaStream | null = null
    const init = async () => {
      try {
        streamRef = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 180 }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef
          await videoRef.current.play()
        }
        recordedChunksRef.current = []
        const recorder = new MediaRecorder(streamRef, { mimeType: "video/webm" })
        mediaRecorderRef.current = recorder
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) recordedChunksRef.current.push(event.data)
        }
        recorder.onstop = async () => {
          const videoBlob = new Blob(recordedChunksRef.current, { type: "video/webm" })
          if (videoBlob.size === 0) {
            alert("Video recording failed. Please allow webcam access and spend a few seconds on the quiz.")
            setAnalyzing(false)
            return
          }

          // Compute quiz class locally (fix: previously always 0)
          const quizClass = deriveQuizClass(answersRef.current)
          localStorage.setItem("readapt:adhdQuizClass", String(quizClass))

          const formData = new FormData()
          formData.append("answers", JSON.stringify(answersRef.current))
          formData.append("video", videoBlob)

          try {
            const backend = getBackendBaseUrl()
            const res = await fetch(`${backend}/api/adhd-diagnose`, {
              method: "POST",
              body: formData,
            })
            const data = await res.json()

            // Store gaze metrics
            localStorage.setItem("readapt:adhdPrediction", String(data.adhd_prediction ?? "No ADHD"))
            localStorage.setItem("readapt:adhdGazePoints", String(data.num_gaze_frames ?? ""))
            localStorage.setItem("readapt:adhdGazeVariability", String(data.adhd_gaze_variability ?? ""))
            localStorage.setItem("readapt:adhdGazeResult", String(data.adhd_result ?? ""))
            localStorage.setItem("readapt:adhdThreshold", String(data.adhd_threshold ?? "0.229"))

            // We ignore data.quiz_class / data.final_class if absent.
            // Final class now determined on results page by rule:
            // final = quizClass + (gazeResult == ADHD ? 1 : 0)
            // (Will be recomputed there; optional store placeholder here)
            localStorage.setItem("readapt:adhdFinalClass", String(quizClass))

            setAnalyzing(false)
            router.push(`/adhd/results`)
          } catch {
            setAnalyzing(false)
            alert("Failed to analyze responses. Please try again.")
          }
        }
        recorder.start()
      } catch {
        console.log("webcam permission denied or not available")
      }
    }
    init()
    return () => {
      streamRef?.getTracks().forEach(t => t.stop())
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        try { mediaRecorderRef.current.stop() } catch {}
      }
    }
  }, [router])

  useEffect(() => { answersRef.current = answers }, [answers])

  const severityClass = (val: number) =>
    val >= 3 ? "bg-destructive/70" : val === 2 ? "bg-primary/70" : val === 1 ? "bg-secondary/70" : "bg-muted/70"

  const onChange = (val: number[]) => {
    const v = val[0] ?? 0
    setAnswers(prev => {
      const next = [...prev]
      next[idx] = v
      return next
    })
  }

  const onPrev = () => setIdx(i => Math.max(0, i - 1))

  const onFinish = () => {
    setAnalyzing(true)
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") recorder.stop()
  }

  const onNext = () => {
    if (idx < QUESTIONS.length - 1) setIdx(i => i + 1)
    else onFinish()
  }

  const progress = useMemo(() => ((idx + 1) / QUESTIONS.length) * 100, [idx])

  return (
    <main className="relative min-h-dvh">
      <Header variant="adhd-quiz" />
      <section className="mx-auto max-w-5xl px-4 md:px-8 pt-6 pb-20">
        {/* Top Meta Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            ADHD Assessment
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-muted px-3 py-1 font-medium">
              Question {idx + 1} / {QUESTIONS.length}
            </span>
            <span className="text-muted-foreground hidden sm:inline">
              Answer honestly based on your typical reading behavior.
            </span>
          </div>
        </div>

        {/* Layout */}
        <div className="relative grid gap-6 lg:grid-cols-12">
          {/* Left: Quiz */}
          <div className="lg:col-span-8">
            <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-white/10 dark:via-white/5 backdrop-blur-xl shadow-[0_8px_38px_-14px_rgba(0,0,0,0.45)] p-8 overflow-hidden">
              {/* Progress */}
              <div className="mb-8">
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary via-sky-500 to-violet-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>{current.group}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>

              {/* Question */}
              <div className="space-y-5">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight leading-snug">
                  {current.group}
                </h2>
                <p className="text-lg md:text-2xl leading-relaxed font-medium">
                  {current.text}
                </p>
              </div>

              {/* Slider */}
              <div className="mt-10">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-3 tracking-wide">
                  {LABELS.map(l => (
                    <span key={l} className="w-1/4 text-center">{l}</span>
                  ))}
                </div>
                <Slider
                  value={[answers[idx] ?? 0]}
                  min={0}
                  max={3}
                  step={1}
                  onValueChange={onChange}
                  className="w-full"
                />
                <div className="mt-5 h-2 rounded-full relative overflow-hidden bg-white/10">
                  <div
                    className={`absolute inset-y-0 left-0 ${severityClass(answers[idx] ?? 0)} transition-all`}
                    style={{ width: `${((answers[idx] ?? 0) / 3) * 100}%` }}
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button
                  variant="outline"
                  onClick={onPrev}
                  disabled={idx === 0}
                  className="h-11 px-7 rounded-xl"
                >
                  Previous
                </Button>
                <Button
                  onClick={onNext}
                  className="h-11 px-7 rounded-xl font-semibold"
                >
                  {idx === QUESTIONS.length - 1 ? "Finish" : "Next"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Use the scale to rate your experience.
                </span>
              </div>

              {/* Analyzing Overlay */}
              {analyzing && (
                <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-background/70 rounded-3xl">
                  <div className="text-center space-y-4">
                    <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                    <p className="text-sm text-muted-foreground font-medium">
                      Analyzing responses & gaze variability...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Video */}
          <div className="lg:col-span-4 order-first lg:order-none">
            <div className="sticky top-24">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-white/10 dark:via-white/5 backdrop-blur-xl p-5 flex flex-col gap-4 shadow-[0_6px_32px_-10px_rgba(0,0,0,0.42)]">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-primary/80">
                  Gaze Capture
                </h3>
                <div className="relative mx-auto rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-inner">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    aria-label="Webcam recording preview"
                    className="h-40 w-64 object-cover md:h-44 md:w-72 transition-all"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-[10px] text-center text-white/80 py-1 tracking-wide">
                    Recording (auto)
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Keep your face within frame. Recording stops when you finish the last question.
                </p>
                <ul className="text-[11px] text-muted-foreground/80 space-y-1">
                  <li className="flex gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500/80 mt-1" />
                    Good lighting improves accuracy.
                  </li>
                  <li className="flex gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-500/80 mt-1" />
                    Keep eyes visible (avoid covering).
                  </li>
                  <li className="flex gap-2">
                    <span className="h-2 w-2 rounded-full bg-violet-500/80 mt-1" />
                    Look naturally—no need to stare.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </section>
    </main>
  )
}
