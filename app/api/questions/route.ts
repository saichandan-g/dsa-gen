import { type NextRequest, NextResponse } from "next/server"
import { query, resetProblemsSequence } from "@/lib/rds"

const API_KEY = process.env.API_KEY

export async function POST(request: NextRequest) {
  const providedApiKey = request.headers.get("x-api-key")

  if (!API_KEY) {
    console.error("API_KEY environment variable is not set.")
    return NextResponse.json({ message: "Server configuration error" }, { status: 500 })
  }

  if (!providedApiKey || providedApiKey !== API_KEY) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Basic validation
    if (!body.id || !body.title || !body.difficulty || !body.question || !body.metadata) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    // Check if question with this ID already exists
    const existingQuestion = await query(
      'SELECT id FROM public.problems WHERE id = $1',
      [body.id]
    )

    if (existingQuestion.rows.length > 0) {
      return NextResponse.json({ message: `Question with ID ${body.id} already exists.` }, { status: 409 })
    }

    // Insert new question
    const insertQuery = `
      INSERT INTO public.problems (
        id, title, difficulty, question, sample_input, sample_output, hint, 
        hidden_inputs, hidden_outputs, metadata, topics, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
    `
    
    const insertParams = [
      body.id,
      body.title,
      body.difficulty,
      body.question,
      body.sample_input || null,
      body.sample_output || null,
      body.hint || null,
      body.hidden_inputs || [],
      body.hidden_outputs || [],
      JSON.stringify(body.metadata),
      JSON.stringify(body.metadata.tags || [])
    ]

    const result = await query(insertQuery, insertParams)

    return NextResponse.json({ message: "Question added successfully", data: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error("Error adding question:", error)
    
    // Handle duplicate key error
    if (error.code === '23505') {
      return NextResponse.json(
        { message: "Duplicate key error. Ensure ID is unique.", errorDetails: error.detail },
        { status: 409 },
      )
    }
    
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const providedApiKey = request.headers.get("x-api-key")

  if (!API_KEY) {
    console.error("API_KEY environment variable is not set.")
    return NextResponse.json({ message: "Server configuration error" }, { status: 500 })
  }

  if (!providedApiKey || providedApiKey !== API_KEY) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const tags = searchParams.get("tags") // e.g., "Array,Binary Search"
    const difficulty = searchParams.get("difficulty") // e.g., "Easy"

    let sql = 'SELECT * FROM public.problems WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (id) {
      sql += ` AND id = $${paramIndex}`
      params.push(parseInt(id))
      paramIndex++
    }

    if (difficulty) {
      sql += ` AND difficulty ILIKE $${paramIndex}`
      params.push(difficulty.trim())
      paramIndex++
    }

    if (tags) {
      // For PostgreSQL, we'll use the topics JSON array
      sql += ` AND topics && $${paramIndex}`
      const tagArray = tags.split(",").map(tag => tag.trim())
      params.push(tagArray)
      paramIndex++
    }

    sql += ' ORDER BY created_at DESC'

    const result = await query(sql, params)

    if (id && result.rows.length === 0) {
      return NextResponse.json({ message: "Question not found" }, { status: 404 })
    }

    return NextResponse.json(result.rows, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching questions:", error)
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 })
  }
}
