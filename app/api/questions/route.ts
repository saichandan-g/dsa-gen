import { type NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import QuestionModel, { type IQuestion } from "@/models/question-model"

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
    await connectDB()
    const body = await request.json()

    // Basic validation (Mongoose will do more detailed validation)
    if (!body.id || !body.title || !body.difficulty || !body.question || !body.metadata) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    // Check if question with this ID already exists
    const existingQuestion = await QuestionModel.findOne({ id: body.id })
    if (existingQuestion) {
      return NextResponse.json({ message: `Question with ID ${body.id} already exists.` }, { status: 409 })
    }

    const newQuestionData = body as IQuestion
    const question = new QuestionModel(newQuestionData)
    await question.save()

    return NextResponse.json({ message: "Question added successfully", data: question }, { status: 201 })
  } catch (error: any) {
    console.error("Error adding question:", error)
    if (error.name === "ValidationError") {
      return NextResponse.json({ message: "Validation Error", errors: error.errors }, { status: 400 })
    }
    if (error.code === 11000) {
      // Duplicate key error (e.g. for unique 'id')
      return NextResponse.json(
        { message: "Duplicate key error. Ensure ID is unique.", errorDetails: error.keyValue },
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
    await connectDB()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const tags = searchParams.get("tags") // e.g., "Array,Binary Search"
    const difficulty = searchParams.get("difficulty") // e.g., "Easy"

    const filter: { [key: string]: any } = {}

    if (id) {
      filter.id = Number.parseInt(id)
    }

    if (tags) {
      // Split tags by comma and use $in operator for multiple tags
      filter["metadata.tags"] = { $in: tags.split(",").map((tag) => new RegExp(tag.trim(), "i")) }
    }

    if (difficulty) {
      // Case-insensitive match for difficulty
      filter.difficulty = new RegExp(difficulty.trim(), "i")
    }

    const questions = await QuestionModel.find(filter)

    if (id && questions.length === 0) {
      return NextResponse.json({ message: "Question not found" }, { status: 404 })
    }

    return NextResponse.json(questions, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching questions:", error)
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 })
  }
}
