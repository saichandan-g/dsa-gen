"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/ui/code-block"

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filter, setFilter] = useState({ difficulty: "", topic: "" })
  
  // Get API key from environment or local storage
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dsa_api_key") || process.env.NEXT_PUBLIC_API_KEY || ""
    }
    return process.env.NEXT_PUBLIC_API_KEY || ""
  })

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!apiKey) {
        setError("API key is required to fetch questions")
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch("/api/questions", {
          headers: {
            "x-api-key": apiKey
          }
        })

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        setQuestions(data)
        setIsLoading(false)
      } catch (err: any) {
        setError(err.message || "Failed to fetch questions")
        setIsLoading(false)
      }
    }

    if (apiKey) {
      fetchQuestions()
    } else {
      setIsLoading(false)
    }
  }, [apiKey])

  // Save API key to local storage when it changes
  useEffect(() => {
    if (apiKey && typeof window !== "undefined") {
      localStorage.setItem("dsa_api_key", apiKey)
    }
  }, [apiKey])

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         q.metadata?.topic_category.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesDifficulty = filter.difficulty ? q.difficulty === filter.difficulty : true
    const matchesTopic = filter.topic ? 
      q.metadata?.topic_category.toLowerCase().includes(filter.topic.toLowerCase()) : true
    
    return matchesSearch && matchesDifficulty && matchesTopic
  })

  const handleViewQuestion = (question: any) => {
    setSelectedQuestion(question)
  }

  const difficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "bg-green-500"
      case "Medium": return "bg-yellow-500"
      case "Hard": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center items-center">
          <p>Loading questions...</p>
        </CardContent>
      </Card>
    )
  }

  if (!apiKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Key Required</CardTitle>
          <CardDescription>Please enter your API key to view questions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
              />
              <p className="text-sm text-muted-foreground mt-1">
                This is the API key from your .env.local file
              </p>
            </div>
            <Button onClick={() => setIsLoading(true)}>
              Load Questions
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-8">
          <p className="text-destructive">{error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>DSA Questions</CardTitle>
          <CardDescription>Browse and manage your question database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search by title or topic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="difficulty">Difficulty</Label>
              <select
                id="difficulty"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={filter.difficulty}
                onChange={(e) => setFilter({...filter, difficulty: e.target.value})}
              >
                <option value="">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No questions found matching your criteria
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuestions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell>{question.id}</TableCell>
                      <TableCell>{question.title}</TableCell>
                      <TableCell>
                        <Badge className={difficultyColor(question.difficulty)}>
                          {question.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell>{question.metadata?.topic_category}</TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewQuestion(question)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedQuestion && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{selectedQuestion.title}</CardTitle>
                <div className="flex gap-2 mt-2">
                  <Badge className={difficultyColor(selectedQuestion.difficulty)}>
                    {selectedQuestion.difficulty}
                  </Badge>
                  {selectedQuestion.metadata?.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => setSelectedQuestion(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Problem Statement</h3>
              <p className="whitespace-pre-line">{selectedQuestion.question}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold">Input Format</h3>
                <p className="whitespace-pre-line">{selectedQuestion.input_format}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Output Format</h3>
                <p className="whitespace-pre-line">{selectedQuestion.output_format}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">Constraints</h3>
              <p className="whitespace-pre-line">{selectedQuestion.constraints}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold">Sample Input</h3>
                <CodeBlock>{selectedQuestion.sample_input}</CodeBlock>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Sample Output</h3>
                <CodeBlock>{JSON.stringify(selectedQuestion.sample_output, null, 2)}</CodeBlock>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">Hint</h3>
              <p>{selectedQuestion.hint}</p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">Metadata</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Time Complexity:</strong> {selectedQuestion.metadata?.time_complexity}</p>
                  <p><strong>Space Complexity:</strong> {selectedQuestion.metadata?.space_complexity}</p>
                  <p><strong>Expected Solve Time:</strong> {selectedQuestion.metadata?.expected_solve_time_minutes} minutes</p>
                </div>
                <div>
                  <p><strong>Topic Category:</strong> {selectedQuestion.metadata?.topic_category}</p>
                  <p><strong>Interview Frequency:</strong> {selectedQuestion.metadata?.interview_frequency}</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline">Edit</Button>
              <Button variant="destructive">Delete</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}