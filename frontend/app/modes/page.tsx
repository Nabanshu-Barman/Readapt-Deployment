"use client"

import { Header } from "@/components/header"
import { Particles } from "@/components/particles"
import Link from "next/link"
import "./modes-effects.css"

/*
  Developer notes (not shown in UI):
  - Text volume reduced per request (shorter hero, mode descriptions, feature blurbs).
  - No additional bullet/pointer lists were added.
  - Contrast handled via CSS variables in modes-effects.css for light/dark.
  - Kept overall layout + animation timing; simplified shadows & gradients for clarity.
*/

const modes = [
  {
    key: "dyslexia",
    title: "Dyslexia",
    desc: "Spacing + interline tuning, mirror-letter cues (b/d, p/q), optional TTS.",
    img: "/dyslexia-support-book-icon.jpg",
    tags: ["Spacing", "Letters", "TTS"],
    href: "/dyslexia/dashboard"
  },
  {
    key: "adhd",
    title: "ADHD",
    desc: "Chunked flow, word highlight cadence, quick TL;DR context, optional TTS.",
    img: "/adhd-focus-brain-spark.jpg",
    tags: ["Chunking", "Highlight", "TL;DR"],
    href: "/adhd/dashboard"
  },
  {
    key: "low-vision",
    title: "Low Vision",
    desc: "High contrast, scalable type, spacing controls, seamless TTS assist.",
    img: "/eye-icon-accessibility.jpg",
    tags: ["Contrast", "Scale", "TTS"],
    href: "/lowvision/dashboard"
  }
]

const features = [
  { title: "Real‑Time Adaptation", body: "Changes apply instantly as you tweak spacing or scale." },
  { title: "Contrast Profiles", body: "Preset & custom high‑contrast themes." },
  { title: "Gemini Summaries", body: "Compact TL;DR for long or dense text." },
  { title: "Text to Speech", body: "Listen alongside visual reading." },
  { title: "Browser Extension", body: "Inline or overlay mode on any site." },
  { title: "AI Assistant", body: "Refine a single custom text preset." },
  { title: "OCR (Tesseract)", body: "Extract text from images then adapt." },
  { title: "Monitoring Agent", body: "Prototype adjusts when you pause." }
]

export default function ModesPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Header variant="modes" />

      <div className="absolute inset-0 -z-10">
        <Particles density={0.00075} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_28%,theme(colors.sky.300/.22),transparent_60%),radial-gradient(circle_at_78%_72%,theme(colors.violet.400/.20),transparent_65%)]"
        />
      </div>

      <section className="mx-auto max-w-7xl px-4 pt-10 pb-20 md:px-8">
        <header className="max-w-3xl">
          <h1 className="heading-gradient text-3xl md:text-5xl font-bold tracking-tight">
            Choose Your Reading Adaptation Mode
          </h1>
          <p className="mt-3 text-sm md:text-base leading-relaxed text-[var(--c-text-muted)]">
            Pick a profile that fits your current challenge. Switch anytime.
          </p>
        </header>

        <div className="mode-grid mt-10 grid gap-8 md:grid-cols-3">
          {modes.map((m, i) => (
            <Link
              key={m.key}
              href={m.href}
              className="mode-card mode-card-animate focus-visible:ring-2 focus-visible:ring-primary/60"
              style={{ animationDelay: `${(i + 1) * 90}ms` }}
            >
              <div className="mode-img-wrapper">
                <div className="mode-img-frame">
                  <span aria-hidden className="mode-ring" />
                  <img
                    src={m.img}
                    alt={`${m.title} mode illustration`}
                    className="mode-img"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
              <div className="mode-meta">
                <h3>
                  {m.title}
                  <span className="text-[10px] font-medium tracking-wider text-primary/70 bg-primary/10 px-2 py-0.5 rounded-md">
                    Mode
                  </span>
                </h3>
                <p>{m.desc}</p>
                <div className="mode-tags">
                  {m.tags.map(tag => (
                    <span key={tag} className="mode-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="section-divider" />

        <section aria-labelledby="feature-overview">
          <h2
            id="feature-overview"
            className="heading-gradient text-2xl md:text-3xl font-semibold tracking-tight"
          >
            Core Assistive Capabilities
          </h2>
          <p className="mt-3 max-w-3xl text-sm md:text-base leading-relaxed text-[var(--c-text-muted)]">
            Unified adaptive formatting, summaries, audio, and extension support—refined by a single custom preset.
          </p>

          <div className="feature-grid">
            {features.map((f, idx) => (
              <div
                key={f.title}
                className="feature-card"
                style={{ animationDelay: `${(idx + 1) * 70}ms` }}
              >
                <strong>{f.title}</strong>
                <div>{f.body}</div>
              </div>
            ))}
          </div>

          <div className="mode-actions">
            <Link href="/help" className="mode-action-btn">
              Help
            </Link>
          </div>
        </section>

        <div className="section-divider" />

        <section aria-labelledby="guidance-heading" className="max-w-5xl">
          <h2
            id="guidance-heading"
            className="heading-gradient text-xl md:text-2xl font-semibold tracking-tight"
          >
            Picking a Mode
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-3 text-sm leading-relaxed text-[var(--c-text-muted)]">
            <div>
              <h3 className="font-semibold text-primary mb-1">Dyslexia</h3>
              <p>Spacing + letter cues ease reversals; TTS supports decoding.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sky-500 mb-1">ADHD</h3>
              <p>Chunked flow + highlights + fast summaries keep context locked.</p>
            </div>
            <div>
              <h3 className="font-semibold text-violet-500 mb-1">Low Vision</h3>
              <p>Contrast, scale, spacing & TTS combine for clearer viewing.</p>
            </div>
          </div>
        </section>

        <footer className="mt-14 text-center text-[11px] tracking-wide text-[var(--c-text-muted)]">
          Prototype environment – presets evolve.
        </footer>
      </section>
    </main>
  )
}