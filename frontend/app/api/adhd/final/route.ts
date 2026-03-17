export const runtime = "nodejs"

import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL 

function ensureBackendBase(): string {
  if (!BACKEND_URL) {
    throw new Error(
      "Missing BACKEND_URL env var. Set it in .env.local, e.g. BACKEND_URL=http://localhost:8000"
    )
  }
  return BACKEND_URL.replace(/\/+$/, "")
}

export async function GET() {
  try {
    const base = ensureBackendBase()
    const res = await fetch(`${base}/api/adhd/final`, {
      method: "GET",
      headers: { Accept: "application/json" },
      // If your backend needs auth/session, forward cookies/headers here
    })

    // Try to pass through JSON; if body is empty/non-JSON, return empty object with same status
    let data: any = {}
    try {
      data = await res.json()
    } catch {
      /* ignore parse error; return empty object below */
    }
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    console.error("[Proxy] GET /api/adhd/final failed:", e)
    return NextResponse.json({ error: "Proxy error" }, { status: 502 })
  }
}

export async function POST(req: Request) {
  try {
    const base = ensureBackendBase()
    const body = await req.json().catch(() => ({}))

    const res = await fetch(`${base}/api/adhd/final`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    })

    let data: any = {}
    try {
      data = await res.json()
    } catch {
      /* ignore parse error; return empty object below */
    }
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    console.error("[Proxy] POST /api/adhd/final failed:", e)
    return NextResponse.json({ error: "Proxy error" }, { status: 502 })
  }
}