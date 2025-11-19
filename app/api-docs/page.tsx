"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CodeBlock } from "@/components/ui/code-block"

const exampleQuestionJson = `{
  "id": 1,
  "title": "Binary Search",
  "difficulty": "Easy",
  "question": "You are given a sorted array of N integers and a target number T. Implement binary search to find the index of T in the array. If not found, return -1.",
  "input_format": "The first line contains an integer N. The second line contains N space-separated integers in ascending order. The third line contains a single integer T.",
  "output_format": "Return the index (0-based) of the target integer if found. Otherwise, return -1.",
  "constraints": "1 <= N <= 10^5\\n-10^9 <= arr[i], T <= 10^9",
  "sample_input": "5\\n1 3 5 7 9\\n5",
  "sample_output": 2,
  "hint": "Use the divide-and-conquer strategy to minimize time complexity.",
  "hidden_inputs": ["6\\n2 4 6 8 10 12\\n8", "4\\n1 2 3 4\\n7"],
  "hidden_outputs": [3, -1],
  "metadata": {
    "tags": ["Array", "Binary Search", "Divide and Conquer"],
    "companies": ["Google", "Microsoft", "Amazon", "Facebook"],
    "topic_category": "Searching Algorithms",
    "subtopics": ["Array Manipulation", "Two Pointers"],
    "prerequisites": ["Array Basics", "Loop Concepts"],
    "time_complexity": "O(log n)",
    "space_complexity": "O(1)",
    "expected_solve_time_minutes": 15,
    "common_approaches": ["Iterative Binary Search", "Recursive Binary Search"],
    "common_mistakes": [
      "Integer overflow in mid calculation",
      "Incorrect boundary conditions",
      "Off-by-one errors"
    ],
    "interview_frequency": "Very High",
    "mastery_indicators": {
      "solve_time_threshold": 10,
      "code_quality_patterns": ["proper variable names", "edge case handling"],
      "optimization_awareness": "mentions O(log n) complexity"
    }
  }
}`

export default function HomePage() {
  return (
    <div className="container mx-auto p-4 min-h-screen bg-background text-foreground">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">DSA Question API Documentation</h1>
        <p className="text-muted-foreground">
          Securely submit, retrieve, and generate DSA questions with rich metadata.
        </p>
      </header>

      <section className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">1. Database Setup (PostgreSQL/RDS)</h3>
              <p>
                Ensure you have a PostgreSQL database (RDS or local) with the required schema. The application uses
                PostgreSQL as the database backend for storing DSA questions.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold">2. Environment Variables</h3>
              <p>
                Create a <code>.env.local</code> file in the root of your project (if running locally) or set
                environment variables in your Vercel project settings:
              </p>
              <pre className="mt-2 p-2 bg-muted rounded text-sm overflow-x-auto">
                <code>
                  DB_HOST="your-db-host.amazonaws.com"
                  <br />
                  DB_PORT="5432"
                  <br />
                  DB_USER="your-db-username"
                  <br />
                  DB_PASSWORD="your-db-password"
                  <br />
                  DB_NAME="your-db-name"
                  <br />
                  API_KEY="your_secure_api_key"
                  <br />
                  MISTRAL_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxx"
                </code>
              </pre>
              <p className="text-sm text-muted-foreground mt-1">
                Replace placeholders with your actual database credentials, a strong, unique API key, and your Mistral AI API
                key.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>API Endpoint: POST /api/questions</CardTitle>
            <CardDescription>Submit a new DSA question. Requires API key authentication.</CardDescription>
          </CardHeader>
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">Request Headers:</h3>
            <pre className="p-2 bg-muted rounded text-sm overflow-x-auto">
              <code>
                Content-Type: application/json
                <br />
                x-api-key: your_secure_api_key
              </code>
            </pre>

            <h3 className="text-lg font-semibold mt-4 mb-2">Request Body (JSON):</h3>
            <p>Use the following structure for the question object:</p>
            <CodeBlock>{exampleQuestionJson}</CodeBlock>
          </CardContent>
        </Card>
      </section>

      <section className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>API Endpoint: GET /api/questions</CardTitle>
            <CardDescription>Retrieve DSA questions. Requires API key authentication.</CardDescription>
          </CardHeader>
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">Request Headers:</h3>
            <pre className="p-2 bg-muted rounded text-sm overflow-x-auto">
              <code>x-api-key: your_secure_api_key</code>
            </pre>

            <h3 className="text-lg font-semibold mt-4 mb-2">Query Parameters:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <code>id</code> (optional): Fetch a single question by its numeric ID.
              </li>
              <li>
                <code>tags</code> (optional): Comma-separated list of tags (e.g., <code>Array,Binary Search</code>).
                Returns questions matching any of the tags.
              </li>
              <li>
                <code>difficulty</code> (optional): Filter by difficulty (e.g., <code>Easy</code>, <code>Medium</code>,{" "}
                <code>Hard</code>).
              </li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Example Usage:</h3>
            <pre className="mt-2 p-2 bg-muted rounded text-sm overflow-x-auto">
              <code>
                {`curl -X GET \\
  http://localhost:3000/api/questions?difficulty=Easy&tags=Array \\
  -H 'x-api-key: your_secure_api_key'`}
              </code>
            </pre>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>API Endpoint: POST /api/generate-question</CardTitle>
            <CardDescription>
              Generate a new DSA question using LLM and store it. Requires API key authentication.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">Request Headers:</h3>
            <pre className="p-2 bg-muted rounded text-sm overflow-x-auto">
              <code>
                Content-Type: application/json
                <br />
                x-api-key: your_secure_api_key
              </code>
            </pre>

            <h3 className="text-lg font-semibold mt-4 mb-2">Request Body (JSON):</h3>
            <p>Provide the topic for the question generation and optionally the number of questions (count):</p>
            <pre className="mt-2 p-2 bg-muted rounded text-sm overflow-x-auto">
              <code>
                {`{
  "topic": "Dynamic Programming",
  "count": 1 // Optional, defaults to 1 if not provided by API
}`}
              </code>
            </pre>

            <h3 className="text-lg font-semibold mt-4 mb-2">Example Usage:</h3>
            <pre className="mt-2 p-2 bg-muted rounded text-sm overflow-x-auto">
              <code>
                {`curl -X POST \\
  http://localhost:3000/api/generate-question \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: your_secure_api_key' \\
  -d '{ "topic": "Graph Traversal", "count": 3 }'`}
              </code>
            </pre>
            <p className="text-sm text-muted-foreground mt-1">
              Replace <code>http://localhost:3000</code> with your deployed API URL if necessary.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
