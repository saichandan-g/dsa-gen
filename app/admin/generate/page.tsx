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

export default function GenerateQuestionsPage() {
  const [topic, setTopic] = useState("Dynamic Programming")
  const [numQuestions, setNumQuestions] = useState(1)
  const [apiKey, setApiKey] = useState("") 
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [temperature, setTemperature] = useState(0.7)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null)
  
  // Popular DSA topics for quick selection
  const popularTopics = [
    "Arrays", "Linked Lists", "Stacks", "Queues", "Trees", "Binary Search Trees",
    "Heaps", "Graphs", "Hash Tables", "Dynamic Programming", "Greedy Algorithms",
    "Sorting", "Searching", "Recursion", "Backtracking", "Bit Manipulation"
  ]
  
  useEffect(() => {
    // Try to get API key from environment variable
    if (process.env.NEXT_PUBLIC_API_KEY) {
      setApiKey(process.env.NEXT_PUBLIC_API_KEY);
    } 
    // If not available, try to get from localStorage (if user previously entered it)
    else if (typeof window !== 'undefined') {
      const savedApiKey = localStorage.getItem('dsa_api_key');
      if (savedApiKey) {
        setApiKey(savedApiKey);
      }
    }
  }, []);

  // Save API key to localStorage when it changes
  useEffect(() => {
    if (apiKey && typeof window !== 'undefined') {
      localStorage.setItem('dsa_api_key', apiKey);
    }
  }, [apiKey]);

  const handleGenerateQuestions = async (event: FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setResults(null)

    if (!apiKey) {
      setResults({ error: "Your API Key is required to authenticate with your backend." })
      setIsLoading(false)
      return
    }

    try {
      // Prepare request body with all parameters
      const requestBody: any = { 
        topic, 
        count: numQuestions,
        temperature
      };
      
      // Add difficulty if selected
      if (selectedDifficulty) {
        requestBody.difficulty = selectedDifficulty;
      }
      
      const response = await fetch("/api/generate-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate DSA Questions</CardTitle>
          <CardDescription>
            Create high-quality DSA questions using AI and save them to your database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateQuestions} className="space-y-6">
            {/* API Key Section */}
            {!apiKey ? (
              <div className="space-y-2">
                <Label htmlFor="apiKey">Your API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  This is the <code>API_KEY</code> from your .env.local file
                </p>
              </div>
            ) : (
              <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-md border border-green-200 dark:border-green-900">
                <p className="text-sm text-green-700 dark:text-green-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  API Key loaded successfully
                </p>
              </div>
            )}

            {/* Topic Selection */}
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <div className="grid grid-cols-1 gap-4">
                <Input
                  id="topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Binary Search, Dynamic Programming"
                  required
                />
                <div>
                  <Label className="text-sm">Popular Topics</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {popularTopics.map((t) => (
                      <Badge 
                        key={t} 
                        variant={topic === t ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setTopic(t)}
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Generation Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="numQuestions">Number of Questions</Label>
                <Input
                  id="numQuestions"
                  type="number"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, Math.min(10, Number.parseInt(e.target.value, 10) || 1)))}
                  min="1"
                  max="10"
                  required
                />
                <p className="text-xs text-muted-foreground">Maximum: 10 questions per request</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty (Optional)</Label>
                <Select value={selectedDifficulty || ""} onValueChange={setSelectedDifficulty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any difficulty</SelectItem>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="temperature">Creativity (Temperature)</Label>
                <span className="text-sm text-muted-foreground">{temperature.toFixed(1)}</span>
              </div>
              <Slider
                id="temperature"
                min={0.1}
                max={1.0}
                step={0.1}
                value={[temperature]}
                onValueChange={(values) => setTemperature(values[0])}
              />
              <p className="text-xs text-muted-foreground">
                Lower values produce more predictable output, higher values produce more creative output
              </p>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={isLoading || !apiKey} 
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                `Generate ${numQuestions} Question${numQuestions > 1 ? 's' : ''}`
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results.error && (
              <div className="bg-destructive/10 border border-destructive rounded-md p-4">
                <h3 className="text-destructive font-semibold">Error</h3>
                <p>{results.error}</p>
                {results.details && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Details:</h4>
                    <CodeBlock>{JSON.stringify(results.details, null, 2)}</CodeBlock>
                  </div>
                )}
              </div>
            )}
            
            {results.success && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-md border border-green-200 dark:border-green-900">
                  <p className="text-green-700 dark:text-green-400 font-medium">{results.success}</p>
                </div>
                
                {results.data && results.data.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Generated Questions:</h3>
                    <div className="space-y-4">
                      {results.data.map((question: any, index: number) => (
                        <Card key={question.id} className="overflow-hidden">
                          <div className="bg-muted p-3 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{question.id}</Badge>
                              <h4 className="font-medium">{question.title}</h4>
                              <Badge className={
                                question.difficulty === "Easy" ? "bg-green-500" :
                                question.difficulty === "Medium" ? "bg-yellow-500" :
                                "bg-red-500"
                              }>
                                {question.difficulty}
                              </Badge>
                            </div>
                            <Button variant="ghost" size="sm">View Details</Button>
                          </div>
                          <CardContent className="p-3">
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                              {question.question.substring(0, 150)}...
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {question.metadata?.tags.slice(0, 3).map((tag: string) => (
                                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                              ))}
                              {question.metadata?.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{question.metadata.tags.length - 3} more</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                
                {results.errors && results.errors.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-destructive mb-2">Generation Failures:</h3>
                    <CodeBlock>{JSON.stringify(results.errors, null, 2)}</CodeBlock>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
