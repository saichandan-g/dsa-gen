"use client"

import { useState, type FormEvent, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CodeBlock } from "@/components/ui/code-block"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { AIModelSelectionFiltered } from "@/components/AIModelSelectionFiltered"

export default function GenerateQuestionsPage() {
  const [topic, setTopic] = useState("Dynamic Programming")
  const [numQuestions, setNumQuestions] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [temperature, setTemperature] = useState(0.7)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null)
  
  // ✅ ADD THESE - AI Model selection state
  const [selectedAIModel, setSelectedAIModel] = useState<string>("")
  const [aiApiKey, setAIApiKey] = useState<string>("")
  const [hasSelectedModel, setHasSelectedModel] = useState(false)
  
  // Popular DSA topics for quick selection
  const popularTopics = [
    "Arrays", "Linked Lists", "Stacks", "Queues", "Trees", "Binary Search Trees",
    "Heaps", "Graphs", "Hash Tables", "Dynamic Programming", "Greedy Algorithms",
    "Sorting", "Searching", "Recursion", "Backtracking", "Bit Manipulation"
  ]

  // ✅ ADD THIS - Handle model selection
  const handleAIModelSelected = (model: string, apiKey: string) => {
    console.log(`✅ Selected AI Model: ${model}`);
    setSelectedAIModel(model);
    setAIApiKey(apiKey);
    setHasSelectedModel(true);
  };

  // ✅ ADD THIS - Show model selection component if not selected yet
  if (!hasSelectedModel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-md">
            <AIModelSelectionFiltered onModelSelected={handleAIModelSelected} />
          </div>
        </div>
      </div>
    )
  }

  const handleGenerateQuestions = async (event: FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setResults(null)

    // ✅ UPDATE THIS - Check for AI model selection
    if (!selectedAIModel || !aiApiKey) {
      setResults({ error: "Please select an AI model and provide its API key." })
      setIsLoading(false)
      return
    }

    try {
      // ✅ UPDATE THIS - Include selectedAIModel and apiKey in request body
      const requestBody: any = { 
        topic, 
        count: numQuestions,
        temperature,
        selectedAIModel,  // ✅ ADD THIS
        apiKey: aiApiKey, // ✅ ADD THIS
      };
      
      // Add difficulty if selected
      if (selectedDifficulty) {
        requestBody.difficulty = selectedDifficulty;
      }
      
      console.log("📤 Sending request with:", {
        topic,
        count: numQuestions,
        temperature,
        model: selectedAIModel,
        difficulty: selectedDifficulty
      });

      const response = await fetch("/api/generate-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        setResults({
          error: data.error || `Error: ${response.status}`,
          details: data.details || null,
        })
        return
      }

      setResults({
        success: true,
        questions: data.questions || [],
        message: `Generated ${(data.questions || []).length} question(s)`,
      })
    } catch (error) {
      setResults({
        error: "Failed to generate questions",
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Advanced DSA Question Generator
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Generate custom Data Structure & Algorithm interview questions with Gemini or Mistral
          </p>
          {/* ✅ ADD THIS - Show selected model */}
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300">
              ✅ Using <strong>{selectedAIModel}</strong> for question generation
              <button
                onClick={() => setHasSelectedModel(false)}
                className="ml-2 text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
              >
                Change Model
              </button>
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Form */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Generation Settings</CardTitle>
                <CardDescription>
                  Configure parameters for question generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerateQuestions} className="space-y-6">
                  {/* Topic Selection */}
                  <div className="space-y-3">
                    <Label htmlFor="topic" className="text-base font-semibold">
                      Topic
                    </Label>
                    <Input
                      id="topic"
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Enter DSA topic (e.g., Dynamic Programming)"
                      className="h-10"
                    />
                    <div className="flex flex-wrap gap-2">
                      {popularTopics.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900"
                          onClick={() => setTopic(t)}
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Number of Questions */}
                  <div className="space-y-3">
                    <Label htmlFor="numQuestions" className="text-base font-semibold">
                      Number of Questions: {numQuestions}
                    </Label>
                    <Slider
                      id="numQuestions"
                      min={1}
                      max={10}
                      step={1}
                      value={[numQuestions]}
                      onValueChange={(value) => setNumQuestions(value[0])}
                      className="h-2"
                    />
                  </div>

                  {/* Difficulty Selection */}
                  <div className="space-y-3">
                    <Label htmlFor="difficulty" className="text-base font-semibold">
                      Difficulty Level (Optional)
                    </Label>
                    <Select value={selectedDifficulty || ""} onValueChange={setSelectedDifficulty}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select difficulty..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Temperature */}
                  <div className="space-y-3">
                    <Label htmlFor="temperature" className="text-base font-semibold">
                      Temperature (Creativity): {temperature.toFixed(1)}
                    </Label>
                    <Slider
                      id="temperature"
                      min={0}
                      max={1}
                      step={0.1}
                      value={[temperature]}
                      onValueChange={(value) => setTemperature(value[0])}
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500">
                      Lower = more focused, Higher = more creative
                    </p>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {isLoading ? "🔄 Generating..." : "✨ Generate Questions"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg h-fit sticky top-8">
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent>
                {!results ? (
                  <p className="text-sm text-gray-500">
                    Configure your settings and click "Generate Questions" to see results here.
                  </p>
                ) : results.error ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-red-600">❌ Error</p>
                    <p className="text-xs text-red-500">{results.error}</p>
                    {results.details && (
                      <p className="text-xs text-red-400 mt-2">{results.details}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-green-600">✅ {results.message}</p>
                    {results.questions && results.questions.length > 0 && (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {results.questions.map((q: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                          >
                            <p className="font-mono text-gray-700 dark:text-gray-300">
                              Q{idx + 1}: {q.question_text?.substring(0, 100)}...
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full Results Display */}
        {results?.questions && results.questions.length > 0 && (
          <Card className="mt-8 shadow-lg">
            <CardHeader>
              <CardTitle>Generated Questions ({results.questions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {results.questions.map((question: any, index: number) => (
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h3 className="font-bold text-lg mb-2">Question {index + 1}</h3>
                    <CodeBlock>{JSON.stringify(question, null, 2)}</CodeBlock>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
