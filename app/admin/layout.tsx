"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  const navItems = [
    { name: "Dashboard", path: "/admin" },
    { name: "Generate Questions", path: "/admin/generate" },
    { name: "View Questions", path: "/admin/questions" },
    { name: "Home", path: "/" },
  ]

  return (
    <div className="container mx-auto p-4 min-h-screen bg-background text-foreground">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">DSA Question Admin</h1>
        <p className="text-muted-foreground">
          Manage and generate DSA questions for your platform
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-64">
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-2">
                {navItems.map((item) => (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    className={`block p-2 rounded-md hover:bg-muted transition-colors ${
                      pathname === item.path ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </CardContent>
          </Card>
        </aside>
        
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}