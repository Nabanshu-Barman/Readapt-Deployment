"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { User, ChevronDown, CheckCircle2, CircleSlash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import clsx from "clsx"

export interface ProfileData {
  username: string
  joined: string
  latestDisorder?: {
    type: string
    severity: string
    assessedAt: string
  }
  customPreset?: {
    exists: boolean
    updatedAt?: string
  }
}

// Mock user placeholder
const mockUser: ProfileData = {
  username: "demoUser",
  joined: "2025-09-15",
  latestDisorder: {
    type: "Dyslexia",
    severity: "Moderate",
    assessedAt: "2025-10-01",
  },
  customPreset: {
    exists: true,
    updatedAt: "2025-10-02",
  },
}

interface ProfileMenuProps {
  user?: ProfileData
  align?: "left" | "right"
}

export function ProfileMenu({ user = mockUser, align = "right" }: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        close()
      }
    }
    window.addEventListener("mousedown", handler)
    return () => window.removeEventListener("mousedown", handler)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close()
        btnRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, close])

  useEffect(() => {
    if (open && menuRef.current) {
      const first = menuRef.current.querySelector<HTMLElement>("[data-autofocus]")
      first?.focus()
    }
  }, [open])

  const disorder = user.latestDisorder
  const preset = user.customPreset
  const dateJoined = new Date(user.joined).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return (
    <div className="relative">
      <Button
        ref={btnRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User profile menu"
        onClick={() => setOpen(o => !o)}
        className={clsx(
          "relative flex items-center justify-center rounded-xl",
          "hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60",
          "transition-colors"
        )}
      >
        <User className="h-5 w-5" />
        <ChevronDown
          className={clsx(
            "absolute -right-4 top-1/2 h-3 w-3 -translate-y-1/2 transition-transform text-muted-foreground/70",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </Button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Profile"
          className={clsx(
            "absolute z-50 mt-2 w-64 rounded-2xl border border-white/10 p-4",
            "bg-background shadow-[0_10px_28px_-10px_rgba(0,0,0,0.6)]", // fully opaque now
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {/* Header */}
          <div className="mb-3 flex items-center gap-3">
            <div
              className={clsx(
                "flex h-11 w-11 items-center justify-center rounded-xl",
                "bg-gradient-to-br from-primary/70 via-sky-500/60 to-violet-500/60",
                "ring-1 ring-white/15 shadow-inner"
              )}
            >
              <User className="h-5 w-5 text-white drop-shadow" />
            </div>
            <div className="min-w-0">
              <p
                className="truncate font-semibold tracking-wide text-sm"
                data-autofocus
                tabIndex={0}
              >
                {user.username}
              </p>
              <p className="text-[11px] text-muted-foreground/70">Joined {dateJoined}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs leading-relaxed">
            {/* Disorder */}
            <div>
              <h4 className="mb-1 font-medium tracking-wide text-[10px] uppercase text-primary/80">
                Latest Assessment
              </h4>
              {disorder ? (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[12px] font-medium">
                    {disorder.type}{" "}
                    <span className="ml-2 rounded-md bg-primary/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                      {disorder.severity}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                    {new Date(disorder.assessedAt).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-white/15 px-3 py-2 text-muted-foreground/70">
                  No assessments yet.
                </p>
              )}
            </div>

            {/* Custom preset simplified */}
            <div>
              <h4 className="mb-1 font-medium tracking-wide text-[10px] uppercase text-primary/80">
                Custom Text Preset
              </h4>
              {preset?.exists ? (
                <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium">Preset Available</p>
                    {preset.updatedAt && (
                      <p className="text-[10px] text-muted-foreground/70">
                        Updated {new Date(preset.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-dashed border-white/15 px-3 py-2">
                  <CircleSlash2 className="mt-0.5 h-4 w-4 text-muted-foreground/60 shrink-0" />
                  <p className="text-[11px] text-muted-foreground/70">
                    No custom preset yet.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sign Out only */}
          <div className="mt-3">
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-center text-xs font-medium tracking-wide uppercase text-muted-foreground/80 hover:bg-white/10 hover:text-foreground transition-colors"
              onClick={() => {
                alert("Sign out placeholder")
                close()
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}