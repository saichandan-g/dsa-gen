"use client"

import { useState, useEffect, type FormEvent } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CodeBlock } from "@/components/ui/code-block"
import Link from "next/link"
import { AIModelSelectionFiltered } from "@/components/AIModelSelectionFiltered"


export default function HomePage() {
  const [topic, setTopic] = useState("Dynamic Programming")
  const [numQuestions, setNumQuestions] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [selectedAIModel, setSelectedAIModel] = useState<string>("");
  const [aiApiKey, setAIApiKey] = useState<string>("");
  
  const handleAIModelSelected = (model: string, apiKey: string) => {
    setSelectedAIModel(model);
    setAIApiKey(apiKey);
  };

  const handleGenerateQuestions = async (event: FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setResults(null)

    if (!selectedAIModel || !aiApiKey) {
      setResults({ error: "Please select an AI model and provide its API key." });
      setIsLoading(false);
      return;
    }

    try {
      const requestBody: any = {
        topic,
        count: numQuestions,
        selectedAIModel,
        apiKey: aiApiKey,
      };

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
          error: data.message || "An error occurred.",
          details: data.errors || data.errorDetails || data.error,
        })
      } else {
        setResults({ success: data.message, data: data.data, errors: data.errors })
      }
    } catch (error: any) {
      setResults({ error: "Failed to fetch: " + error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 min-h-screen bg-background text-foreground">
      <header className="mb-8">
        <h1 className="text-5xl font-bold">DSA Question Platform</h1>
        <p className="text-xl text-muted-foreground mt-2">Manage, document, and generate DSA questions.</p>
      </header>
      <div className="flex flex-wrap gap-4 mb-8">
        <Button asChild>
          <Link href="/admin">Admin Dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/generate">Question Generator</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/questions">View Questions</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/api-docs">API Documentation</Link>
        </Button>
      </div>

      {/* New Section: Generate Questions Form */}
      <section className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Generate Multiple Questions</CardTitle>
            <CardDescription>
              Use the LLM to generate a specified number of questions on a topic and save them to the database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerateQuestions} className="space-y-4">
              <AIModelSelectionFiltered onModelSelected={handleAIModelSelected} />

              {selectedAIModel && aiApiKey && (
                <>
                  <div>
                    <Label htmlFor="topic">Topic</Label>
                    <Input
                      id="topic"
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Graph Traversal, Sorting Algorithms"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="numQuestions">Number of Questions</Label>
                    <Input
                      id="numQuestions"
                      type="number"
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                      min="1"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? "Generating..." : `Generate ${numQuestions} Question(s)`}
                  </Button>
                </>
              )}
            </form>
            {results && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Generation Results:</h3>
                {results.error && (
                  <Card className="bg-destructive/10 border-destructive">
                    <CardContent className="p-4">
                      <p className="text-destructive font-semibold">Error: {results.error}</p>
                      {results.details && <CodeBlock>{JSON.stringify(results.details, null, 2)}</CodeBlock>}
                    </CardContent>
                  </Card>
                )}
                {results.success && (
                  <Card className="bg-green-500/10 border-green-500">
                    <CardContent className="p-4">
                      <p className="text-green-700 dark:text-green-400 font-semibold">{results.success}</p>
                      {results.data && results.data.length > 0 && (
                        <>
                          <p className="mt-2">Successfully generated questions:</p>
                          <CodeBlock>
                            {JSON.stringify(
                              results.data.map((q: any) => ({ id: q.id, title: q.title })),
                              null,
                              2,
                            )}
                          </CodeBlock>
                        </>
                      )}
                      {results.errors && results.errors.length > 0 && (
                        <>
                          <p className="mt-2 text-destructive">Generation failures:</p>
                          <CodeBlock>{JSON.stringify(results.errors, null, 2)}</CodeBlock>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      
      <section className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>About DSA Question Platform</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              This platform allows you to generate, manage, and access high-quality Data Structures and Algorithms (DSA) questions
              using AI. The questions are stored in a database and can be accessed through a RESTful API.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Generate Questions</h3>
                  <p className="text-sm text-muted-foreground">
                    Create custom DSA questions on any topic using AI
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Manage Database</h3>
                  <p className="text-sm text-muted-foreground">
                    View, edit, and organize your question collection
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">API Access</h3>
                  <p className="text-sm text-muted-foreground">
                    Integrate questions with your applications via REST API
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
