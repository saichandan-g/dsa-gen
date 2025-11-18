// lib/questions-repo.ts
import { query } from "./rds"

type GeneratedQuestion = {
  title: string
  difficulty: "Easy" | "Medium" | "Hard"
  question: string
  input_format?: string
  output_format?: string
  constraints?: string
  sample_input?: string
  sample_output?: unknown
  hint?: string
  hidden_inputs?: string[]
  hidden_outputs?: unknown[]
  metadata: {
    tags?: string[]
    companies?: string[]
    topic_category?: string
    subtopics?: string[]
    prerequisites?: string[]
    time_complexity?: string
    space_complexity?: string
    expected_solve_time_minutes?: number
    common_approaches?: string[]
    common_mistakes?: string[]
    interview_frequency?: string
    mastery_indicators?: {
      solve_time_threshold?: number
      code_quality_patterns?: string[]
      optimization_awareness?: string
    }
  }
}
export async function getExistingTitles(
  opts: { topic?: string; difficulty?: "Easy" | "Medium" | "Hard"; limit?: number } = {}
) {
  // Pull the most relevant titles for dedup checks.
  // Prefer same topic_category & difficulty if available in your schema.
  const clauses: string[] = []
  const params: any[] = []
  let i = 1

  if (opts.difficulty) {
    clauses.push(`difficulty = $${i++}::difficulty`)
    params.push(opts.difficulty)
  }
  if (opts.topic) {
    // topic matched either in top-level topic_category or inside metadata JSON
    clauses.push(`(topic_category = $${i} OR (metadata ->> 'topic_category') = $${i})`)
    params.push(opts.topic)
    i++
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""
  const sql = `
    SELECT title
    FROM public.problems
    ${where}
    ORDER BY created_at DESC
    LIMIT ${Number.isFinite(opts.limit) ? opts.limit : 200};
  `
  console.log("Executing SQL:", sql);
  console.log("With params:", params);
  const { rows, error } = await query(sql, params)
  if (error) {
    throw error;
  }
  // Return case-normalized titles to make prompt rules simpler
  return rows.map((r: { title: string }) => (r.title as string).trim())
}
// INSERT and return the auto id
export async function insertQuestion(q: GeneratedQuestion) {
  const sql = `
    INSERT INTO public.problems
      (title, description, difficulty, test_cases, hint, tags, input_format, output_format, constraints, metadata)
    VALUES
      ($1, $2, $3::difficulty, $4::jsonb, $5, $6::text[], $7, $8, $9, $10::jsonb)
    RETURNING id, title, created_at, updated_at
  `

  const m = q.metadata ?? {}
  const testCases = {
    sample_input: q.sample_input,
    sample_output: q.sample_output,
    hidden_inputs: q.hidden_inputs,
    hidden_outputs: q.hidden_outputs,
  }

  const params = [
    q.title,
    q.question, // This maps to the 'description' column
    q.difficulty,
    JSON.stringify(testCases),
    q.hint ?? null,
    m.tags ?? null,
    q.input_format ?? null,
    q.output_format ?? null,
    q.constraints ?? null,
    JSON.stringify(m)
  ]

  const { rows, error } = await query(sql, params)
  if (error) {
    throw error;
  }
  return rows[0] as { id: number; title: string; created_at: string; updated_at: string }
}
