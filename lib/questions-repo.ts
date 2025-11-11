// lib/questions-repo.ts
import { Pool } from "pg"

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
  pool: Pool,
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
    FROM public.questions
    ${where}
    ORDER BY created_at DESC
    LIMIT ${Number.isFinite(opts.limit) ? opts.limit : 200};
  `
  const { rows } = await pool.query(sql, params)
  // Return case-normalized titles to make prompt rules simpler
  return rows.map((r: { title: string }) => (r.title as string).trim())
}
// INSERT and return the auto id
export async function insertQuestion(pool: Pool, q: GeneratedQuestion) {
  const sql = `
    INSERT INTO public.questions
      (title, difficulty, question, input_format, output_format, constraints_text,
       sample_input, sample_output, hint, hidden_inputs, hidden_outputs,
       tags, companies, topic_category, subtopics, metadata)
    VALUES
      ($1, $2::difficulty, $3, $4, $5, $6,
       $7, $8::jsonb, $9, $10::text[], $11::jsonb[],
       $12::text[], $13::text[], $14, $15::text[], $16::jsonb)
    RETURNING id, title, created_at, updated_at
  `

  const m = q.metadata ?? {}
  const params = [
    q.title,
    q.difficulty,
    q.question,
    q.input_format ?? null,
    q.output_format ?? null,
    q.constraints ?? null,              // -> constraints_text
    q.sample_input ?? null,
    q.sample_output ?? null,
    q.hint ?? null,
    q.hidden_inputs ?? null,            // text[]
    q.hidden_outputs ?? null,           // jsonb[]
    m.tags ?? null,                     // text[]
    m.companies ?? null,                // text[]
    m.topic_category ?? null,
    m.subtopics ?? null,                // text[]
    JSON.stringify(m)                   // metadata jsonb
  ]

  const res = await pool.query(sql, params)
  return res.rows[0] as { id: number; title: string; created_at: string; updated_at: string }
}
