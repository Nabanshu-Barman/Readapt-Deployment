export const runtime = "nodejs"

import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

    const { text } = await req.json()
    const prompt = `Summarize the following text into a concise TL;DR, using plain sentences separated by newlines. Keep key points and make it easy to skim:\n\n${text}`

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
    const result = await model.generateContent(prompt)

    const summary =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      (typeof result?.response?.text === "function"
        ? result.response.text()
        : result?.response?.text) ||
      ""

    return NextResponse.json({ summary })
  } catch (e) {
    console.error("Gemini summarizer error:", e)
    return NextResponse.json({ summary: "" })
  }
}