import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: {
    path?: string[]
  }
}

function getBackendBaseUrl(): string {
  const base = process.env.BACKEND_URL?.trim()
  if (!base) {
    throw new Error("Missing BACKEND_URL env var for /api/backend proxy")
  }
  return base.replace(/\/+$/, "")
}

function buildTargetUrl(req: NextRequest, pathParts: string[] = []): string {
  const base = getBackendBaseUrl()
  const path = pathParts.join("/")
  const query = req.nextUrl.search || ""
  return `${base}/${path}${query}`
}

async function proxy(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const targetUrl = buildTargetUrl(req, ctx.params.path)

    const outgoingHeaders = new Headers(req.headers)
    outgoingHeaders.delete("host")
    outgoingHeaders.delete("content-length")

    const init: RequestInit = {
      method: req.method,
      headers: outgoingHeaders,
      redirect: "manual",
      cache: "no-store",
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.arrayBuffer()
    }

    const upstream = await fetch(targetUrl, init)
    const responseHeaders = new Headers(upstream.headers)
    responseHeaders.delete("content-encoding")
    responseHeaders.delete("content-length")

    const body = await upstream.arrayBuffer()

    return new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error("[Proxy] /api/backend request failed:", error)
    return NextResponse.json(
      {
        error: "Backend proxy failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    )
  }
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx)
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx)
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx)
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx)
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx)
}

export async function OPTIONS(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx)
}

export async function HEAD(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx)
}
