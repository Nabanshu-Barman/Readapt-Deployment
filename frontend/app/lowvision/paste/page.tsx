"use client"

import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { useRef, useState } from "react"

function getBackendBaseUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
}

const sampleText = `Stars are luminous, giant spheres of hot plasma—primarily hydrogen and helium—that generate their own energy through nuclear fusion in their cores, a process that powers them for millions to billions of years and makes them the primary sources of light and heat in the universe. They are born from vast clouds of gas and dust that collapse under gravity, and their properties vary widely in size, mass, temperature, and luminosity, shaping the diversity of stellar types such as red dwarfs, massive blue stars, and white dwarfs. The Sun, our closest star, sustains life on Earth by providing energy, and like all stars, it follows a life cycle in which it will eventually exhaust its nuclear fuel, expand into a red giant, and later shed its outer layers, leaving behind a dense white dwarf core. Some stars, particularly the most massive ones, end their lives in cataclysmic explosions called supernovae, which scatter heavy elements into space and can collapse into neutron stars or black holes. A black hole is an extraordinary region of space where matter is compressed so densely that its gravitational pull becomes so strong even light cannot escape once it crosses the event horizon, effectively making the black hole invisible except through its gravitational influence on surrounding matter. They form from the collapse of massive stars and exist in different scales, from stellar-mass black holes to supermassive black holes that reside at the centers of galaxies, including the Milky Way. These enigmatic objects warp spacetime itself, consume nearby gas and dust, and power energetic phenomena such as quasars, making their study crucial for understanding cosmic evolution. In contrast, a white hole is a purely theoretical concept described by general relativity as the opposite of a black hole, where matter, light, and energy can only flow outward, with nothing ever entering it. Though no evidence of white holes has been observed, they are often speculated about in physics as potential counterparts to black holes, sometimes imagined as connected through wormholes that could bridge distant regions of space and time, or even as hypothetical endpoints of black hole evaporation through Hawking radiation. While black holes are accepted as real, observable cosmic entities, white holes remain in the realm of theory, yet their study fuels profound questions about the nature of spacetime, the limits of physics, and the ultimate fate of the universe.`;

export default function LowVisionPastePage() {
  const [text, setText] = useState("")
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const useSample = () => setText(sampleText)

  const proceed = () => {
    localStorage.setItem("readapt:text", text)
    localStorage.setItem("readapt:lastMode", "lowvision")

    // ensure preset exists (from dashboard) or default to 1
    const preset = Math.max(1, Math.min(3, Number(localStorage.getItem("readapt:lowvisionPreset") || "1")))
    localStorage.setItem("readapt:lowvisionPreset", String(preset))

    window.location.href = "/lowvision/adapt"
  }

  const handleOcrFile = async (file?: File) => {
    if (!file) return
    setOcrBusy(true)
    setOcrProgress(0)
    try {
      const formData = new FormData()
      formData.append("image", file)
      const backend = getBackendBaseUrl()
      const res = await fetch(`${backend}/api/ocr`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.text) {
        setText((prev) => (prev ? `${prev}\n\n${data.text}` : data.text))
      } else {
        alert(data.error || "OCR failed")
      }
    } catch (e) {
      alert("OCR failed: " + (e as any)?.message)
    } finally {
      setOcrBusy(false)
      setOcrProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <main className="relative min-h-dvh">
      <Header variant="results" />
      <section className="mx-auto max-w-4xl px-4 md:px-6 pt-8 pb-16">
        <div className="glass rounded-2xl p-6 grid gap-4">
          <h1 className="text-2xl font-semibold">Paste your text (Low Vision)</h1>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste any text here..."
            className="min-h-64"
          />
          {ocrBusy && (
            <div className="rounded-md border p-3 text-sm">
              Recognizing image... {ocrProgress}%
              <div className="mt-2 h-2 w-full rounded bg-muted">
                <div className="h-2 rounded bg-primary transition-all" style={{ width: `${ocrProgress}%` }} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={useSample}>
              Use sample text
            </Button>
            <Button onClick={proceed} disabled={!text.trim()}>
              Proceed
            </Button>
            <Button asChild variant="outline">
              <Link href="/lowvision/dashboard">Back</Link>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleOcrFile(e.target.files?.[0] ?? undefined)}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={ocrBusy}>
              OCR Image
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}