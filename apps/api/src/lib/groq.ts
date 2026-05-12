import Groq from "groq-sdk"

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<{ transcript: string; title: string }> {
  const file = new File([audioBuffer], filename, { type: "audio/webm" })

  const result = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "text",
  })

  const transcript = typeof result === "string" ? result : (result as any).text ?? ""
  const firstSentence = transcript.split(/[.!?]/)[0]?.trim() ?? "Untitled"
  const title = firstSentence.slice(0, 60) || "Untitled"

  return { transcript, title }
}
