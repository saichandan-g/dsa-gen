"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalQuestions: 0,
    byDifficulty: { Easy: 0, Medium: 0, Hard: 0 },
    byTopic: {}
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // This would be replaced with an actual API call to get stats
        // For now, we'll simulate some data
        setTimeout(() => {
          setStats({
            totalQuestions: 42,
            byDifficulty: { Easy: 15, Medium: 20, Hard: 7 },
            byTopic: {
              "Arrays": 10,
              "Binary Search": 8,
              "Dynamic Programming": 12,
              "Graphs": 6,
              "Trees": 6
            }
          })
          setIsLoading(false)
        }, 1000)
      } catch (err) {
        setError("Failed to load dashboard statistics")
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center items-center">
          <p>Loading dashboard statistics...</p>
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
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Overview of your DSA question database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold">{stats.totalQuestions}</div>
                <p className="text-muted-foreground">Total Questions</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between">
                  <div>
                    <div className="text-green-500 font-bold">{stats.byDifficulty.Easy}</div>
                    <p className="text-muted-foreground">Easy</p>
                  </div>
                  <div>
                    <div className="text-yellow-500 font-bold">{stats.byDifficulty.Medium}</div>
                    <p className="text-muted-foreground">Medium</p>
                  </div>
                  <div>
                    <div className="text-red-500 font-bold">{stats.byDifficulty.Hard}</div>
                    <p className="text-muted-foreground">Hard</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 flex justify-center items-center">
                <Button asChild>
                  <Link href="/admin/generate">Generate New Questions</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Questions by Topic</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(stats.byTopic).map(([topic, count]) => (
              <Card key={topic}>
                <CardContent className="p-4">
                  <div className="font-bold">{topic}</div>
                  <div className="text-muted-foreground">{count} questions</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/admin/generate">Generate Questions</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/questions">View All Questions</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/api-docs">API Documentation</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}