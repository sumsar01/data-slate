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

export async function summariseSession(transcripts: string[]): Promise<string> {
  const combined = transcripts.map((t, i) => `[Note ${i + 1}]: ${t}`).join("\n\n")
  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are a scribe for a Warhammer 40K tabletop RPG campaign. " +
          "Summarise the session notes provided into a concise but evocative battle report. " +
          "Use gothic, Mechanicus-flavoured language. Focus on events, decisions, NPCs encountered, and locations visited. " +
          "Keep it under 300 words.",
      },
      {
        role: "user",
        content: `Summarise these session recordings:\n\n${combined}`,
      },
    ],
    max_tokens: 500,
  })
  return chat.choices[0]?.message?.content ?? ""
}

