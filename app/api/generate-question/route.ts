// app/api/generate-question/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { query, resetProblemsSequence } from "@/lib/rds"
import { insertQuestion } from "@/lib/questions-repo"
import { callAIProviderWithFallback, getProviderFromModel, getModelFromSelection, AIProvider, ProviderConfig } from '../utils'; // Import AI utilities

// --- Robust JSON extraction with improved fallback and logging
function extractJSONObject(raw: string): string {
  const s = raw.trim();
  
  // Try direct parse first
  try {
    JSON.parse(s);
    return s; // It's already valid JSON
  } catch {
    // Proceed with extraction
  }

  // Find first { and last }
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < s.length; i++) {
    const char = s[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      if (startIdx === -1) startIdx = i;
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && startIdx !== -1) {
        endIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1 || endIdx === -1) {
    // ✅ ADD THIS - Log the raw response for debugging
    console.error("❌ Could not extract JSON from response");
    console.error("   Response length:", s.length);
    console.error("   First 200 chars:", s.substring(0, 200));
    throw new Error("Unbalanced JSON object - could not find valid JSON in response");
  }

  return s.substring(startIdx, endIdx + 1);
}

const systemPrompt =
  "You are a JSON generator for DSA interview questions.\nCRITICAL RULES:\n1. Output ONLY valid JSON object\n2. No markdown, no code blocks, no explanations\n3. Include all required fields exactly as specified\n4. Keep responses concise but complete\n5. Start with { and end with }"

const promptTemplate = (topic: string, difficulty?: string, questionIndex: number = 0, totalCount: number = 1) => {
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

  // Capitalize difficulty for prompt
  let effectiveDifficulty = difficulty 
    ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase()
    : 'Medium';

  if (totalCount > 2) {
    const difficultyLevels = ['Easy', 'Medium', 'Hard'];
    effectiveDifficulty = difficultyLevels[Math.floor(Math.random() * difficultyLevels.length)];
  }

  return `Generate a unique DSA interview question about ${topic}${effectiveDifficulty ? ` (${effectiveDifficulty} level)` : ''}. Variation ${questionIndex + 1}.

Return ONLY this JSON structure with NO other text:
{
  "id": "unique_id",
  "title": "Problem title",
  "difficulty": "${effectiveDifficulty}",
  "question": "Clear problem statement",
  "input_format": "Input description",
  "output_format": "Output description",
  "constraints": "Specific constraints",
  "sample_input": "Example input",
  "sample_output": "Example output",
  "hint": "Solution hint",
  "hidden_inputs": ["test case 1", "test case 2"],
  "hidden_outputs": ["[\"expected 1\"]", "[\"expected 2\"]"],
  "metadata": {
    "tags": ["${topic.toLowerCase()}"],
    "topic_category": "${topic}",
    "subtopics": ["relevant subtopic"],
    "time_complexity": "O(...)",
    "space_complexity": "O(...)",
    "expected_solve_time_minutes": 15,
    "common_approaches": ["Approach 1", "Approach 2"],
    "common_mistakes": ["Mistake 1"],
    "interview_frequency": "high",
    "mastery_indicators": {
      "solve_time_threshold": 900,
      "code_quality_patterns": ["pattern1"],
      "optimization_awareness": true
    }
  }
}

CRITICAL: ${variation}. Topic MUST be "${topic}". Use double quotes only. No markdown. Valid JSON. Use square brackets \`[]\` for all JSON arrays. If an array contains other arrays, ensure they are stringified within double quotes, e.g., \`\"[1,2,3]\"\`.`;
};

async function oneTry(genIndex: number, temp: number, topic: string, difficulty?: string, selectedAIModel?: string, apiKey?: string, totalCount: number = 1) {
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

  try {
    const text = await callAIProviderWithFallback(
      providerConfig,
      promptTemplate(topic, difficulty, genIndex, totalCount),
      systemPrompt
    );

    if (!text) {
      throw new Error("Failed to generate text from AI provider.");
    }

    // Parse the response
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const extracted = extractJSONObject(trimmed);
      return JSON.parse(extracted);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // ✅ ADD THIS - Handle specific Gemini errors
    if (errorMsg.includes('overloaded')) {
      console.warn("⏳ Gemini overloaded, waiting 2 seconds before retry...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      throw error; // Let the retry logic handle it
    }
    
    if (errorMsg.includes('Empty response')) {
      console.warn("⚠️ Gemini returned empty response, this might be a safety filter issue");
    }
    
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      topic, 
      count = 1, 
      temperature = 0.7, 
      difficulty,
      selectedAIModel,  // ✅ GET FROM BODY
      apiKey            // ✅ GET FROM BODY
    } = body

    // ✅ ADD THIS - Validate inputs
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      )
    }

    if (!selectedAIModel || !apiKey) {
      return NextResponse.json(
        { error: 'AI model and API key are required' },
        { status: 400 }
      )
    }

    console.log(`📝 Generating ${count} ${topic} questions with ${selectedAIModel}...`)

    // Attempt to reset the sequence before any insertions
    await resetProblemsSequence();
    
    if (typeof count !== "number" || count < 1 || count > 10)
      return NextResponse.json({ error: "Invalid 'count'. Must be 1..10" }, { status: 400 })

    const inserted: any[] = []
    const errors: any[] = []

    for (let i = 0; i < count; i++) {
      try {
        console.log(`🔄 Generating question ${i + 1}/${count}...`)
        let obj: any
        try {
          obj = await oneTry(i, temperature, topic, difficulty, selectedAIModel, apiKey, count)
        } catch (err1) {
          console.error(`❌ First attempt failed for question ${i + 1}:`, err1)
          // quick retry with slightly lower temp to reduce chatter
          obj = await oneTry(i, Math.max(0, temperature - 0.1), topic, difficulty, selectedAIModel, apiKey, count)
        }

        // basic validation
        if (!obj?.title || !obj?.difficulty || !obj?.question || !obj?.metadata) {
          throw new Error("Generated JSON missing required fields")
        }

        const row = await insertQuestion({
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

        console.log(`✅ Question ${i + 1} generated and saved with ID: ${row.id}`)
        inserted.push({ id: row.id, title: row.title })
      } catch (e: any) {
        console.error(`❌ Error generating question ${i + 1}:`, e?.message)
        errors.push({ attempt: i + 1, error: e?.message || String(e) })
      }
    }

    const message = `Inserted ${inserted.length} of ${count}${errors.length ? `, ${errors.length} failed` : ""}.`
    console.log(`📊 Generation complete:`, message)
    return NextResponse.json({ message, inserted, errors }, { status: inserted.length ? 201 : 500 })
  } catch (err: any) {
    console.error("❌ generate-question fatal:", err)
    return NextResponse.json({ message: "Internal Server Error", error: err?.message }, { status: 500 })
  }
}
