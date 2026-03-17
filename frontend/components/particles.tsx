"use client"
import { useEffect, useRef } from "react"

export function Particles({ className = "", density = 0.001 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let frameId = 0
    const pr = Math.max(1, window.devicePixelRatio || 1)
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const resize = () => {
      canvas.width = canvas.clientWidth * pr
      canvas.height = canvas.clientHeight * pr
    }
    const rand = (min: number, max: number) => Math.random() * (max - min) + min

    let particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = []

    const init = () => {
      particles = []
      const count = Math.floor(canvas.width * canvas.height * density * (prefersReduced ? 0.4 : 1))
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: rand(-0.18, 0.18),
          vy: rand(-0.18, 0.18),
          r: rand(3.5, 7.5) * pr,
          a: rand(0.06, 0.18),
        })
      }
    }

    const tick = () => {
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.filter = "blur(0.3px)"
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        ctx.globalAlpha = p.a
        ctx.fillStyle = "oklch(75% 0.08 200)"
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = "oklch(85% 0.12 80)"
        ctx.globalAlpha = p.a * 0.35
        ctx.fillRect(p.x + 1.5, p.y + 1.5, 1, 1)
      })
      ctx.restore()
      frameId = requestAnimationFrame(tick)
    }

    const onResize = () => {
      resize()
      init()
    }

    resize()
    init()
    tick()
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener("resize", onResize)
    }
  }, [density])

  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden />
}
