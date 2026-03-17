"use client"

import { Header } from "@/components/header"
import { Particles } from "@/components/particles"
import Link from "next/link"

export default function HelpPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Header variant="login" />

      {/* Background layer */}
      <div className="absolute inset-0 -z-10">
        <Particles density={0.0009} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_30%,theme(colors.sky.300/.25),transparent_60%),radial-gradient(circle_at_80%_70%,theme(colors.violet.400/.22),transparent_65%)]"
        />
      </div>

      <section className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <div className="glass rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md shadow-[0_8px_40px_-12px_rgba(0,0,0,0.45)] md:p-10">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-primary via-sky-500 to-violet-500 bg-clip-text text-transparent">
            Help & Guide
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-prose">
            Readapt dynamically adjusts text presentation to support readers with dyslexia, ADHD, or low vision—now with a functional browser extension and AI-powered tools.
          </p>

          <div className="mt-8 space-y-10">
            {/* Quick Start */}
            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                Quick Start
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                <li>Go to the <Link href="/login" className="underline hover:text-primary">Login</Link> page.</li>
                <li>Enter any username and password (prototype flow).</li>
                <li>After signing in your username appears in personalized areas.</li>
                <li>Open reading modes to see live adaptation.</li>
              </ol>
            </section>

            {/* What the App Adapts */}
            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                What the App Adapts
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                <li><strong>Font & Spacing:</strong> Reduces visual crowding for easier scanning.</li>
                <li><strong>Line Focus / Highlighting:</strong> Helps maintain position and attention.</li>
                <li><strong>Chunking of Text:</strong> Breaks words/phrases into digestible units.</li>
                <li><strong>Contrast Modes:</strong> Enhances readability for low vision or sensitivity.</li>
                <li><strong>Gemini-powered TL;DR & Text-to-Speech:</strong> Summarize long passages instantly and listen to content aloud.</li>
              </ul>
            </section>

            {/* Browser Extension */}
            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
                Browser Extension
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The Readapt browser extension is fully functional. Use it to adapt any webpage in real time:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                <li><strong>Overlay Mode:</strong> Non-destructive reading layer with focus tools.</li>
                <li><strong>Inline Mode:</strong> Directly transforms the page’s typography and spacing.</li>
                <li><strong>Instant Profile Sync:</strong> Applies your preferred contrast, fonts, and spacing.</li>
                <li><strong>Live Highlight Tools:</strong> Line, word, or phrase emphasis while you scroll.</li>
              </ul>
            </section>

            {/* AI Assistance */}
            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                AI Assistance
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A built-in chat agent helps you generate simplified or custom target text for study, accessibility, or focus contexts:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                <li>Ask for simplified rewrites or graded reading levels.</li>
                <li>Generate focus summaries or vocabulary lists.</li>
                <li>Use Gemini TL;DR summarization for dense material.</li>
                <li>Trigger Text-to-Speech to hear adapted content immediately.</li>
              </ul>
            </section>

            {/* Navigation + Reading Assessment CTA */}
            <section className="pt-2">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Test the extension</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Want to measure how Readapt improves comprehension? Try our reading comprehension assessment — open it in a new tab and run the test while the extension is active.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  <Link
                    href="https://readapt-assessment.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-transparent bg-primary px-4 py-2 text-white transition hover:bg-primary/90"
                  >
                    Open Reading Comprehension Test
                  </Link>

                  <Link
                    href="/login"
                    className="rounded-md border border-white/10 bg-white/5 px-4 py-2 transition hover:bg-white/10"
                  >
                    Back to Login
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-md border border-white/10 bg-white/5 px-4 py-2 transition hover:bg-white/10"
                  >
                    Create an Account
                  </Link>
                </div>
              </div>
            </section>
          </div>

          <p className="mt-10 text-center text-[11px] tracking-wide text-muted-foreground/70">
            Prototype build — features may evolve.
          </p>
        </div>
      </section>
    </main>
  )
}
