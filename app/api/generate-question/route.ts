// app/api/generate-question/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { mistral } from "@ai-sdk/mistral" // Add mistral import
import { getPool } from "@/lib/postgres"
import { insertQuestion } from "@/lib/questions-repo"
import { callAIProvider, getProviderFromModel, getModelFromSelection, AIProvider, ProviderConfig } from '../utils'; // Import AI utilities

// --- Robust JSON extraction: finds the first balanced {...} object,
//     ignoring braces inside quoted strings and escaped quotes.
function extractJSONObject(raw: string): string {
  let s = raw.trim()

  // strip code fences if present
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  }

  const start = s.indexOf("{")
  if (start === -1) throw new Error("No '{' found")

  let inStr = false
  let esc = false
  let depth = 0

  for (let i = start; i < s.length; i++) {
    const ch = s[i]

    if (inStr) {
      if (esc) {
        esc = false
      } else if (ch === "\\") {
        esc = true
      } else if (ch === '"') {
        inStr = false
      }
      continue
    } else {
      if (ch === '"') {
        inStr = true
        continue
      }
      if (ch === "{") depth++
      if (ch === "}") {
        depth--
        if (depth === 0) {
          const candidate = s.slice(start, i + 1)
            // common minor fixes: trailing commas like ,} or ,]
            .replace(/,\s*}/g, "}")
            .replace(/,\s*\]/g, "]")
            // remove BOMs/invisible
            .replace(/^\uFEFF/, "")
          return candidate.trim()
        }
      }
    }
  }
  throw new Error("Unbalanced JSON object")
}

const systemPrompt =
  "You are a strict JSON emitter. Output ONLY one valid JSON object matching the schema. No prose. No markdown. No code fences. Just JSON."

const promptTemplate = (topic: string, difficulty?: string, questionIndex: number = 0) => {
  const variations = [
    `Focus on ARRAY MANIPULATION and ITERATION approaches`,
    `Focus on RECURSIVE and DIVIDE-AND-CONQUER approaches`,
    `Focus on DYNAMIC PROGRAMMING and MEMOIZATION approaches`,
    `Focus on GREEDY and OPTIMIZATION approaches`,
    `Focus on GRAPH ALGORITHMS and TRAVERSAL approaches`,
    `Focus on TWO-POINTER and SLIDING-WINDOW approaches`,
    `Focus on HASH-MAP and SET-BASED approaches`,
    `Focus on STACK and QUEUE-BASED approaches`,
    `Focus on BIT-MANIPULATION approaches`,
    `Focus on BINARY-SEARCH and SORTING approaches`,
  ];

  const variation = variations[questionIndex % variations.length];

  return `
Return ONLY ONE valid JSON object. No text before or after. No code fences. No comments.

SCHEMA (REQUIRED KEYS):
"id","title","difficulty","question",
"input_format","output_format","constraints",
"sample_input","sample_output","hint",
"hidden_inputs","hidden_outputs",
"metadata" (with:
  "tags","companies","topic_category","subtopics","prerequisites",
  "time_complexity","space_complexity","expected_solve_time_minutes",
  "common_approaches","common_mistakes","interview_frequency",
  "mastery_indicators" { "solve_time_threshold","code_quality_patterns","optimization_awareness" }
)

CONSTRAINTS:
- Topic must be "${topic}".
${difficulty ? `- Difficulty MUST be "${difficulty}".` : ""}
- ${variation}
- Create a UNIQUE and DIFFERENT question from any previous ones on this topic
- Use double quotes for all keys/strings.
- No trailing commas.
- Ensure valid JSON.
`;
}

async function oneTry(genIndex: number, temp: number, topic: string, difficulty?: string, selectedAIModel?: string, apiKey?: string) {
  if (!selectedAIModel || !apiKey) {
    throw new Error("AI model and API key are required for question generation.");
  }

  const provider = getProviderFromModel(selectedAIModel);
  if (!provider) {
    throw new Error(`Unsupported AI model: ${selectedAIModel}`);
  }

  const modelName = getModelFromSelection(selectedAIModel);

  const providerConfig: ProviderConfig = {
    apiKey: apiKey.trim(),
    provider,
    model: modelName,
  };

  const text = await callAIProvider(providerConfig, promptTemplate(topic, difficulty, genIndex), systemPrompt);

  if (!text) {
    throw new Error("Failed to generate text from AI provider.");
  }

  // 1) try direct parse
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // 2) robust extract of first balanced object
    const extracted = extractJSONObject(trimmed)
    return JSON.parse(extracted)
  }
}

export async function POST(request: NextRequest) {
  try {
    const pool = getPool()
    const { topic, count = 1, temperature = 0.7, difficulty, selectedAIModel, apiKey } = await request.json()

    if (!selectedAIModel || !apiKey) {
      return NextResponse.json({ message: "AI model and API key are required" }, { status: 400 });
    }

    if (!topic) return NextResponse.json({ message: "Missing 'topic' in request body" }, { status: 400 })
    if (typeof count !== "number" || count < 1 || count > 10)
      return NextResponse.json({ message: "Invalid 'count'. Must be 1..10" }, { status: 400 })

    const inserted: any[] = []
    const errors: any[] = []

    for (let i = 0; i < count; i++) {
      try {
        let obj: any
        try {
          obj = await oneTry(i, temperature, topic, difficulty, selectedAIModel, apiKey)
        } catch (err1) {
          // quick retry with slightly lower temp to reduce chatter
          obj = await oneTry(i, Math.max(0, temperature - 0.1), topic, difficulty, selectedAIModel, apiKey)
        }

        // basic validation
        if (!obj?.title || !obj?.difficulty || !obj?.question || !obj?.metadata) {
          throw new Error("Generated JSON missing required fields")
        }

        const row = await insertQuestion(pool, {
          title: obj.title,
          difficulty: obj.difficulty,
          question: obj.question,
          input_format: obj.input_format,
          output_format: obj.output_format,
          constraints: obj.constraints,
          sample_input: obj.sample_input,
          sample_output: obj.sample_output,
          hint: obj.hint,
          hidden_inputs: obj.hidden_inputs,
          hidden_outputs: obj.hidden_outputs,
          metadata: obj.metadata,
        })

        inserted.push({ id: row.id, title: row.title })
      } catch (e: any) {
        errors.push({ attempt: i + 1, error: e?.message || String(e) })
      }
    }

    const message = `Inserted ${inserted.length} of ${count}${errors.length ? `, ${errors.length} failed` : ""}.`
    return NextResponse.json({ message, inserted, errors }, { status: inserted.length ? 201 : 500 })
  } catch (err: any) {
    console.error("generate-question fatal:", err)
    return NextResponse.json({ message: "Internal Server Error", error: err?.message }, { status: 500 })
  }
}
