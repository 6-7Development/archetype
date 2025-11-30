import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Blog() {
  const articles = [
    {
      id: 1,
      title: "Getting Started with BeeHive: Your First Project",
      excerpt: "Learn how to create your first project and use AI assistance to build faster",
      date: "November 2025",
      category: "Getting Started",
    },
    {
      id: 2,
      title: "Best Practices for Prompt Engineering with Gemini",
      excerpt: "Discover how to write effective prompts to get the best results from BeeHive",
      date: "November 2025",
      category: "Tips & Tricks",
    },
    {
      id: 3,
      title: "Deploying Your BeeHive Projects to Production",
      excerpt: "Step-by-step guide to deploying your applications with confidence",
      date: "November 2025",
      category: "Deployment",
    },
    {
      id: 4,
      title: "Understanding BeeHive's Architecture and Healing System",
      excerpt: "Deep dive into how BeeHive maintains itself and fixes issues automatically",
      date: "November 2025",
      category: "Technical",
    },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold">Blog</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Latest news, tips, and insights from the BeeHive team
            </p>
          </div>

          {/* Articles Grid */}
          <div className="grid gap-4">
            {articles.map((article) => (
              <Card key={article.id} className="p-6 hover-elevate cursor-pointer">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Badge variant="outline">{article.category}</Badge>
                      <h2 className="text-xl font-semibold">{article.title}</h2>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground mt-1" />
                  </div>
                  <p className="text-muted-foreground">{article.excerpt}</p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-muted-foreground">{article.date}</span>
                    <Button variant="ghost" size="sm">
                      Read More
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Newsletter Signup */}
          <Card className="p-6 bg-primary/5 border-primary/20">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Stay Updated</h3>
              <p className="text-muted-foreground">
                Subscribe to our newsletter to get the latest updates, tips, and announcements
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2 bg-background border rounded-md text-sm"
                />
                <Button variant="default">Subscribe</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
