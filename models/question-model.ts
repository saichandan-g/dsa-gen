import mongoose, { Schema, type Document, models, type Model } from "mongoose"

// Define the structure for metadata
interface IMasteryIndicators {
  solve_time_threshold: number
  code_quality_patterns: string[]
  optimization_awareness: string
}

interface IMetadata {
  tags: string[]
  companies: string[]
  topic_category: string
  subtopics: string[]
  prerequisites: string[]
  time_complexity: string
  space_complexity: string
  expected_solve_time_minutes: number
  common_approaches: string[]
  common_mistakes: string[]
  interview_frequency: string
  mastery_indicators: IMasteryIndicators
}

// Define the structure for a question document
export interface IQuestion extends Document {
  id: number // Custom ID
  title: string
  difficulty: "Easy" | "Medium" | "Hard"
  question: string
  input_format?: string
  output_format?: string
  constraints?: string
  sample_input?: string
  sample_output?: mongoose.Schema.Types.Mixed
  hint?: string
  hidden_inputs?: string[]
  hidden_outputs?: mongoose.Schema.Types.Mixed[]
  metadata: IMetadata
}

const MasteryIndicatorsSchema = new Schema<IMasteryIndicators>(
  {
    solve_time_threshold: { type: Number, required: true },
    code_quality_patterns: { type: [String], required: true },
    optimization_awareness: { type: String, required: true },
  },
  { _id: false },
)

const MetadataSchema = new Schema<IMetadata>(
  {
    tags: { type: [String], required: true },
    companies: { type: [String] },
    topic_category: { type: String, required: true },
    subtopics: { type: [String] },
    prerequisites: { type: [String] },
    time_complexity: { type: String, required: true },
    space_complexity: { type: String, required: true },
    expected_solve_time_minutes: { type: Number, required: true },
    common_approaches: { type: [String] },
    common_mistakes: { type: [String] },
    interview_frequency: { type: String },
    mastery_indicators: { type: MasteryIndicatorsSchema, required: true },
  },
  { _id: false },
)

const QuestionSchema = new Schema<IQuestion>(
  {
    id: { type: Number, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], required: true },
    question: { type: String, required: true, trim: true },
    input_format: { type: String },
    output_format: { type: String },
    constraints: { type: String },
    sample_input: { type: String },
    sample_output: { type: Schema.Types.Mixed },
    hint: { type: String },
    hidden_inputs: { type: [String] },
    hidden_outputs: { type: [Schema.Types.Mixed] },
    metadata: { type: MetadataSchema, required: true },
  },
  { timestamps: true },
)

// Ensure the model is only compiled once
const QuestionModel: Model<IQuestion> = models.Question || mongoose.model<IQuestion>("Question", QuestionSchema)

export default QuestionModel
