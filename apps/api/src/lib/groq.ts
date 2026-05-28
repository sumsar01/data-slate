import Groq from "groq-sdk"

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" })
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<{ transcript: string; detectedLanguage: string }> {
  const file = new File([audioBuffer], filename, { type: "audio/webm" })

  const result = await getGroq().audio.transcriptions.create({
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
  const chat = await getGroq().chat.completions.create({
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
  const chat = await getGroq().chat.completions.create({
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
  const chat = await getGroq().chat.completions.create({
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
  const chat = await getGroq().chat.completions.create({
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

export type ClueSuggestion = {
  title: string
  description: string
  priority: number // 0=critical, 1=high, 2=normal, 3=low, 4=background
}

// Scans session transcripts and returns suggested Dead Drop leads.
// Truncates each transcript to 1500 chars and caps total input at 18000 chars
// to avoid silent context-overflow failures with many recordings.
export async function extractClues(transcripts: string[]): Promise<ClueSuggestion[]> {
  if (!transcripts.length) return []

  const PER_TRANSCRIPT_LIMIT = 1500
  const TOTAL_LIMIT = 18000

  let total = 0
  const parts: string[] = []
  for (let i = 0; i < transcripts.length; i++) {
    const chunk = transcripts[i].slice(0, PER_TRANSCRIPT_LIMIT)
    if (total + chunk.length > TOTAL_LIMIT) break
    parts.push(`[OPTAGELSE ${i + 1}]\n${chunk}`)
    total += chunk.length
  }
  const combined = parts.join("\n\n---\n\n")

  const chat = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Du er en inquisitoriel analytiker for Ordo Hereticus i Warhammer 40K-universet. " +
          "Læs sessionstransskripterne og udpeg 3-8 konkrete efterretningsemner der fortjener opfølgning. " +
          "Vær generøs — hellere for mange end for få. Selv delvist uklare emner er relevante. " +
          "\n\nKig efter: navngivne personer hvis loyalitet er ukendt, organisationer der omtales mystisk, " +
          "steder der ikke er undersøgt, genstande med ukendt formål, hændelser der ikke er forklaret, " +
          "planer eller møder der er nævnt, mistænkelige sammenhænge mellem entiteter. " +
          "\n\nReturner KUN dette JSON-format:\n" +
          '{"clues":[{"title":"Kort betegnelse max 8 ord","description":"Hvad der er observeret (2-3 sætninger)","priority":0}]}' +
          "\n\nPrioritet: 0=KRITISK, 1=HØJ, 2=NORMAL, 3=LAV, 4=BAGGRUND. " +
          "Skriv på dansk. Brug kun oplysninger fra transskripterne.",
      },
      {
        role: "user",
        content: combined,
      },
    ],
    max_tokens: 1500,
  })
  try {
    const raw = chat.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(raw)
    const clues: ClueSuggestion[] = (parsed.clues ?? []).map((c: any) => ({
      title: String(c.title ?? "").slice(0, 120),
      description: String(c.description ?? "").slice(0, 500),
      priority: Math.min(4, Math.max(0, parseInt(c.priority ?? "2", 10) || 2)),
    }))
    return clues
  } catch {
    return []
  }
}

export type Relation = {
  from_name: string
  to_name: string
  relation_type: string
}

const VALID_RELATIONS = [
  "COMMANDS", "SUBORDINATE_TO", "MEMBER_OF", "LEADS",
  "LOCATED_IN", "CONTROLS", "OPERATES_FROM",
  "ALLIED_WITH", "HOSTILE_TO", "INVESTIGATES",
  "AFFILIATED_WITH", "WITNESSED_AT", "OWNS",
]

export async function extractRelations(
  entityName: string,
  entityType: string,
  knownEntityNames: string[],
  transcripts: string[]
): Promise<Relation[]> {
  if (!transcripts.length || !knownEntityNames.length) return []
  const combined = transcripts.map((t, i) => `[Transcript ${i + 1}]: ${t}`).join("\n\n")
  const knownList = knownEntityNames.join(", ")
  const validList = VALID_RELATIONS.join(", ")
  const chat = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You extract entity relationships for a Warhammer 40K tabletop RPG campaign. " +
          "Given transcripts, identify relationships between the focal entity and other known entities. " +
          `Valid relation types: ${validList}. ` +
          "Return a JSON object: {\"relations\": [{\"from_name\": \"...\", \"to_name\": \"...\", \"relation_type\": \"...\"}]}. " +
          "Only use entities from the provided known entities list. Only include relations clearly supported by the transcripts. " +
          "Respond in English. Return an empty relations array if none are found.",
      },
      {
        role: "user",
        content:
          `Focal entity: ${entityName} (${entityType})\n` +
          `Known entities: ${knownList}\n\n` +
          `Transcripts:\n\n${combined}`,
      },
    ],
    max_tokens: 400,
    response_format: { type: "json_object" },
  })
  const text = chat.choices[0]?.message?.content ?? "{}"
  try {
    const parsed = JSON.parse(text)
    const arr: Relation[] = Array.isArray(parsed) ? parsed : (parsed.relations ?? [])
    return arr.filter((r) =>
      r.from_name && r.to_name && VALID_RELATIONS.includes(r.relation_type)
    )
  } catch {
    return []
  }
}

export async function summariseSession(transcripts: string[]): Promise<string> {
  const combined = transcripts.map((t, i) => `[Note ${i + 1}]: ${t}`).join("\n\n")
  const chat = await getGroq().chat.completions.create({
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

/**
 * Generate a mission briefing for a session (or recent sessions).
 * Returns a structured Danish in-universe briefing document.
 */
export async function generateBriefing(params: {
  sessionName: string | null
  sessionSummaries: string[]
  activeEntities: Array<{ name: string; type: string; status: string | null; description: string | null }>
  recentNotes: string[]
}): Promise<string> {
  const { sessionName, sessionSummaries, activeEntities, recentNotes } = params

  const entityBlock = activeEntities.length
    ? activeEntities
        .map((e) => `- ${e.name} [${e.type}${e.status ? `, STATUS: ${e.status}` : ""}]: ${e.description ?? "Ingen kendte oplysninger"}`)
        .join("\n")
    : "Ingen kendte entiteter"

  const summaryBlock = sessionSummaries.length
    ? sessionSummaries.join("\n\n---\n\n")
    : recentNotes.slice(0, 3).join("\n\n---\n\n")

  const chat = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "Du er en Inquisitoriel cogitator-ånd der genererer missionsbriefinger til akolytten. " +
          "Skriv på dansk i et dystert, bureaukratisk Warhammer 40K-stil. " +
          "Strukturer briefingen med disse sektioner (brug markdown-overskrifter):\n" +
          "## SITUATIONSRAPPORT\n" +
          "## KENDTE TRUSLER\n" +
          "## AKTIVE ENTITETER\n" +
          "## ÅBNE TRÅDE\n" +
          "## ORDRER\n\n" +
          "Hold det faktabaseret — opfind ikke nye detaljer. Brug kun det der er givet. " +
          "Imperiums-terminologi: akolyt, Inquisitor, Throne Gelt, medicae, vox, cogitator, Adeptus, Hab-blok, Underhive. " +
          "Maks 400 ord total.",
      },
      {
        role: "user",
        content:
          `Mission/Session: ${sessionName ?? "Igangværende operation"}\n\n` +
          `Seneste session-rapporter:\n${summaryBlock}\n\n` +
          `Kendte entiteter:\n${entityBlock}`,
      },
    ],
    max_tokens: 700,
  })
  return chat.choices[0]?.message?.content?.trim() ?? ""
}
