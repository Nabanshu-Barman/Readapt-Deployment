"use client"

import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Redo2, FileText, Globe, Moon, Sun, Home } from "lucide-react"
import { ProfileMenu } from "@/components/profile-menu"

const Particles = dynamic(() => import("./particles").then(m => m.Particles), {
  ssr: false,
  loading: () => null,
})

const LOGO_WIDTH = 457
const LOGO_HEIGHT = 387
const LOGO_RATIO = LOGO_WIDTH / LOGO_HEIGHT

type Variant =
  | "login"
  | "modes"
  | "dyslexia-dashboard"
  | "quiz"
  | "results"
  | "adaptation"
  | "adhd-dashboard"
  | "adhd-quiz"
  | "adhd-results"
  | "dyslexia-adapt"
  | "lowvision-dashboard" // added lowvision variant

export function Header({ variant, timer }: { variant: Variant; timer?: string }) {
  const { theme, setTheme } = useTheme()
  const [shrink, setShrink] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const onScroll = () => setShrink(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // React to route changes using App Router
  const pathname = usePathname()
  const normalizedPath = (pathname || "/").replace(/\/+$/, "") || "/"

  const isDyslexiaPastePage = normalizedPath === "/dyslexia/paste"
  const isAdhdPastePage = normalizedPath === "/adhd/paste"
  const isLowVisionPastePage = normalizedPath === "/lowvision/paste"

  // Choose paste target based on current section
  const pasteTarget =
    normalizedPath.startsWith("/lowvision")
      ? "/lowvision/paste"
      : normalizedPath.startsWith("/adhd")
      ? "/adhd/paste"
      : "/dyslexia/paste"

  const showBrandText = variant !== "login"

  const ThemeToggle = () =>
    mounted ? (
      <Button
        variant="outline"
        size="icon"
        aria-label="Toggle theme"
        className="relative overflow-hidden"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    ) : (
      <div className="h-9 w-9 rounded-md border border-border/50 animate-pulse bg-muted/40" aria-hidden="true" />
    )

  return (
    <header className={["sticky top-0 z-50 transition-all duration-500", shrink ? "backdrop-blur-md" : "backdrop-blur-xl"].join(" ")}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/60 via-background/40 to-background/70" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className={["mx-auto max-w-7xl px-4 md:px-6", shrink ? "py-2" : "py-3", "transition-[padding] duration-500"].join(" ")}>
        <div
          className={[
            "relative rounded-2xl border border-white/10",
            "bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-white/5 dark:via-white/5 dark:to-transparent",
            "shadow-[0_4px_28px_-10px_rgba(0,0,0,0.45)]",
            shrink ? "px-4 py-2" : "px-5 py-3",
            "transition-all duration-500",
          ].join(" ")}
        >
          {mounted && <Particles className="pointer-events-none absolute inset-0 rounded-2xl opacity-35" density={0.00028} />}

          <div className="relative z-10 flex items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <Link href={variant === "login" ? "/" : "/modes"} aria-label="Readapt Home" className="group flex items-center gap-3">
                <div
                  className={[
                    "relative flex items-center justify-center overflow-hidden",
                    "rounded-2xl ring-1 ring-white/15",
                    "bg-gradient-to-br from-primary/70 via-sky-500/60 to-violet-500/60",
                    "shadow-inner shadow-primary/30 transition-all duration-500",
                    "group-hover:shadow-primary/40 group-hover:brightness-105",
                    shrink ? "h-11" : "h-12",
                  ].join(" ")}
                  style={{ aspectRatio: LOGO_RATIO.toString() }}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_28%,rgba(255,255,255,0.35),transparent_60%)] opacity-50 mix-blend-overlay" />
                  <Image
                    src="/images/logo.png"
                    alt="Readapt Logo"
                    width={LOGO_WIDTH}
                    height={LOGO_HEIGHT}
                    priority
                    sizes="(max-width:640px) 120px, 160px"
                    className="h-full w-full object-contain rounded-2xl"
                  />
                </div>
                {showBrandText && (
                  <span
                    className={[
                      "select-none font-semibold tracking-wide",
                      "bg-gradient-to-r from-primary via-sky-400 to-violet-400 bg-clip-text text-transparent",
                      "transition-all duration-500",
                      shrink ? "text-base" : "text-lg",
                    ].join(" ")}
                  >
                    READAPT
                  </span>
                )}
              </Link>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3 md:gap-4">
              {variant === "login" && <p className="hidden text-sm text-muted-foreground md:block">“Adapting the way you read, just for you.”</p>}

              {variant === "modes" && (
                <nav className="flex items-center gap-2 md:gap-3">
                  <Link
                    href="/help"
                    className="text-xs font-medium uppercase tracking-wider rounded-md px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    Help
                  </Link>
                  <ProfileMenu />
                </nav>
              )}

              {variant === "dyslexia-dashboard" && (
                <>
                  <div className="hidden md:block">
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>
                          <BreadcrumbLink asChild>
                            <Link href="/modes">Modes</Link>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbLink asChild>
                            <Link href="/dyslexia/dashboard">Dyslexia</Link>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbPage>Dashboard</BreadcrumbPage>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                  <ProfileMenu />
                </>
              )}

              {variant === "lowvision-dashboard" && (
                <>
                  <div className="hidden md:block">
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>
                          <BreadcrumbLink asChild>
                            <Link href="/modes">Modes</Link>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbLink asChild>
                            <Link href="/lowvision/dashboard">Low Vision</Link>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbPage>Dashboard</BreadcrumbPage>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                  <ProfileMenu />
                </>
              )}

              {variant === "quiz" && (
                <h2 className="relative text-sm font-medium md:text-base">
                  Dyslexia Assessment
                  <span className="absolute -bottom-1 left-0 block h-0.5 w-full animate-pulse rounded bg-primary/60" />
                </h2>
              )}

              {variant === "results" && (
                <div className="hidden items-center gap-2 md:flex">
                  <Button asChild variant="outline" className="gap-2 bg-transparent hover:bg-primary/10">
                    {/* Fix: redo button on lowvision results goes to lowvision/dashboard instead of dyslexia/quiz */}
                    {normalizedPath.startsWith("/lowvision")
                      ? (
                        <Link href="/lowvision/dashboard">
                          <Redo2 className="h-4 w-4" /> Redo
                        </Link>
                      )
                      : (
                        <Link href="/dyslexia/quiz">
                          <Redo2 className="h-4 w-4" /> Redo
                        </Link>
                      )
                    }
                  </Button>
                  {/* Hide Paste on dyslexia/paste, adhd/paste, and lowvision/paste */}
                  {!isDyslexiaPastePage && !isAdhdPastePage && !isLowVisionPastePage && (
                    <Button
                      asChild
                      variant="default"
                      className="gap-2 bg-gradient-to-r from-primary via-sky-500 to-violet-500 text-white shadow"
                    >
                      <Link href={pasteTarget}>
                        <FileText className="h-4 w-4" /> Paste
                      </Link>
                    </Button>
                  )}
                  <ProfileMenu />
                </div>
              )}

              {variant === "adaptation" && (
                <div className="hidden items-center gap-2 md:flex">
                  <Button asChild variant="outline" className="gap-2 bg-transparent hover:bg-primary/10">
                    <Link href="/dyslexia/paste">
                      <FileText className="h-4 w-4" /> Back
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="gap-2 hover:bg-primary/20">
                    <Link href="#">
                      <Globe className="h-4 w-4" /> Adapt Site
                    </Link>
                  </Button>
                  <ProfileMenu />
                </div>
              )}

              {variant === "adhd-dashboard" && (
                <>
                  <div className="hidden md:block">
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>
                          <BreadcrumbLink asChild>
                            <Link href="/modes">Modes</Link>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbList>
                          <BreadcrumbItem>
                            <BreadcrumbPage>ADHD</BreadcrumbPage>
                          </BreadcrumbItem>
                        </BreadcrumbList>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                  <ProfileMenu />
                </>
              )}

              {variant === "adhd-quiz" && (
                <h2 className="relative text-sm font-medium md:text-base">
                  ADHD Assessment
                  <span className="absolute -bottom-1 left-0 block h-0.5 w-full animate-pulse rounded bg-primary/60" />
                </h2>
              )}

              {variant === "adhd-results" && (
                <div className="hidden items-center gap-2 md:flex">
                  <Button asChild variant="outline" className="gap-2 bg-transparent hover:bg-primary/10">
                    <Link href="/adhd/quiz">
                      <Redo2 className="h-4 w-4" /> Redo
                    </Link>
                  </Button>
                  {/* Paste button hidden when on /adhd/paste */}
                  {!isAdhdPastePage && (
                    <Button
                      asChild
                      variant="default"
                      className="gap-2 bg-gradient-to-r from-primary via-sky-500 to-violet-500 text-white shadow"
                    >
                      <Link href="/adhd/paste">
                        <FileText className="h-4 w-4" /> Paste
                      </Link>
                    </Button>
                  )}
                  <ProfileMenu />
                </div>
              )}

              {variant === "dyslexia-adapt" && (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    aria-label="Go to Dyslexia Dashboard"
                    className="hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <Link href="/dyslexia/dashboard">
                      <Home className="h-5 w-5" />
                    </Link>
                  </Button>
                  <ProfileMenu />
                </>
              )}

              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
