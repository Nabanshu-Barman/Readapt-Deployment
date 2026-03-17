"use client"

import Image from "next/image"
import Link from "next/link"
import { Header } from "@/components/header"
import { Particles } from "@/components/particles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffect, useMemo, useState } from "react"
import "../dashboard/lowvision-dashboard.css"

export default function LowVisionDashboardPage() {
  const [power, setPower] = useState("")
  const [error, setError] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [resultClass, setResultClass] = useState<0 | 1 | 2 | null>(null)

  useEffect(() => {
    setError("")
    setResultClass(null)
  }, [power])

  // Accept positive diopters (hypermetropia). Allow "2", "+1.75", "1.5"
  const canSubmit = useMemo(() => {
    if (!power.trim()) return false
    const v = Number(power)
    return !Number.isNaN(v) && v >= 0
  }, [power])

  const analyze = () => {
    if (!canSubmit) {
      setError("Enter a positive diopter value like +1.75, 2, 3.25, etc.")
      return
    }
    setError("")
    setAnalyzing(true)
    const v = Math.abs(Number(power))
    // Use absolute magnitude thresholds:
    // Class 0: 0 to <1.5
    // Class 1: 1.5 to <3.0
    // Class 2: >=3.0
    const cls: 0 | 1 | 2 = v < 1.5 ? 0 : v < 3.0 ? 1 : 2

    setTimeout(() => {
      setResultClass(cls)
      localStorage.setItem("readapt:lowvisionClass", String(cls))
      const preset = cls === 0 ? 1 : cls === 1 ? 2 : 3
      localStorage.setItem("readapt:lowvisionPreset", String(preset))
      localStorage.setItem("readapt:lastMode", "lowvision")
      setAnalyzing(false)
    }, 700)
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* shared header variant for Low Vision (shows Modes > Low Vision) */}
      <Header variant="lowvision-dashboard" />

      {/* background particles + soft radial accents to match other dashboards */}
      <div className="absolute inset-0 -z-10">
        <Particles density={0.00075} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_30%,theme(colors.amber.300/.20),transparent_60%),radial-gradient(circle_at_78%_72%,theme(colors.fuchsia.400/.22),transparent_65%)]"
        />
      </div>

      <section className="mx-auto max-w-7xl px-4 pt-10 pb-20 md:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Main left panel: made wider (lg:col-span-3) for legibility */}
          <article
            className="lv-panel col-span-1 flex flex-col gap-5 rounded-3xl border border-[var(--lv-border-card)] bg-[var(--lv-bg-panel)] backdrop-blur-xl shadow-[0_6px_28px_-12px_rgba(0,0,0,0.35)] p-7 lg:col-span-3 animate-lv"
            style={{ lineHeight: 1.6, letterSpacing: "0.02em", wordSpacing: "0.08em" }}
          >
            <header>
              <h1 className="lv-heading-gradient text-3xl md:text-4xl font-bold tracking-tight">
                Low Vision Mode Dashboard
              </h1>

              <p
                className="mt-2 text-sm md:text-base text-[var(--lv-text-muted)]"
                style={{ fontSize: "1rem", lineHeight: 1.7, letterSpacing: "0.02em" }}
              >
                Enter your glasses power to get a recommended reading preset.
              </p>
            </header>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="h-10 rounded-xl px-5 text-sm md:text-base font-semibold shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)]">
                <Link href="#assessment">Enter Power</Link>
              </Button>
              <Button asChild variant="secondary" className="h-10 rounded-xl px-5 text-sm md:text-base font-medium">
                <Link href="/lowvision/paste">Use Last Preset</Link>
              </Button>
            </div>

            {/* SHORT, SCANNABLE POINTERS (reduced and legible) */}
            <div
              className="lv-assess-box rounded-xl border border-[var(--lv-border-soft)] bg-[var(--lv-bg-subtle)] p-5 animate-lv delay-[90ms]"
              style={{ fontSize: "1rem", lineHeight: 1.8 }}
            >
              <h2 className="lv-subheading">Quick Summary</h2>

              <ul className="lv-bullets" style={{ marginTop: 6 }}>
                <li>Type spherical equivalent in positive diopters (e.g. 2.00).</li>
                <li>Class 0: 0 → +1.5 — small enlargement (+10–15%).</li>
                <li>Class 1: +1.5 → +3.0 — larger (+25–30%), more spacing, mild contrast.</li>
                <li>Class 2: ≥ +3.0 — large (+50%), high contrast, TTS available.</li>
              </ul>

              <div className="lv-label-map" style={{ marginTop: 12, fontSize: "0.98rem", lineHeight: 1.4 }}>
                <strong>Preset:</strong> 1 • 2 • 3
              </div>

              {/* Quick Power Entry inside main box and visually prominent */}
              <div
                id="assessment"
                className="mt-6 rounded-lg border border-[var(--lv-border-soft)] bg-[var(--lv-bg-panel)] p-5"
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div>
                  <h3 className="lv-subheading" style={{ textAlign: "center", fontSize: "0.86rem" }}>
                    Quick Power Entry
                  </h3>
                  <p
                    className="text-[var(--lv-text-muted)]"
                    style={{ textAlign: "center", fontSize: "1rem", marginTop: 6, lineHeight: 1.6 }}
                  >
                    Enter positive diopters (e.g. +2.00).
                  </p>
                </div>

                <div className="flex items-center justify-center gap-5">
                  <div className="flex flex-col gap-1 items-center">
                    <label
                      className="text-[14px] font-semibold uppercase tracking-wider text-[var(--lv-text-base)]"
                      style={{ letterSpacing: "0.06em" }}
                    >
                      Glasses Power (D)
                    </label>
                    <Input
                      inputMode="decimal"
                      value={power}
                      onChange={(e) => setPower(e.target.value)}
                      placeholder="+2.00"
                      className="w-44 text-2xl md:text-3xl py-2 text-center"
                      aria-label="Enter positive diopter power"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    />
                  </div>

                  <Button onClick={analyze} disabled={!canSubmit || analyzing} className="rounded-lg text-base md:text-lg h-12 px-6">
                    {analyzing ? "Analyzing..." : "Analyze"}
                  </Button>
                </div>

                {error && <div className="mt-2 text-base font-medium text-red-400 text-center">{error}</div>}

                {analyzing && (
                  <div className="mt-2 rounded-md border border-[var(--lv-border-soft)] bg-[var(--lv-bg-panel)] p-4 grid gap-3">
                    <div className="mx-auto h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                    <div className="text-center text-[var(--lv-text-muted)]">
                      <div className="font-semibold" style={{ fontSize: "1rem" }}>
                        Computing preset...
                      </div>
                    </div>
                  </div>
                )}

                {resultClass !== null && !analyzing && (
                  <div className="mt-2 rounded-md border border-[var(--lv-border-soft)] bg-[var(--lv-bg-panel)] p-4 grid gap-3">
                    <div className="text-center">
                      <div className="text-lg md:text-xl font-semibold text-[var(--lv-text-base)]">
                        {resultClass === 0
                          ? "Class 0 — Normal / Mild"
                          : resultClass === 1
                          ? "Class 1 — Mild Low Vision"
                          : "Class 2 — Low Vision"}
                      </div>
                      <div className="mt-2 text-[var(--lv-text-muted)]" style={{ fontSize: "1rem", lineHeight: 1.6 }}>
                        {resultClass === 0 &&
                          "0 → +1.5 D: +10–15% size, standard contrast/spacing."}
                        {resultClass === 1 &&
                          "+1.5 → +3.0 D: +25–30% size, increased spacing, mild contrast."}
                        {resultClass === 2 &&
                          "≥ +3.0 D: +50% size, high contrast, increased spacing, TTS."}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 mt-2">
                      <Button asChild variant="outline" className="rounded-lg text-base">
                        <Link href="/lowvision/dashboard">Re-enter</Link>
                      </Button>
                      <Button asChild className="rounded-lg text-base">
                        <Link href="/lowvision/paste">Continue</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>

          {/* Right column with images (narrower to make main panel wider) */}
          <aside className="relative col-span-1 flex flex-col gap-6 lg:col-span-2">
            <div className="lv-image-frame aspect-[4/3] animate-lv delay-[120ms]">
              <div className="relative h-full w-full">
                <Image
                  src="/low-vision-reading-example.jpg"
                  alt="Low vision reading adaptation illustration"
                  fill
                  sizes="(max-width:1024px) 100vw, 40vw"
                  className="lv-image-contained object-contain"
                  priority
                />
              </div>
            </div>

            <div className="lv-image-frame aspect-[16/10] animate-lv delay-[200ms]">
              <div className="relative h-full w-full">
                <Image
                  src="/low vision 1.png"
                  alt="Low vision preset comparison"
                  fill
                  sizes="(max-width:1024px) 100vw, 40vw"
                  className="lv-image-contained object-contain"
                />
              </div>
            </div>

            <p className="text-[11px] text-[var(--lv-text-muted)]" style={{ lineHeight: 1.6 }}>
              Magnification & contrast logic are modular – prototype mapping only.
            </p>
          </aside>
        </div>

        <div className="lv-divider" />

        <footer className="mt-12 text-center text-[11px] tracking-wide text-[var(--lv-text-muted)]">
          Low Vision adaptation prototype – presets & UX patterns subject to refinement.
        </footer>
      </section>
    </main>
  )
}
