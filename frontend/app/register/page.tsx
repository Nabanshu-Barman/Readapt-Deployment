"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/header"
import { Particles } from "@/components/particles"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Prototype: skip real validation
    setTimeout(() => {
      router.push("/modes")
    }, 500)
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Header variant="login" />

      {/* Subtle animated background (reuse Particles for consistency) */}
      <div className="absolute inset-0 -z-10">
        <Particles density={0.0009} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_28%,theme(colors.sky.300/.28),transparent_60%),radial-gradient(circle_at_78%_70%,theme(colors.violet.400/.22),transparent_62%)]"
        />
      </div>

      <section className="mx-auto mt-10 max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md shadow-[0_8px_40px_-12px_rgba(0,0,0,0.45)] md:mt-14 md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fast prototype signup — no email needed.
        </p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-5">
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
                  placeholder="••••••••"
                  autoComplete="new-password"
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

          <Button
            type="submit"
            disabled={loading}
            className="h-11 text-base font-medium bg-gradient-to-r from-primary via-sky-500 to-violet-500 text-white shadow-lg shadow-primary/30 hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Registering…" : "Register"}
          </Button>

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-2 hover:text-primary">
              Sign in
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}