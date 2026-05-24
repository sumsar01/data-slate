import Groq from "groq-sdk"

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<{ transcript: string; detectedLanguage: string }> {
  const file = new File([audioBuffer], filename, { type: "audio/webm" })

  const result = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "verbose_json",
  })

  const transcript = (result as any).text ?? ""
  const detectedLanguage = (result as any).language ?? "unknown"

  return { transcript, detectedLanguage }
}

// Lightly rewrites transcript keeping original language, returns flavoured text
export async function flavourTranscript(transcript: string, language: string): Promise<string> {
  if (!transcript.trim()) return transcript
  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are a Warhammer 40K scribe. " +
          "Lightly rewrite the following transcript, replacing modern real-world terms with Warhammer 40K in-universe equivalents. " +
          `The transcript is written in ${language} — you MUST keep the output in ${language}. Do NOT translate to any other language. ` +
          "Only make light substitutions where a clear 40K equivalent exists. Preserve meaning, tone, and sentence structure. " +
          "Do not add new information. Do not add gothic flourishes or extra sentences. " +
          "Examples of substitutions (adapt to the transcript language): " +
          "gun/pistol→bolter/laspistol, soldier→guardsman, church/cathedral→shrine of the Emperor, " +
          "computer→cogitator, phone/radio→vox-unit, car/vehicle→transport/rhino, " +
          "police→Arbites, doctor→medicae, hospital→medicae bay, " +
          "government→Administratum, city→hive city, factory→manufactorium, " +
          "alien→xenos, magic→warp sorcery, priest→preacher/confessor, " +
          "rebel→heretic, criminal gang→chaos cult (only if contextually appropriate). " +
          "If no substitutions are needed, return the text unchanged. " +
          "NEVER add parenthetical notes, explanations, or comments about what substitutions were or were not made. " +
          "Output ONLY the rewritten transcript text — nothing else.",
      },
      {
        role: "user",
        content: transcript,
      },
    ],
    max_tokens: 1000,
  })
  return chat.choices[0]?.message?.content?.trim() ?? transcript
}

// Generates a short English title summarising the transcript content
export async function generateTitle(transcript: string): Promise<string> {
  if (!transcript.trim()) return "Untitled"
  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "Generate a short title (max 8 words) that summarises the content of the following transcript. " +
          "Respond in Danish. If the transcript is clearly in another language, respond in that language instead. " +
          "Be factual and descriptive — only reflect what is actually in the transcript. No dramatic framing, no invented terms. " +
          "No quotes, no punctuation at the end.",
      },
      {
        role: "user",
        content: transcript,
      },
    ],
    max_tokens: 30,
  })
  const title = chat.choices[0]?.message?.content?.trim() ?? ""
  return title.slice(0, 60) || "Untitled"
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
          "Extract named entities from the transcript. The transcript may be in any language — always respond in English. " +
          "Return a JSON object with an 'entities' array. Each element has 'name' (string, in English) and 'type' (one of: NPC, Location, Faction, Item, Other). " +
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

export async function summariseEntity(name: string, type: string, transcripts: string[]): Promise<string> {
  const combined = transcripts.map((t, i) => `[Transcript ${i + 1}]: ${t}`).join("\n\n")
  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are maintaining entity dossiers for a Warhammer 40K tabletop RPG campaign. " +
          "Based on the transcript excerpts provided, write a concise intel report about the named entity. " +
          "Focus only on what is actually mentioned in the transcripts — do not invent details. " +
          "Write in Danish. If the transcript excerpts are clearly in another language, write in that language instead. " +
          "Use light Warhammer 40K flavour, but keep it factual and grounded. Keep it under 200 words. No headers, just flowing text.",
      },
      {
        role: "user",
        content: `Compile a dossier on the following entity:\nName: ${name}\nType: ${type}\n\nTranscript excerpts:\n\n${combined}`,
      },
    ],
    max_tokens: 350,
  })
  return chat.choices[0]?.message?.content?.trim() ?? ""
}

export async function nameSession(transcripts: string[]): Promise<string> {
  const combined = transcripts.map((t, i) => `[Note ${i + 1}]: ${t}`).join("\n\n")
  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are a scribe for a Warhammer 40K tabletop RPG campaign. " +
          "Given session recordings, generate a short evocative session name (4–7 words max) in the style of a 40K mission title. " +
          "Examples: 'The Siege of Hive Tertius', 'Descent into the Underhive', 'Blood on the Manufactorum Floor'. " +
          "IMPORTANT: Write the session name in the SAME language as the majority of the transcripts. " +
          "Return ONLY the session name, no quotes, no explanation.",
      },
      {
        role: "user",
        content: `Name this session based on these recordings:\n\n${combined}`,
      },
    ],
    max_tokens: 30,
  })
  return chat.choices[0]?.message?.content?.trim() ?? "Unnamed Session"
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
          "IMPORTANT: Write the summary in the SAME language as the majority of the transcripts. " +
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
