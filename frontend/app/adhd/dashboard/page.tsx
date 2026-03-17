"use client"

import Image from "next/image"
import Link from "next/link"
import { Header } from "@/components/header"
import { Particles } from "@/components/particles"
import { Button } from "@/components/ui/button"

import "./adhd-dashboard.css"


export default function ADHDDashboard() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Header variant="adhd-dashboard" />

      <div className="absolute inset-0 -z-10">
        <Particles density={0.00075} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_30%,theme(colors.amber.300/.20),transparent_60%),radial-gradient(circle_at_78%_72%,theme(colors.fuchsia.400/.22),transparent_65%)]"
        />
      </div>

      <section className="mx-auto max-w-7xl px-4 pt-10 pb-20 md:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left Panel */}
          <article className="adhd-panel col-span-1 flex flex-col gap-6 rounded-3xl border border-[var(--adhd-border-card)] bg-[var(--adhd-bg-panel)] backdrop-blur-xl shadow-[0_6px_28px_-12px_rgba(0,0,0,0.35)] p-7 lg:col-span-3 animate-adhd">
            <header>
              <h1 className="heading-gradient-adhd text-3xl md:text-5xl font-bold tracking-tight">
                ADHD Mode Dashboard
              </h1>
              <p className="mt-3 text-sm md:text-base leading-relaxed text-[var(--adhd-text-muted)]">
                Attention variability & questionnaire fusion. Gaze stability heuristic + 10 inattention / hyperactivity prompts to tune highlighting, sentence chunking, TL;DR, and support tools. Reuse your last preset or reassess anytime.
              </p>
            </header>

            <div className="flex flex-wrap gap-4">
              <Button
                asChild
                className="h-11 rounded-xl px-6 text-base font-semibold shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)]"
              >
                <Link href="/adhd/quiz">Start Assessment</Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                className="h-11 rounded-xl px-6 text-base font-medium"
              >
                <Link href="/adhd/paste">Use Last Preset</Link>
              </Button>
            </div>

            <div className="adhd-model-box rounded-xl border border-[var(--adhd-border-soft)] bg-[var(--adhd-bg-subtle)] p-5 animate-adhd delay-[90ms]">
              <h2 className="adhd-subheading">Assessment Model (Prototype)</h2>
              <ul className="adhd-bullets">
                <li>10 survey items:
                  <ul className="adhd-bullets-nested">
                    <li>5 Inattention indicators</li>
                    <li>5 Hyperactivity / Impulsivity indicators</li>
                  </ul>
                </li>
                <li>Webcam video (consent) → sampled frames → 3D gaze (ResNet18 Gaze360 weights).</li>
                <li>Classification logits → continuous angles (discretized bins + expectation).</li>
                <li>Temporal gaze variability metric computed (heuristic threshold 0.229 rad ≈ 13.1°).</li>
                <li>Survey pattern + variability → class:
                  <ul className="adhd-bullets-nested">
                    <li>0: No ADHD</li>
                    <li>1: Inattentive</li>
                    <li>2: Hyperactive‑Impulsive</li>
                    <li>3: Combined</li>
                  </ul>
                </li>
                <li>Class → preset controlling word highlight cadence, sentence chunking, TL;DR, TTS.</li>
                <li>Non‑diagnostic; future calibration & richer metrics planned.</li>
              </ul>
              <div className="adhd-label-map">
                <strong>Preset Mapping:</strong> 1 Normal • 2 Highlight 3rd word • 3 Chunk + highlight + TL;DR • 4 + TTS + structural emphasis
              </div>
            </div>

            <div className="rounded-xl border border-[var(--adhd-border-soft)] bg-[var(--adhd-bg-subtle)] p-4 text-xs leading-relaxed text-[var(--adhd-text-muted)]">
              <strong className="font-semibold text-[var(--adhd-text-base)]">Note:</strong> Gaze variability is a heuristic; head motion or lighting can inflate it. Re-run or calibrate later.
            </div>
          </article>

          {/* Right Images (updated to two provided images) */}
          <aside className="relative col-span-1 flex flex-col gap-6 lg:col-span-2">
            <div className="adhd-image-frame aspect-[4/3] animate-adhd delay-[120ms]">
              <div className="relative h-full w-full">
                <Image
                  src="/adhd%201.png"
                  alt="ADHD concept illustration 1"
                  fill
                  sizes="(max-width:1024px) 100vw, 40vw"
                  className="adhd-image-contained object-contain"
                  priority
                />
              </div>
            </div>
            <div className="adhd-image-frame aspect-[16/10] animate-adhd delay-[200ms]">
              <div className="relative h-full w-full">
                <Image
                  src="/adhd%202.png"
                  alt="ADHD concept illustration 2"
                  fill
                  sizes="(max-width:1024px) 100vw, 40vw"
                  className="adhd-image-contained object-contain"
                />
              </div>
            </div>
            <p className="text-[11px] text-[var(--adhd-text-muted)]">
              Gaze weights courtesy of Valikhujaev (MobileGaze ResNet18, Gaze360) – integrated with transparent heuristics.
            </p>
          </aside>
        </div>

        <div className="adhd-divider" />

        {/* Features */}
        <section>
          <h2 className="heading-gradient-adhd text-2xl md:text-3xl font-semibold tracking-tight">
            Core ADHD Adaptation Features
          </h2>
          <p className="mt-3 max-w-3xl text-sm md:text-base leading-relaxed text-[var(--adhd-text-muted)]">
            Focus aids: periodic word highlighting, sentence chunking, TL;DR summaries, TTS, gaze variability heuristic, survey fusion, OCR, custom preset, monitoring agent, and extension-wide application.
          </p>

          <div className="adhd-feature-grid">
            {[
              { t: "Highlight Cadence", d: "Every 3rd word (class ≥ 1) directs focal shifts." },
              { t: "Sentence Chunking", d: "Extra spacing at higher presets for pacing." },
              { t: "TL;DR Summaries", d: "Optional quick context (preset ≥ 3)." },
              { t: "TTS Integration", d: "Preset 4 enables co‑reading audio." },
              { t: "Gaze Variability", d: "Temporal angular dispersion heuristic (0.229 rad)." },
              { t: "Survey Fusion", d: "Inattention + hyperactive items guide class." },
              { t: "Custom Preset", d: "AI‑refined single stored configuration." },
              { t: "Browser Extension", d: "Applies adaptation across any site." },
              { t: "Monitoring Agent", d: "Inactivity prompts adjustments." },
              { t: "OCR Pipeline", d: "Extracts text for adaptation." },
              { t: "Transparency", d: "Open attribution & honest limits." },
              { t: "Extensible Core", d: "Add saccades, entropy, fixations next." },
            ].map((f, i) => (
              <div
                key={f.t}
                className="adhd-feature-card animate-adhd"
                style={{ animationDelay: `${120 + i * 55}ms` }}
              >
                <strong>{f.t}</strong>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="adhd-divider" />

        {/* Workflow */}
        <section>
          <h2 className="heading-gradient-adhd text-xl md:text-2xl font-semibold tracking-tight">
            Quick Workflow
          </h2>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[var(--adhd-text-muted)]">
            <li>Record webcam snippet + answer 10 survey items.</li>
            <li>Gaze angles extracted → variability metric.</li>
            <li>Survey + variability → class (0–3) → preset (1–4).</li>
            <li>Preset activates highlighting / chunking / TL;DR / TTS.</li>
            <li>Refine with custom preset if needed.</li>
            <li>Extension applies adaptation across sites.</li>
            <li>Reassess when focus patterns significantly change.</li>
          </ol>
          <div className="mt-6 rounded-xl border border-[var(--adhd-border-soft)] bg-[var(--adhd-bg-subtle)] p-4 text-[11px] text-[var(--adhd-text-muted)]">
            Assistive prototype — not a clinical diagnostic. Variability threshold illustrative; calibration planned.
          </div>
        </section>

        <div className="adhd-divider" />

        {/* Attribution / Integrity */}
        <section className="adhd-attribution-grid">
          <div className="adhd-attrib-card animate-adhd">
            <h3>Model Provenance</h3>
            <p>
              Fine‑tuned ResNet18 (MobileGaze) on Gaze360 (restricted). We integrate + attribute; no retrain claim.
            </p>
          </div>
          <div className="adhd-attrib-card animate-adhd delay-[90ms]">
            <h3>Your Added Value</h3>
            <ul>
              <li>Temporal variability engineering</li>
              <li>Survey fusion layer</li>
              <li>Unified multimodal backend</li>
              <li>Extension & preset orchestration</li>
              <li>Transparent framing</li>
            </ul>
          </div>
          <div className="adhd-attrib-card animate-adhd delay-[160ms]">
            <h3>Future Roadmap</h3>
            <ul>
              <li>Threshold calibration</li>
              <li>Saccade / fixation metrics</li>
              <li>Entropy & stability bands</li>
              <li>Confidence scoring</li>
              <li>Ethical reporting layer</li>
            </ul>
          </div>
        </section>

        <footer className="mt-16 text-center text-[11px] tracking-wide text-[var(--adhd-text-muted)]">
          ADHD focus adaptation prototype – presets & heuristics subject to refinement.
        </footer>
      </section>
    </main>
  )
}
