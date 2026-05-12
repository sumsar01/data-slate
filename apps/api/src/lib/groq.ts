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

export type Entity = { name: string; type: "NPC" | "Location" | "Faction" | "Item" | "Other" }

export async function extractEntities(transcript: string): Promise<Entity[]> {
  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are an entity extractor for a Warhammer 40K tabletop RPG campaign. " +
          "Extract named entities from the transcript. " +
          "Return a JSON object with an 'entities' array. Each element has 'name' (string) and 'type' (one of: NPC, Location, Faction, Item, Other). " +
          "Example: {\"entities\":[{\"name\":\"Inquisitor Krell\",\"type\":\"NPC\"},{\"name\":\"Hive Sibellus\",\"type\":\"Location\"}]}",
      },
      {
        role: "user",
        content: transcript,
      },
    ],
    max_tokens: 400,
    response_format: { type: "json_object" },
  })
  const text = chat.choices[0]?.message?.content ?? "{}"
  try {
    const parsed = JSON.parse(text)
    const arr = Array.isArray(parsed) ? parsed : (parsed.entities ?? [])
    return arr.filter((e: any) => e.name && e.type)
  } catch {
    return []
  }
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
