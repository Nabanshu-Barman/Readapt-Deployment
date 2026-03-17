"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

type QuizOption = {
  code: "A" | "B" | "C"
  label: string
  value: 0 | 1 | 2
}

interface QuizQuestion {
function getBackendBaseUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
}
  index: number
  id: string
  typeLabel: string
  prompt: string
  mediaType: "image" | "audio" | "none"
  imageSrc?: string
  audioSrc?: string
  options: QuizOption[]
  constructs: string[]
}

/* Question Set (UNCHANGED content / paths) */
const QUESTIONS: QuizQuestion[] = [
  {
    index: 0,
    id: "q0-letter-b-d",
    typeLabel: "Letter Discrimination (Visual + Language)",
    prompt: "What is the second letter of the alphabet?",
    mediaType: "image",
    imageSrc: "/quiz/q1.png",
    options: [
      { code: "A", label: "1", value: 2 },
      { code: "B", label: "2", value: 1 },
      { code: "C", label: "3", value: 0 },
    ],
    constructs: ["Language_vocab", "Visual_discrimination"]
  },
  {
    index: 1,
    id: "q1-cat-word",
    typeLabel: "Word Recognition (Language + Memory)",
    prompt: "Which word matches the picture?",
    mediaType: "image",
    imageSrc: "/quiz/q2.jpg",
    options: [
      { code: "A", label: "cat", value: 2 },
      { code: "B", label: "ↄat", value: 1 },
      { code: "C", label: "cta", value: 0 },
    ],
    constructs: ["Language_vocab", "Memory"]
  },
  {
    index: 2,
    id: "q2-letter-g",
    typeLabel: "Shape / Letter Identification (Visual + Language)",
    prompt: "Which of the two is correct?",
    mediaType: "image",
    imageSrc: "/quiz/q3.png",
    options: [
      { code: "A", label: "1", value: 2 },
      { code: "B", label: "2", value: 1 },
      { code: "C", label: "3", value: 0 },
    ],
    constructs: ["Language_vocab", "Visual_discrimination"]
  },
  {
    index: 3,
    id: "q3-letter-order",
    typeLabel: "Letter Order / Serial (Visual + Language)",
    prompt: "Which picture shows the correct left‑to‑right order?",
    mediaType: "image",
    imageSrc: "/quiz/q4.png",
    options: [
      { code: "A", label: "1", value: 2 },
      { code: "B", label: "2", value: 1 },
      { code: "C", label: "none", value: 0 },
    ],
    constructs: ["Language_vocab", "Visual_discrimination"]
  },
  {
    index: 4,
    id: "q4-pineapple",
    typeLabel: "Vocabulary / Semantics (Language)",
    prompt: "Which label best names the pictured object?",
    mediaType: "image",
    imageSrc: "/quiz/q5.png",
    options: [
      { code: "A", label: "pineapple", value: 2 },
      { code: "B", label: "pineabble", value: 1 },
      { code: "C", label: "peinaddle", value: 0 },
    ],
    constructs: ["Language_vocab"]
  },
  {
    index: 5,
    id: "q5-upper-lower",
    typeLabel: "Upper–Lower Mapping (Visual + Language)",
    prompt: "Which lowercase letter matches the uppercase letter shown?",
    mediaType: "image",
    imageSrc: "/quiz/q6.png",
    options: [
      { code: "A", label: "q", value: 2 },
      { code: "B", label: "p", value: 1 },
      { code: "C", label: "d", value: 0 },
    ],
    constructs: ["Language_vocab", "Visual_discrimination"]
  },
  {
    index: 6,
    id: "q6-audio-phoneme",
    typeLabel: "Phoneme Discrimination (Audio)",
    prompt: "What sound do you hear? (Choose the closest single consonant.)",
    mediaType: "audio",
    audioSrc: "/quiz/q7.mp3",
    options: [
      { code: "A", label: "m", value: 2 },
      { code: "B", label: "n", value: 1 },
      { code: "C", label: "f", value: 0 },
    ],
    constructs: ["Audio_Discrimination"]
  },
  {
    index: 7,
    id: "q7-object-teapot",
    typeLabel: "Object Naming (Language)",
    prompt: "Which is the object in the picture?",
    mediaType: "image",
    imageSrc: "/quiz/q8.png",
    options: [
      { code: "A", label: "teapot", value: 2 },
      { code: "B", label: "taepot", value: 1 },
      { code: "C", label: "taebot", value: 0 },
    ],
    constructs: ["Language_vocab"]
  },
  {
    index: 8,
    id: "q8-recall-cat",
    typeLabel: "Picture Recall (Memory)",
    prompt: "Has this picture been shown earlier in the quiz?",
    mediaType: "image",
    imageSrc: "/quiz/q9.jpg",
    options: [
      { code: "A", label: "Yes (exact same image)", value: 2 },
      { code: "B", label: "A similary image has been shown", value: 1 },
      { code: "C", label: "No", value: 0 },
    ],
    constructs: ["Memory"]
  },
  {
    index: 9,
    id: "q9-audio-word",
    typeLabel: "Word Discrimination (Audio)",
    prompt: "Which word was spoken?",
    mediaType: "audio",
    audioSrc: "/quiz/q10.mp3",
    options: [
      { code: "A", label: "Lake", value: 2 },
      { code: "B", label: "⅃ake", value: 1 },
      { code: "C", label: "ache", value: 0 },
    ],
    constructs: ["Audio_Discrimination"]
  },
]

export default function DyslexiaQuizPage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<(0 | 1 | 2 | null)[]>(() => Array(10).fill(null))
  const [current, setCurrent] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const rafRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Clear stale stored computation on mount so results page doesn’t show “old run”
  useEffect(() => {
    localStorage.removeItem("readapt:features")
    localStorage.removeItem("readapt:debug_log")
  }, [])

  /* Timer */
  useEffect(() => {
    const start = performance.now()
    const loop = () => {
      setElapsed(Math.floor((performance.now() - start) / 1000))
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  /* Reload audio on question change */
  useEffect(() => {
    if (QUESTIONS[current].mediaType === "audio" && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.load()
    }
  }, [current])

  const timeStr = useMemo(() => {
    const m = Math.floor(elapsed / 60).toString().padStart(2, "0")
    const s = (elapsed % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }, [elapsed])

  const question = QUESTIONS[current]

  const selectOption = (value: 0 | 1 | 2) => {
    setAnswers(prev => {
      const next = [...prev]
      next[current] = value
      return next
    })
    setTimeout(() => {
      if (current < QUESTIONS.length - 1) {
        setCurrent(c => c + 1)
      } else {
        finishQuiz([...answers.slice(0, current), value])
      }
    }, 160)
  }

  const finishQuiz = async (finalAnswers?: (0 | 1 | 2 | null)[]) => {
    const arr = (finalAnswers ?? answers).map(a => (a == null ? 0 : a))
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    try {
      const backend = getBackendBaseUrl()
      const res = await fetch(`${backend}/api/predict-dyslexia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: arr, time: elapsed })
      })
      const data = await res.json()
      if (typeof data.label === "number") {
        localStorage.setItem("readapt:label", String(data.label))
        localStorage.setItem("readapt:time", String(elapsed))
        localStorage.setItem("readapt:lastMode", "dyslexia")
        // NEW: persist features & debug log so results page can show them
        if (Array.isArray(data.features)) {
          localStorage.setItem("readapt:features", JSON.stringify(data.features))
        }
        if (typeof data.debug_log === "string") {
          localStorage.setItem("readapt:debug_log", data.debug_log)
        }
        router.push("/dyslexia/results")
      } else {
        alert("Prediction failed: " + (data.error || "Unknown error"))
      }
    } catch (e) {
      alert("Failed to connect to backend: " + e)
    }
  }

  const progressPct = (answers.filter(a => a !== null).length / QUESTIONS.length) * 100

  return (
    <main className="relative min-h-dvh">
      <Header variant="quiz" timer={timeStr} />

      <section className="mx-auto max-w-[1100px] px-4 md:px-6 pt-10 pb-20">
        <div
          className="
            relative
            w-[1100px] h-[740px]
            rounded-3xl border border-white/10
            bg-gradient-to-br from-white/10 via-white/5 to-transparent
            dark:from-white/10 dark:via-white/5
            backdrop-blur-xl shadow-[0_8px_38px_-14px_rgba(0,0,0,0.45)]
            p-8 md:p-9
            overflow-hidden
            flex flex-col
          "
        >
          <div className="flex-1 overflow-auto pr-1">
            <div className="flex flex-col gap-1 mb-4">
              <span className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-primary/80">
                {question.typeLabel}
              </span>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight leading-snug">
                Q{question.index + 1} • {question.prompt}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-5">
              <div className="text-sm md:text-base font-medium text-muted-foreground">
                {current + 1} / {QUESTIONS.length}
              </div>
              <div className="text-sm md:text-base font-semibold text-primary">
                {timeStr}
              </div>
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-sky-500 to-violet-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="mb-6">
              {question.mediaType === "image" && question.imageSrc && (
                <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 dark:bg-white/5 p-3 h-[230px]">
                  <img
                    src={question.imageSrc}
                    alt={`Question ${current + 1} illustration`}
                    className="max-h-full max-w-full object-contain rounded-lg"
                    draggable={false}
                  />
                </div>
              )}
              {question.mediaType === "audio" && question.audioSrc && (
                <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-white/5 p-4 h-[150px] flex flex-col justify-center">
                  <audio
                    key={question.id}
                    ref={audioRef}
                    controls
                    preload="auto"
                    className="w-full"
                  >
                    <source src={question.audioSrc} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Play the audio and answer.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3 min-h-[180px]">
              {question.options.map(opt => {
                const selected = answers[current] === opt.value
                return (
                  <Button
                    key={opt.code}
                    type="button"
                    variant={selected ? "default" : "secondary"}
                    onClick={() => selectOption(opt.value)}
                    aria-pressed={selected}
                    className="h-auto py-4 px-4 flex flex-col gap-1 text-base font-medium rounded-xl"
                  >
                    <span className="text-xs font-semibold opacity-80 tracking-wide">
                      {opt.code}
                    </span>
                    <span className="leading-snug">{opt.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              disabled={current === 0}
              onClick={() => setCurrent(c => Math.max(0, c - 1))}
              className="h-10 px-5 text-sm font-medium"
            >
              Previous
            </Button>
            <div className="text-[11px] md:text-xs text-muted-foreground tracking-wide">
              {current === QUESTIONS.length - 1
                ? "Auto-finish after last answer"
                : "Select an answer to continue"}
            </div>
            <div className="h-10 px-5 flex items-center text-xs font-medium text-muted-foreground">
              Progress {Math.round(progressPct)}%
            </div>
          </div>

          <p className="absolute bottom-2 left-0 w-full px-8 text-[10px] leading-snug text-muted-foreground">
            Demo only – not a medical or diagnostic tool. Research refs: Snowling; Swanson & Siegel; Vidyasagar & Pammer; Tallal; Reading Rockets.
          </p>
        </div>
      </section>
    </main>
  )
}