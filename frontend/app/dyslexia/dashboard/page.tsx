"use client"

import Image from "next/image"
import Link from "next/link"
import { Header } from "@/components/header"
import { Particles } from "@/components/particles"
import { Button } from "@/components/ui/button"

import "./dyslexia-dashboard.css"

export default function DyslexiaDashboard() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Header variant="dyslexia-dashboard" />

      <div className="absolute inset-0 -z-10">
        <Particles density={0.00075} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_28%,theme(colors.sky.300/.22),transparent_60%),radial-gradient(circle_at_78%_72%,theme(colors.violet.400/.20),transparent_65%)]"
        />
      </div>

      <section className="mx-auto max-w-7xl px-4 pt-10 pb-20 md:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left Panel */}
          <article className="dx-panel col-span-1 flex flex-col gap-6 rounded-3xl border border-[var(--dx-border-card)] bg-[var(--dx-bg-panel)] backdrop-blur-xl shadow-[0_6px_28px_-12px_rgba(0,0,0,0.35)] p-7 lg:col-span-3 animate-dx">
            <header>
              <h1 className="heading-gradient text-3xl md:text-5xl font-bold tracking-tight">
                Dyslexia Mode Dashboard
              </h1>
              <p className="mt-3 text-sm md:text-base leading-relaxed text-[var(--dx-text-muted)]">
                Spacing adjustments, mirror letter cues, and optional TTS. Run a quick 10‑question check or reuse your last preset.
              </p>
            </header>

            <div className="flex flex-wrap gap-4">
              <Button
                asChild
                className="h-11 rounded-xl px-6 text-base font-semibold shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)]"
              >
                <Link href="/dyslexia/quiz">Start Assessment</Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                className="h-11 rounded-xl px-6 text-base font-medium"
              >
                <Link href="/dyslexia/paste">Use Last Preset</Link>
              </Button>
            </div>

            {/* Assessment Model */}
            <div className="dx-model-box rounded-xl border border-[var(--dx-border-soft)] bg-[var(--dx-bg-subtle)] p-5 animate-dx delay-[90ms]">
              <h2 className="dx-subheading">Assessment Model (Simple)</h2>
              <ul className="dx-bullets">
                <li>10 short questions + completion time.</li>
                <li>Answers + time become 6 signals:
                  <ul className="dx-bullets-nested">
                    <li>Word familiarity</li>
                    <li>Memory support</li>
                    <li>Pace (time‑adjusted)</li>
                    <li>Visual clarity</li>
                    <li>Sound distinction</li>
                    <li>Overall difficulty rating</li>
                  </ul>
                </li>
                <li>Random Forest chooses label: 0 (Severe) • 1 (Mild) • 2 (None).</li>
                <li>Label sets spacing & highlight intensity (0 also suggests TTS).</li>
                <li>You can override manually or create one custom preset via AI.</li>
                <li>Browser extension applies preset inline or overlay on any site.</li>
              </ul>
              <div className="dx-label-map">
                <strong>Label Mapping:</strong> 2 Normal • 1 Moderate spacing • 0 Heavy spacing + highlights + TTS suggestion
              </div>
            </div>

            <div className="rounded-xl border border-[var(--dx-border-soft)] bg-[var(--dx-bg-subtle)] p-4 text-xs leading-relaxed text-[var(--dx-text-muted)]">
              <strong className="font-semibold text-[var(--dx-text-base)]">Tip:</strong> If mild still feels hard, switch to heavy spacing or toggle TTS temporarily.
            </div>
          </article>

          {/* Right Images */}
          <aside className="relative col-span-1 flex flex-col gap-6 lg:col-span-2">
            <div
              className="dx-image-frame aspect-[4/3] animate-dx delay-[120ms]"
            >
              <div className="relative h-full w-full">
                <Image
                  src="/dyslexia-head-profile.jpg"
                  alt="Dyslexia conceptual head illustration"
                  fill
                  sizes="(max-width:1024px) 100vw, 40vw"
                  className="dx-image-contained"
                  priority
                />
              </div>
            </div>
            <div
              className="dx-image-frame aspect-[16/10] animate-dx delay-[200ms]"
            >
              <div className="relative h-full w-full">
                <Image
                  src="/ml-assist-brain.jpg"
                  alt="Assistive machine learning visualization"
                  fill
                  sizes="(max-width:1024px) 100vw, 40vw"
                  className="dx-image-contained"
                />
              </div>
            </div>
            <p className="text-[11px] text-[var(--dx-text-muted)]">
              Made by NexVyd
            </p>
          </aside>
        </div>

        {/* Features */}
        <div className="dx-divider" />

        <section>
          <h2 className="heading-gradient text-2xl md:text-3xl font-semibold tracking-tight">
            Core Dyslexia Adaptation Features
          </h2>
          <p className="mt-3 max-w-3xl text-sm md:text-base leading-relaxed text-[var(--dx-text-muted)]">
            Spacing, letter cues, audio, summaries, OCR, monitoring, and one AI‑built preset. Extend everywhere with the browser extension.
          </p>

          <div className="dx-feature-grid">
            {[
              { t: "Adaptive Spacing", d: "Scales letter & line gaps by label." },
              { t: "Mirror Letter Highlight", d: "Optional cues for b/d, p/q, m/w." },
              { t: "Text‑to‑Speech", d: "Listen + read; suggested in severe cases." },
              { t: "Manual Option", d: "You can also adapt the text manually" },
              { t: "OCR", d: "Extract text from images/screenshots." },
              { t: "Monitoring Agent", d: "Prototype suggests tweaks after pauses." },
              { t: "Custom Preset", d: "One stored AI‑refined configuration." },
              { t: "Extension", d: "Apply preset inline or overlay on any site." }
            ].map((f, i) => (
              <div
                key={f.t}
                className="dx-feature-card animate-dx"
                style={{ animationDelay: `${120 + i * 60}ms` }}
              >
                <strong>{f.t}</strong>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="dx-divider" />

        {/* Workflow concise */}
        <section>
          <h2 className="heading-gradient text-xl md:text-2xl font-semibold tracking-tight">
            Quick Workflow
          </h2>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[var(--dx-text-muted)]">
            <li>Take 10‑question check (time captured).</li>
            <li>Label sets baseline spacing & cues.</li>
            <li>Toggle TTS if decoding slows.</li>
            <li>Refine one custom preset with AI.</li>
            <li>Use extension on any site.</li>
            <li>OCR for images; monitoring suggests adjustments.</li>
            <li>Re‑assess when experience changes.</li>
          </ol>
          <div className="mt-6 rounded-xl border border-[var(--dx-border-soft)] bg-[var(--dx-bg-subtle)] p-4 text-[11px] text-[var(--dx-text-muted)]">
            Assistive prototype — not a clinical diagnostic.
          </div>
        </section>

        <footer className="mt-16 text-center text-[11px] tracking-wide text-[var(--dx-text-muted)]">
          Prototype Dyslexia environment – presets & model subject to change.
        </footer>
      </section>
    </main>
  )
}