import type { DateGroup } from "../shared"

export const MOCK_DATA: DateGroup[] = [
  {
    date: "2026-05-10",
    session_id: null, session_summary: null, session_name: "Session 14 — Hive Sibellus Underhive",
    notes: [
      {
        id: "n001",
        date: "2026-05-10",
        title: "Interrogation of Rogue Trader Voss",
        transcript:
          "Interrogation of Rogue Trader Aldric Voss conducted at 21:34 in sub-level detention chamber seven. Subject presented signs of neural conditioning — pupils dilated asymmetrically, micro-tremors in left hand consistent with cortex-implant interference. Claims no knowledge of the xenos mechanism recovered from hab-block seven. Voice stress analysis suggests deception probability at eighty-three point two percent. Cross-reference with trade manifests from Port Wrath reveals three undeclared cargo transits in the preceding six months. Recommend escalation to Inquisitor Valdane. Cogitator note: subject bears the mark of the Logician brotherhood on inner left wrist — partially obscured by a burn scar of recent origin.",
        audio_url: null,
        duration_s: 87,
        tags: ["NPC", "Clue"],
        created_at: "2026-05-10T21:34:00Z",
      },
      {
        id: "n002",
        date: "2026-05-10",
        title: "Xenos mechanism recovered from hab-block seven",
        transcript:
          "Xenos mechanism recovered from hab-block seven, sub-level nineteen. Device measures approximately thirty centimetres in diameter, oblate spheroid geometry, composed of an unknown alloy that resists standard auspex scanning. Surface covered in recursive geometric patterns consistent with Eldar craftwork, though the energy signature does not match known Eldar sources. Device emits a low-frequency resonance at eleven point four hertz — below human hearing threshold but detectable via servo-skull passive sensors. Do not activate under any circumstances until Magos Hekaton can be consulted. Storing in null-field containment case epsilon-seven.",
        audio_url: null,
        duration_s: 64,
        tags: ["Tech-Lore", "Item"],
        created_at: "2026-05-10T22:11:00Z",
      },
      {
        id: "n003",
        date: "2026-05-10",
        title: "Ambush at the promethium refinery — engagement log",
        transcript:
          "Engagement log, promethium refinery, sector nine. Ambush initiated at approximately twenty-three hundred hours by eight to ten armed hostiles — autogun equipped, mixed PDF surplus and civilian grade. Brotherhood cultists, confirmed by iconography on chest armour. Brother Castus sustained a las-burn to the right pauldron, non-critical. I took a round to the left leg actuator — reduced mobility by approximately forty percent, self-repair initiated. Hostiles neutralised. One captive taken alive for interrogation. Of note: attackers were specifically targeting our servitor — they attempted to destroy it before engaging us directly. They knew we were coming. Internal leak probability: high.",
        audio_url: null,
        duration_s: 112,
        tags: ["Combat", "Location", "Clue"],
        created_at: "2026-05-10T23:18:00Z",
      },
    ],
  },
  {
    date: "2026-04-26",
    session_id: null, session_summary: null, session_name: "Session 13 — The Warp Transit",
    notes: [
      {
        id: "n004",
        date: "2026-04-26",
        title: "Brother Castus behaved erratically during void transit",
        transcript:
          "Behavioural note regarding Brother Castus, Acolyte of the Emperor's Holy Inquisition. During the warp transit from Port Wrath to Hive Sibellus, lasting approximately four point seven days subjective time, Brother Castus exhibited increasingly erratic behaviour. Observed incidents include: prolonged staring at bulkheads with no apparent stimulus, speaking in what the Navigator's assistant described as an archaic dialect of Low Gothic, refusing meals for thirty-six hours, and being found in the cargo hold at 03:00 standing over the containment case holding the xenos device. When questioned he had no memory of the event. I have not reported this to Inquisitor Valdane as yet — I wish to gather more data. This notation is flagged: RESTRICTED — PERSONAL COGITATOR RECORD ONLY.",
        audio_url: null,
        duration_s: 98,
        tags: ["NPC", "Rumour", "Clue"],
        created_at: "2026-04-26T14:20:00Z",
      },
      {
        id: "n005",
        date: "2026-04-26",
        title: "Navigator quarters — warp anomaly log",
        transcript:
          "Consulted Navigator Thessaly Orin regarding the warp transit anomalies. She reports that the passage through the empyrean was unusually turbulent near the Mandeville point, consistent with what she describes as a shadow in the warp — a phenomenon she has encountered only twice previously, once near the Perdus Rift and once off the Cadian Gate. She refuses to elaborate further without a formal deposition before Inquisitor Valdane, citing Navis Nobilite covenant obligations. Her quarters contain an extensive star chart collection — several maps are annotated with locations I do not recognise from standard Imperial cartographic records. I have logged their coordinates for later cross-reference. Accessing them without consent would constitute a covenant breach — flagging for Inquisitor review.",
        audio_url: null,
        duration_s: 76,
        tags: ["Location", "Tech-Lore", "Rumour"],
        created_at: "2026-04-26T16:55:00Z",
      },
    ],
  },
  {
    date: "2026-04-12",
    session_id: null, session_summary: null, session_name: "Session 12 — Port Wrath",
    notes: [
      {
        id: "n006",
        date: "2026-04-12",
        title: "Contact: Magos Hekaton of Forge World Graia",
        transcript:
          "Initial contact established with Magos Biologis Hekaton, currently stationed at Port Wrath as part of a Mechanicus reclamation survey. Hekaton is a senior adept, approximately two hundred and thirty standard years old by my estimation — significant augmentation has made precise age determination difficult. She is cold but cooperative once I invoked the Rite of Shared Data in the correct ritual form. She has agreed to examine any xenos artefacts we recover in exchange for access to our mission reports — a standard Mechanicus data-tithe arrangement. I have forwarded this arrangement to Inquisitor Valdane for approval. Note personal: it has been forty-seven months since I last spoke High Gothic with another adept of the Omnissiah. The experience was unexpectedly affecting.",
        audio_url: null,
        duration_s: 105,
        tags: ["NPC", "Tech-Lore"],
        created_at: "2026-04-12T11:30:00Z",
      },
      {
        id: "n007",
        date: "2026-04-12",
        title: "Encrypted data-coil retrieved from dead drop",
        transcript:
          "Data-coil retrieved from dead drop location six — behind the third pillar in the nave of the Chapel of the Omnissiah Ascendant, Port Wrath lower docking district. Coil is standard Mechanicus format, triple-encrypted with what appears to be a Magos-grade cipher. I was able to break the outer two encryption layers using standard cogitator protocols. The third layer is resisting my current decryption toolkit. Contents partially visible: references to something called Operation Silica Veil, a list of coordinates, and what appear to be schematics for a device I do not recognise. Will attempt full decryption en route to Hive Sibellus. Flagged as priority intelligence for Inquisitor Valdane.",
        audio_url: null,
        duration_s: 81,
        tags: ["Clue", "Item", "Tech-Lore"],
        created_at: "2026-04-12T19:45:00Z",
      },
      {
        id: "n008",
        date: "2026-04-12",
        title: "Firefight in the docking bays — casualties and materiel",
        transcript:
          "Firefight in docking bay seventeen, Port Wrath. Engaged four PDF deserters who attempted to steal our shuttle. Engagement duration approximately ninety seconds. No acolyte casualties. Shuttle sustained minor hull scoring from a frag grenade — patched with emergency sealant. I retrieved the deserters' personal effects for intelligence value: one carried a data-slate with encrypted messages, one had a tattoo matching the Logician brotherhood iconography — same as Voss, though this encounter precedes the Voss interrogation so this notation should be read in reverse chronological context. I am beginning to see a pattern. The Logicians are not merely present — they appear to be actively working against this investigation.",
        audio_url: null,
        duration_s: 93,
        tags: ["Combat", "Location", "Clue"],
        created_at: "2026-04-12T22:00:00Z",
      },
    ],
  },
]
