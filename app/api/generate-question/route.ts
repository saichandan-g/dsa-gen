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
    // Fallback: try to find the first and last brace and assume it's the JSON object
    let potentialJson = '';
    const firstBrace = s.indexOf('{');
    const lastBrace = s.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      potentialJson = s.substring(firstBrace, lastBrace + 1);
    } else {
      // If no braces found, or malformed, try to find a JSON-like string
      const jsonRegex = /\{[\s\S]*\}/;
      const match = s.match(jsonRegex);
      if (match && match[0]) {
        potentialJson = match[0];
      }
    }

    if (potentialJson) {
      try {
        JSON.parse(potentialJson); // Validate if it's actually valid JSON
        return potentialJson;
      } catch (e) {
        console.error("⚠️ Fallback JSON extraction failed to parse:", e);
      }
    }

    console.error("❌ Could not extract JSON from response");
    console.error("   Response length:", s.length);
    console.error("   First 200 chars:", s.substring(0, 200));
    throw new Error("Unbalanced JSON object - could not find valid JSON in response");
  }

  return s.substring(startIdx, endIdx + 1);
}

// Helper to clean text fields
function cleanTextField(text: string | undefined | null): string | undefined {
  if (text === undefined || text === null) return undefined;
  let cleaned = text.trim();
  // Remove markdown code fences
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '').trim();
  // Remove common explanation prefixes
  cleaned = cleaned.replace(/^(Explanation|Note|Hint|Output):?\s*/i, '').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

// Helper to ensure array of strings, attempting to parse if stringified
function ensureStringArray(arr: any): string[] {
  if (Array.isArray(arr)) {
    return arr.map(item => String(item).replace(/\\\\n/g, '\\n').trim());
  }
  if (typeof arr === 'string') {
    try {
      const parsed = JSON.parse(arr);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).replace(/\\\\n/g, '\\n').trim());
      }
    } catch (e) {
      // Not a stringified array, treat as single item if it makes sense or return empty
    }
  }
  return [];
}

// New validation and auto-fix layer for each variant
function validateAndFixVariant(variant: any): any {
  const fixedVariant = { ...variant };

  // 1. Ensure sample_input
  if (typeof fixedVariant.test_cases?.sample_input === 'string') {
    fixedVariant.test_cases.sample_input = fixedVariant.test_cases.sample_input
      .replace(/\\\\n/g, '\\n') // Replace escaped newlines with raw newlines
      .trim();
  } else {
    fixedVariant.test_cases.sample_input = undefined;
  }

  // 2. Ensure hidden_inputs
  if (fixedVariant.test_cases?.hidden_inputs) {
    fixedVariant.test_cases.hidden_inputs = ensureStringArray(fixedVariant.test_cases.hidden_inputs)
      .map(input => input.replace(/\\\\n/g, '\\n').trim()); // Ensure raw newlines and trim
  } else {
    fixedVariant.test_cases.hidden_inputs = [];
  }

  // 3. Ensure hidden_outputs
  if (fixedVariant.test_cases?.hidden_outputs) {
    fixedVariant.test_cases.hidden_outputs = ensureStringArray(fixedVariant.test_cases.hidden_outputs)
      .map(output => cleanTextField(output) || ''); // Clean and ensure string
  } else {
    fixedVariant.test_cases.hidden_outputs = [];
  }

  // 4. Sanitize description, hint, and other free-text fields
  fixedVariant.description = cleanTextField(fixedVariant.description);
  fixedVariant.hint = cleanTextField(fixedVariant.hint);

  // 5. Ensure constraints
  if (typeof fixedVariant.constraints === 'string') {
    fixedVariant.constraints = fixedVariant.constraints
      .replace(/^(Constraints|Note):?\s*/i, '') // Remove common prefixes
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .trim();
    if (!fixedVariant.constraints.match(/^[\d\s<=>^().*+-]+$/)) { // Basic check for numeric/operator format
      console.warn(`⚠️ Constraints for variant '${fixedVariant.title}' might be non-numeric: ${fixedVariant.constraints}`);
      // More aggressive cleaning if it looks like a sentence
      fixedVariant.constraints = fixedVariant.constraints.split('\n').filter((line: string) => line.match(/[\d\s<=>^().*+-]+/)).join('\n').trim();
    }
    if (fixedVariant.constraints.length === 0) fixedVariant.constraints = undefined;
  } else {
    fixedVariant.constraints = undefined;
  }

  // 6. Ensure input_format and output_format
  fixedVariant.input_format = cleanTextField(fixedVariant.input_format);
  fixedVariant.output_format = cleanTextField(fixedVariant.output_format);

  // 7. Ensure JSON safety (remove undefined/null fields, ensure arrays)
  // This is largely handled by `insertQuestion`'s `?? null` and `JSON.stringify` for JSONB fields.
  // However, we can ensure arrays are not stringified at this stage if they were accidentally.
  if (typeof fixedVariant.tags === 'string') {
    fixedVariant.tags = ensureStringArray(fixedVariant.tags);
  }
  if (fixedVariant.metadata?.mastery_indicators && typeof fixedVariant.metadata.mastery_indicators === 'string') {
    fixedVariant.metadata.mastery_indicators = ensureStringArray(fixedVariant.metadata.mastery_indicators);
  }
  if (fixedVariant.metadata?.common_approaches && typeof fixedVariant.metadata.common_approaches === 'string') {
    fixedVariant.metadata.common_approaches = ensureStringArray(fixedVariant.metadata.common_approaches);
  }
  if (fixedVariant.metadata?.common_mistakes && typeof fixedVariant.metadata.common_mistakes === 'string') {
    fixedVariant.metadata.common_mistakes = ensureStringArray(fixedVariant.metadata.common_mistakes);
  }
  if (fixedVariant.metadata?.tags && typeof fixedVariant.metadata.tags === 'string') {
    fixedVariant.metadata.tags = ensureStringArray(fixedVariant.metadata.tags);
  }

  // Remove any fields that are explicitly undefined after cleaning, to keep JSON clean
  for (const key in fixedVariant) {
    if (fixedVariant[key] === undefined) {
      delete fixedVariant[key];
    }
  }
  if (fixedVariant.test_cases) {
    for (const key in fixedVariant.test_cases) {
      if (fixedVariant.test_cases[key] === undefined) {
        delete fixedVariant.test_cases[key];
      }
    }
  }
  if (fixedVariant.metadata) {
    for (const key in fixedVariant.metadata) {
      if (fixedVariant.metadata[key] === undefined) {
        delete fixedVariant.metadata[key];
      }
    }
  }

  return fixedVariant;
}

// Helper to infer topic category
function inferTopicCategory(variant: any): string {
  const title = variant.title?.toLowerCase() || '';
  const description = variant.description?.toLowerCase() || '';
  const tags = (Array.isArray(variant.tags) ? variant.tags.map((t: string) => t.toLowerCase()) : []) || [];

  const text = `${title} ${description} ${tags.join(' ')}`;

  if (text.includes('array') || text.includes('subarray') || text.includes('sorting') || text.includes('rotate')) return 'Arrays';
  if (text.includes('string') || text.includes('palindrome') || text.includes('substring') || text.includes('anagram')) return 'Strings';
  if (text.includes('tree') || text.includes('bst') || text.includes('binary tree') || text.includes('trie')) return 'Trees';
  if (text.includes('graph') || text.includes('dfs') || text.includes('bfs') || text.includes('path')) return 'Graphs';
  if (text.includes('dp') || text.includes('dynamic programming') || text.includes('memoization')) return 'Dynamic Programming';
  if (text.includes('search') || text.includes('binary search')) return 'Searching';
  if (text.includes('two pointers') || text.includes('sliding window')) return 'Two Pointers';
  if (text.includes('linked list') || text.includes('node')) return 'Linked Lists';
  if (text.includes('stack') || text.includes('queue')) return 'Stacks & Queues';
  if (text.includes('hash map') || text.includes('hash table') || text.includes('set')) return 'Hash Tables';
  if (text.includes('heap') || text.includes('priority queue')) return 'Heaps';
  if (text.includes('matrix') || text.includes('grid')) return 'Matrix';
  if (text.includes('bit manipulation') || text.includes('bits')) return 'Bit Manipulation';

  return 'General'; // Default category
}

// Helper to infer time and space complexity (heuristic)
function inferComplexity(solutionCode: string): { time: string; space: string } {
  const code = solutionCode.toLowerCase();
  let time = 'O(N)';
  let space = 'O(1)';

  // Time Complexity
  if (code.includes('for') && code.indexOf('for', code.indexOf('for') + 1) !== -1) { // Nested loops
    time = 'O(N^2)';
  } else if (code.includes('while') && code.indexOf('while', code.indexOf('while') + 1) !== -1) { // Nested loops
    time = 'O(N^2)';
  } else if (code.includes('binary search') || code.includes('bisect')) {
    time = 'O(log N)';
  } else if (code.includes('recursion') || code.includes('def recurse')) {
    // Simple recursion might be O(N) or O(2^N) - hard to tell without full analysis
    // For now, assume O(N) for typical DSA problems unless nested loops are obvious
    time = 'O(N)';
  } else if (code.includes('dp_table') || code.includes('memo')) {
    time = 'O(N*M)'; // Common for DP
  }

  // Space Complexity
  if (code.includes('dp_table') || code.includes('memo') || code.includes('new array') || code.includes('new list') || code.includes('hashmap') || code.includes('dictionary')) {
    space = 'O(N)';
  } else if (code.includes('recursion')) {
    space = 'O(H)'; // O(Height) for recursion stack, often O(N) in worst case
  }

  return { time, space };
}

// Helper to enrich metadata
function enrichMetadata(variant: any): any {
  const enrichedVariant = { ...variant };
  enrichedVariant.metadata = enrichedVariant.metadata || {};

  // 0. Copy variant.tags to metadata.tags (FIX for tags column)
  if (Array.isArray(enrichedVariant.tags) && enrichedVariant.tags.length > 0) {
    enrichedVariant.metadata.tags = enrichedVariant.tags;
  } else if (!enrichedVariant.metadata.tags) {
    enrichedVariant.metadata.tags = [];
  }

  // 1. Infer topic_category
  if (!enrichedVariant.metadata.topic_category || enrichedVariant.metadata.topic_category === 'General') {
    enrichedVariant.metadata.topic_category = inferTopicCategory(enrichedVariant);
  }

  // 2. Set default complexity if not provided
  if (!enrichedVariant.metadata.time_complexity || enrichedVariant.metadata.time_complexity === 'O(...)') {
    enrichedVariant.metadata.time_complexity = 'O(N)';
  }
  if (!enrichedVariant.metadata.space_complexity || enrichedVariant.metadata.space_complexity === 'O(...)') {
    enrichedVariant.metadata.space_complexity = 'O(1)';
  }

  // 4. Assign expected_solve_time_minutes
  if (!enrichedVariant.metadata.expected_solve_time_minutes) {
    switch (enrichedVariant.difficulty) {
      case 'Easy':
        enrichedVariant.metadata.expected_solve_time_minutes = 7;
        break;
      case 'Medium':
        enrichedVariant.metadata.expected_solve_time_minutes = 15;
        break;
      case 'Hard':
        enrichedVariant.metadata.expected_solve_time_minutes = 30;
        break;
      default:
        enrichedVariant.metadata.expected_solve_time_minutes = 15;
    }
  }

  // 5. Build mastery_indicators array
  if (!Array.isArray(enrichedVariant.metadata.mastery_indicators) || enrichedVariant.metadata.mastery_indicators.length === 0) {
    const commonIndicators = [
      "Handles edge cases consistently",
      "Understands time-space trade-offs",
      "Knows optimal algorithmic patterns",
      "Implements input parsing cleanly",
      "Avoids off-by-one errors",
      "Understands recursion depth limits",
      "Applies appropriate data structures",
      "Identifies problem type correctly"
    ];
    // Select a random subset of 3-6 indicators
    const selectedIndicators = [];
    const numIndicators = Math.floor(Math.random() * 4) + 3; // 3 to 6 indicators
    const shuffled = commonIndicators.sort(() => 0.5 - Math.random());
    for (let i = 0; i < numIndicators && i < shuffled.length; i++) {
      selectedIndicators.push(shuffled[i]);
    }
    enrichedVariant.metadata.mastery_indicators = selectedIndicators;
  }

  return enrichedVariant;
}

// Default system prompt (used by Gemini and others)
const systemPrompt =
  "You are a JSON generator for DSA interview questions.\nCRITICAL RULES:\n1. Output ONLY valid JSON object\n2. No markdown, no code blocks, no explanations\n3. Include all required fields exactly as specified\n4. Keep responses concise but complete\n5. Start with { and end with }"

// ✨ Mistral-specific creative system prompt
const mistralCreativeSystemPrompt =
  "You are an expert at crafting CREATIVE, IMAGINATIVE, and UNIQUE DSA interview questions.\n\nYour mission:\n1. Generate DIVERSE problems with STORY-BASED contexts (space exploration, game mechanics, real-world scenarios, etc.)\n2. Use UNUSUAL constraints and creative edge cases\n3. Make each question feel FRESH and ENGAGING\n4. Output ONLY valid JSON (no markdown, no explanations)\n5. Be BOLD with problem themes while maintaining technical rigor\n\nExamples of creative contexts:\n- Drone delivery routing in futuristic cities\n- Pirate treasure maps with constraints\n- Time-travel paradoxes in arrays\n- Planetary mining robot algorithms\n- Cybersecurity intrusion detection\n- DNA sequence analysis\n- Game leaderboard optimizations\n\nDiversity is KEY. Never repeat problem patterns. Think outside the box!"

// ✨ Mistral-specific creative prompt template
const mistralCreativePromptTemplate = (topic: string, difficulty?: string, count: number = 3) => {
  const difficultyLevels = ['Easy', 'Medium', 'Hard'];
  const selectedDifficulties = [];
  for (let i = 0; i < count; i++) {
    selectedDifficulties.push(difficulty || difficultyLevels[Math.floor(Math.random() * difficultyLevels.length)]);
  }

  return `🎯 CREATIVE CHALLENGE: Generate ${count} UNIQUE, IMAGINATIVE DSA interview questions about ${topic}.

🌟 CREATIVITY REQUIREMENTS:
- Use STORY-BASED or REAL-WORLD contexts (space missions, game mechanics, cybersecurity, biology, finance, etc.)
- Make problems feel FRESH and ENGAGING
- Use UNUSUAL constraints and creative edge cases
- Each variant must be COMPLETELY DIFFERENT in theme, story, and approach

📚 EXAMPLE OF CREATIVE APPROACH (for inspiration - DO NOT copy):
Instead of "Find target in sorted array", create:
"A space station's cargo bay has numbered containers sorted by weight. Given a manifest ID, locate which container holds it. Containers may drift during transport, but their relative order stays intact."

Return ONLY this JSON structure with NO other text:
{
  "variants": [
    {
      "title": "🎨 CREATIVE story-based title for variant 1",
      "description": "Engaging problem description with creative context. Example: 'You are managing a futuristic drone delivery system...' Include example input/output.",
      "input_format": "N\\narr[1..N]\\nT",
      "output_format": "Single integer: result description",
      "constraints": "1 <= N <= 10^3\\n-10^9 <= arr[i] <= 10^9",
      "test_cases": {
        "sample_input": "5\\n1 3 5 7 9\\n5",
        "sample_output": "2",
        "hidden_inputs": [
          "5\\n2 4 6 8 10\\n8",
          "4\\n1 1 1 1\\n1"
        ],
        "hidden_outputs": [
          "3",
          "0"
        ]
      },
      "difficulty": "${selectedDifficulties[0]}",
      "tags": ["${topic.toLowerCase()}", "creative_tag_1", "creative_tag_2"],
      "metadata": {
        "topic_category": "Arrays",
        "companies": ["Google", "Amazon"],
        "subtopics": ["Relevant subtopic 1", "Relevant subtopic 2"],
        "prerequisites": ["Basic Operations"],
        "time_complexity": "O(N)",
        "space_complexity": "O(1)",
        "common_approaches": ["Approach 1"],
        "common_mistakes": ["Mistake 1", "Mistake 2"],
        "interview_frequency": "Medium",
        "mastery_indicators": {
          "solve_time_threshold": 10,
          "code_quality_patterns": ["Pattern 1"],
          "optimization_awareness": "Understanding"
        },
        "expected_solve_time_minutes": 10
      },
      "hint": "Creative hint related to the story context"
    }
  ]
}

🚀 NOW CREATE ${count} VARIANTS - Make each one WILDLY DIFFERENT with creative contexts!`;
};

// Default prompt template (used by Gemini and others)
const promptTemplate = (topic: string, difficulty?: string, count: number = 3) => {
  const difficultyLevels = ['Easy', 'Medium', 'Hard'];
  const selectedDifficulties = [];
  for (let i = 0; i < count; i++) {
    selectedDifficulties.push(difficulty || difficultyLevels[Math.floor(Math.random() * difficultyLevels.length)]);
  }

  return `Generate ${count} variants of a DSA interview question about ${topic}. Each variant must have unique constraints, input/output sizes, edge-case behavior, test cases, and a correct Python solution.

Return ONLY this JSON structure with NO other text:
{
  "variants": [
    {
      "title": "Problem title for variant 1",
      "description": "Clear problem statement for variant 1, including example input/output.",
      "input_format": "N\\narr[1..N]\\nT",
      "output_format": "Single integer: index of target (or -1 if not found)",
      "constraints": "1 <= N <= 10^3\\n-10^9 <= arr[i] <= 10^9",
      "test_cases": {
        "sample_input": "5\\n1 3 5 7 9\\n5",
        "sample_output": "2",
        "hidden_inputs": [
          "5\\n2 4 6 8 10\\n8",
          "4\\n1 1 1 1\\n1"
        ],
        "hidden_outputs": [
          "3",
          "0"
        ]
      },
      "difficulty": "${selectedDifficulties[0]}",
      "tags": ["${topic.toLowerCase()}", "Array", "Searching"],
      "metadata": {
        "topic_category": "Arrays",
        "companies": ["Google", "Amazon"],
        "subtopics": ["Array Traversal", "Linear Search"],
        "prerequisites": ["Basic Array Operations"],
        "time_complexity": "O(N)",
        "space_complexity": "O(1)",
        "common_approaches": ["Linear Scan"],
        "common_mistakes": ["Off-by-one errors", "Not handling target absence"],
        "interview_frequency": "Low",
        "mastery_indicators": {
          "solve_time_threshold": 10,
          "code_quality_patterns": ["Clear variable naming", "Correct loop bounds"],
          "optimization_awareness": "Understanding of basic search efficiency"
        },
        "expected_solve_time_minutes": 10
      },
      "hint": "Iterate through the array to find the target element."
    },
    {
      "title": "Problem title for variant 2",
      "description": "Clear problem statement for variant 2, including example input/output.",
      "input_format": "First line: integer N (size of array)\\nSecond line: N space-separated integers (array A)\\nThird line: integer T (target value)",
      "output_format": "Single integer: 0-based index of target (or -1 if not found)",
      "constraints": "1 <= N <= 10^5\\n-10^9 <= A[i] <= 10^9\\n-10^9 <= T <= 10^9\\nArray A is sorted in ascending order.",
      "test_cases": {
        "sample_input": "3\\n10 20 30\\n20",
        "sample_output": "1",
        "hidden_inputs": [
          "7\\n1 2 3 4 5 6 7\\n9",
          "1\\n50\\n50"
        ],
        "hidden_outputs": [
          "-1",
          "0"
        ]
      },
      "difficulty": "${selectedDifficulties[1]}",
      "tags": ["${topic.toLowerCase()}", "Array", "Searching", "Binary Search"],
      "metadata": {
        "topic_category": "Searching",
        "companies": ["Amazon", "Microsoft"],
        "subtopics": ["Binary Search", "Divide and Conquer"],
        "prerequisites": ["Sorted Arrays", "Logarithmic Complexity"],
        "time_complexity": "O(log N)",
        "space_complexity": "O(1)",
        "common_approaches": ["Binary Search"],
        "common_mistakes": ["Incorrect mid calculation", "Infinite loops", "Off-by-one errors in bounds"],
        "interview_frequency": "Medium",
        "mastery_indicators": {
          "solve_time_threshold": 20,
          "code_quality_patterns": ["Efficient use of pointers", "Optimal time complexity"],
          "optimization_awareness": "Understanding of O(N) vs O(log N) approach"
        },
        "expected_solve_time_minutes": 20
      },
      "hint": "Utilize the sorted nature of the array to reduce search space efficiently."
    }
    ${count > 2 ? `,
    {
      "title": "Problem title for variant 3",
      "description": "Clear problem statement for variant 3, including example input/output.",
      "input_format": "First line: integer N (size of array)\\nSecond line: N space-separated integers (array A)\\nThird line: integer T (target value)",
      "output_format": "Single integer: 0-based index of target (or -1 if not found)",
      "constraints": "1 <= N <= 10^6\\n-10^9 <= A[i] <= 10^9\\n-10^9 <= T <= 10^9\\nArray A is sorted in ascending order, may contain duplicates.",
      "test_cases": {
        "sample_input": "4\\n100 200 300 400\\n300",
        "sample_output": "2",
        "hidden_inputs": [
          "2\\n-5 -10\\n-5",
          "5\\n1 1 1 1 1\\n2"
        ],
        "hidden_outputs": [
          "0",
          "-1"
        ]
      },
      "difficulty": "${selectedDifficulties[2]}",
      "tags": ["${topic.toLowerCase()}", "Array", "Searching", "Binary Search", "Edge Cases"],
      "metadata": {
        "topic_category": "Searching",
        "companies": ["Google", "Meta", "Apple"],
        "subtopics": ["Binary Search Variants", "Handling Duplicates"],
        "prerequisites": ["Advanced Binary Search", "Array Manipulation"],
        "time_complexity": "O(log N)",
        "space_complexity": "O(1)",
        "common_approaches": ["Binary Search (modified)"],
        "common_mistakes": ["Incorrect handling of duplicates", "Edge cases with single element arrays"],
        "interview_frequency": "High",
        "mastery_indicators": {
          "solve_time_threshold": 35,
          "code_quality_patterns": ["Robust error handling", "Optimized memory usage", "Clear logic for duplicates"],
          "optimization_awareness": "Handling very large inputs and duplicate values efficiently"
        },
        "expected_solve_time_minutes": 35
      },
      "hint": "Consider how duplicates affect binary search and adjust your logic to find the correct index."
    }` : ''}
  ]
}

CRITICAL: Generate ${count} variants. Each variant must be unique in constraints, input/output sizes, edge-case behavior, and test cases. Ensure all test_cases follow Judge0 formatting rules: raw newlines (\\n), no escaped newlines (\\\\n), hidden_inputs as array of raw input strings, no stringified arrays, hidden_outputs as plain strings matching expected output. Input/output formats and constraints must be structured. No markdown, no code blocks, no explanations outside the JSON. Valid JSON.`;
};

async function oneTry(temp: number, topic: string, difficulty?: string, selectedAIModel?: string, apiKey?: string, count: number = 3) {
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

  // ✨ Use Mistral-specific creative prompts for Mistral
  const isMistral = provider === 'mistral';
  const selectedSystemPrompt = isMistral ? mistralCreativeSystemPrompt : systemPrompt;
  const selectedPromptTemplate = isMistral ? mistralCreativePromptTemplate : promptTemplate;

  try {
    const text = await callAIProviderWithFallback(
      providerConfig,
      selectedPromptTemplate(topic, difficulty, count),
      selectedSystemPrompt,
      temp // Pass temperature to utils
    );

    if (!text) {
      throw new Error("Failed to generate text from AI provider.");
    }

    const trimmed = text.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed.variants || !Array.isArray(parsed.variants)) {
        throw new Error("AI response missing 'variants' array.");
      }
      return parsed;
    } catch {
      const extracted = extractJSONObject(trimmed);
      const parsed = JSON.parse(extracted);
      if (!parsed.variants || !Array.isArray(parsed.variants)) {
        throw new Error("AI response missing 'variants' array after extraction.");
      }
      return parsed;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes('overloaded')) {
      console.warn("⏳ Gemini overloaded, waiting 2 seconds before retry...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      throw error;
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
      count = 3, // Default to 3 variants
      temperature = 0.7,
      difficulty,
      selectedAIModel,
      apiKey
    } = body

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

    console.log(`📝 Generating ${count} variants for ${topic} with ${selectedAIModel}...`)

    await resetProblemsSequence();
    
    if (typeof count !== "number" || count < 1 || count > 5) // Allow 1-5 variants
      return NextResponse.json({ error: "Invalid 'count'. Must be 1..5 for variants" }, { status: 400 })

    const inserted: any[] = []
    const errors: any[] = []

    let responseObj: any;
    try {
      responseObj = await oneTry(temperature, topic, difficulty, selectedAIModel, apiKey, count);
    } catch (err1) {
      console.error(`❌ First attempt failed for generating variants:`, err1);
      
      // ✨ For Mistral, MAINTAIN high temperature for creativity on retry
      const provider = getProviderFromModel(selectedAIModel);
      const retryTemp = provider === 'mistral' 
        ? temperature // Keep original temperature for Mistral
        : Math.max(0, temperature - 0.1); // Reduce for others (Gemini)
      
      console.log(`🔄 Retrying with temperature: ${retryTemp} (provider: ${provider})`);
      responseObj = await oneTry(retryTemp, topic, difficulty, selectedAIModel, apiKey, count);
    }

    if (!responseObj || !responseObj.variants || !Array.isArray(responseObj.variants)) {
      throw new Error("AI response did not contain a valid 'variants' array.");
    }

    for (let i = 0; i < responseObj.variants.length; i++) {
      let variant = responseObj.variants[i];
      try {
        console.log(`🔄 Processing variant ${i + 1}/${responseObj.variants.length}...`);

        // Basic validation for each variant
        if (!variant?.title || !variant?.difficulty || !variant?.description || !variant?.metadata || !variant?.test_cases) {
          throw new Error(`Variant ${i + 1} missing required fields.`);
        }

        // Apply robust validation and auto-fix
        variant = validateAndFixVariant(variant);

        // Enrich metadata
        variant = enrichMetadata(variant);

        // Re-validate after fixing, especially critical fields
        const tc = variant.test_cases;
        if (!tc || typeof tc !== 'object') {
          throw new Error(`Variant ${i + 1} test_cases is malformed after fix.`);
        }
        if (typeof tc.sample_input !== 'string' || tc.sample_input.includes('\\\\n')) {
          throw new Error(`Variant ${i + 1} sample_input has escaped newlines or is not a string after fix.`);
        }
        if (!Array.isArray(tc.hidden_inputs) || tc.hidden_inputs.some((input: any) => typeof input !== 'string' || input.includes('\\\\n'))) {
          throw new Error(`Variant ${i + 1} hidden_inputs contains non-strings, escaped newlines, or is not an array after fix.`);
        }
        if (!Array.isArray(tc.hidden_outputs) || tc.hidden_outputs.some((output: any) => typeof output !== 'string')) {
          throw new Error(`Variant ${i + 1} hidden_outputs contains non-strings or is not an array after fix.`);
        }
        if (!variant.metadata?.topic_category || !variant.metadata?.time_complexity || !variant.metadata?.space_complexity || !variant.metadata?.expected_solve_time_minutes || !Array.isArray(variant.metadata?.mastery_indicators) || variant.metadata.mastery_indicators.length === 0) {
          console.warn(`⚠️ Variant ${i + 1} metadata is incomplete after enrichment:`, variant.metadata);
          // Optionally throw an error here if metadata is strictly required
        }


        const row = await insertQuestion({
          title: variant.title,
          difficulty: variant.difficulty,
          question: variant.description, // Maps to 'description' column
          input_format: variant.input_format,
          output_format: variant.output_format,
          constraints: variant.constraints,
          sample_input: tc.sample_input,
          sample_output: tc.sample_output,
          hint: variant.hint,
          hidden_inputs: tc.hidden_inputs,
          hidden_outputs: tc.hidden_outputs,
          metadata: variant.metadata,
        });

        console.log(`✅ Variant ${i + 1} generated and saved with ID: ${row.id}`);
        inserted.push({ id: row.id, title: row.title });
      } catch (e: any) {
        console.error(`❌ Error processing variant ${i + 1}:`, e?.message);
        errors.push({ variant: i + 1, error: e?.message || String(e) });
      }
    }

    const message = `Inserted ${inserted.length} of ${responseObj.variants.length}${errors.length ? `, ${errors.length} failed` : ""}.`
    console.log(`📊 Generation complete:`, message)
    return NextResponse.json({ message, inserted, errors }, { status: inserted.length ? 201 : 500 })
  } catch (err: any) {
    console.error("❌ generate-question fatal:", err)
    return NextResponse.json({ message: "Internal Server Error", error: err?.message }, { status: 500 })
  }
}
