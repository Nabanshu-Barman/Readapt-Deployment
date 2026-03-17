"use client"

import { useRouter } from "next/navigation"
import React, { useState, useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Particles } from "@/components/particles"
import { Header } from "@/components/header"
import Image from "next/image"
import Link from "next/link"

import "./login-effects.css"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [mounted, setMounted] = useState(false)
  const logoRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => setMounted(true), [])

  // Pointer parallax (kept)
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mql.matches) return
    const handler = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window
      const x = e.clientX / innerWidth - 0.5
      const y = e.clientY / innerHeight - 0.5
      const rot = 6
      if (logoRef.current) {
        logoRef.current.style.transform =
          `translate3d(${x * 14}px, ${y * 14}px,0) rotateX(${-y * rot}deg) rotateY(${x * rot}deg)`
      }
      if (cardRef.current) {
        cardRef.current.style.transform = `translate3d(${x * 10}px, ${y * 8}px,0)`
      }
    }
    window.addEventListener("pointermove", handler, { passive: true })
    return () => window.removeEventListener("pointermove", handler)
  }, [])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      router.push("/modes")
    }, 500)
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Header variant="login" />

      {/* Layered backgrounds */}
      <div className="absolute inset-0 -z-20">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none animate-fade-in bg-[radial-gradient(circle_at_28%_30%,theme(colors.sky.300/.32),transparent_60%),radial-gradient(circle_at_80%_70%,theme(colors.violet.400/.25),transparent_65%)]"
        />
        <div aria-hidden className="grad-orb-layer pointer-events-none" />
      </div>

      <div className="absolute inset-0 -z-10 mix-blend-plus-lighter">
        <Particles density={0.0009} />
        {mounted && <Particles density={0.00025} className="absolute inset-0 opacity-60" />}
      </div>

      <section className="relative mx-auto max-w-6xl px-4 pt-8 md:px-6 md:pt-12">
        <div
          ref={cardRef}
          className="login-shell relative grid overflow-hidden rounded-3xl border border-white/10 p-6 shadow-[0_8px_40px_-10px_rgba(0,0,0,0.35)] glass md:grid-cols-2 md:p-10 animate-card-in"
        >
          <div aria-hidden className="sheen pointer-events-none" />
          <Particles className="rounded-3xl opacity-40" density={0.0005} />

          {/* Brand / Left Panel */}
          <div className="relative z-10 flex animate-slide-up flex-col items-center justify-center gap-5 text-center md:items-start md:gap-7 md:text-left">
            <div
              ref={logoRef}
              className="logo-frame relative grid h-[210px] w-[210px] place-items-center will-change-transform group"
            >
              <Image
                src="/images/logo.png"
                width={200}
                height={200}
                alt="Readapt logo"
                priority
                className="rounded-[28%] bg-white/5 saturate-[1.15] shadow-xl ring-4 ring-primary/55 backdrop-blur-sm transition-all duration-500 group-hover:rotate-3 group-hover:saturate-[1.3]"
              />
              <span aria-hidden className="logo-aura" />
            </div>

            <div className="space-y-2">
              <h1 className="bg-gradient-to-br from-primary via-sky-500 to-violet-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent drop-shadow-sm">
                READAPT
              </h1>
              <p className="mx-auto max-w-sm leading-relaxed text-muted-foreground text-sm md:mx-0 md:text-base">
                <span className="font-medium text-foreground/90">“Adapting the way you read, just for you.”</span>
                <br />
                {/* Visibility adjustment: removed low opacity & ensured dual-mode contrast */}
                <span className="text-xs text-foreground/75 dark:text-foreground/80 tracking-wide">
                  Accessibility • Personalization • Neurodiversity support
                </span>
              </p>
            </div>

            {/* Two images only, no frame, full image visible, rounded corners */}
            <div className="mt-2 grid w-full max-w-md grid-cols-2 gap-4">
              {[
                { alt: "Child reading", src: "/child-reading-book.jpg" },
                { alt: "Neural visualization", src: "/brain-visualization.jpg" }
              ].map((im, i) => (
                <div
                  key={im.alt}
                  className="relative h-36 w-full"
                  style={{ animation: `fadePop 0.7s ease ${(i + 1) * 140}ms both` }}
                >
                  <img
                    src={im.src}
                    alt={im.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full rounded-xl object-contain"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Form / Right Panel */}
          <form
            onSubmit={onSubmit}
            className="glass-secondary relative z-10 grid gap-5 rounded-2xl border border-white/10 p-6 backdrop-blur-md md:p-8 animate-slide-up delay-[90ms]"
            aria-labelledby="login-heading"
          >
            <div className="abs-glow" aria-hidden />
            <h2 id="login-heading" className="flex items-center gap-2 text-xl font-semibold">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              Welcome back
            </h2>

            <div className="space-y-1">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="username"
                name="username"
                required
                placeholder="yourname"
                autoComplete="username"
                className="h-11 focus-visible:ring-2 focus-visible:ring-primary/60"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-11 pr-16 focus-visible:ring-2 focus-visible:ring-primary/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute inset-y-0 right-1 rounded-md border border-white/10 bg-white/5 px-3 text-xs font-medium backdrop-blur-sm transition hover:bg-white/10"
                  aria-pressed={showPw}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="text-right text-xs">
              <Link href="/help" className="underline decoration-dotted transition-colors hover:text-primary">
                Forgot?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 text-base font-medium bg-gradient-to-r from-primary via-sky-500 to-violet-500 text-white shadow-lg shadow-primary/30 hover:opacity-90 transition disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>

            {/* Visibility adjustment: stronger contrast vs muted-foreground */}
            <div className="pt-2 text-sm text-foreground/70 dark:text-foreground/75">
              <p>
                No account?{" "}
                <Link className="underline hover:text-primary" href="/register">
                  Register
                </Link>
              </p>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}