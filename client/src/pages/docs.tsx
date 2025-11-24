import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Code2, Zap, Shield } from "lucide-react";

export default function Documentation() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Documentation</h1>
            <p className="text-lg text-muted-foreground">
              Learn how to use LomuAI to build amazing applications with AI assistance
            </p>
          </div>

          {/* Quick Start */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Quick Start Guide</h2>
            </div>
            <div className="space-y-3 text-muted-foreground">
              <p>Get started with LomuAI in just a few minutes:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Create a new project in the Builder</li>
                <li>Write your requirements or let AI generate code</li>
                <li>Use LomuAI Chat for real-time assistance</li>
                <li>Deploy your project with one click</li>
              </ol>
            </div>
          </Card>

          {/* Features */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Key Features</h2>
            </div>
            <div className="grid gap-4">
              <div className="p-4 bg-card/50 rounded-lg">
                <h3 className="font-semibold mb-2">AI-Powered Code Generation</h3>
                <p className="text-sm text-muted-foreground">
                  Gemini 2.5 Flash generates production-ready code with advanced reasoning
                </p>
              </div>
              <div className="p-4 bg-card/50 rounded-lg">
                <h3 className="font-semibold mb-2">Real-time Chat Assistance</h3>
                <p className="text-sm text-muted-foreground">
                  Get instant help with code, debugging, and architectural decisions
                </p>
              </div>
              <div className="p-4 bg-card/50 rounded-lg">
                <h3 className="font-semibold mb-2">One-Click Deployment</h3>
                <p className="text-sm text-muted-foreground">
                  Deploy your applications instantly without DevOps complexity
                </p>
              </div>
            </div>
          </Card>

          {/* API Documentation */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Code2 className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">API Reference</h2>
            </div>
            <p className="text-muted-foreground">
              For detailed API documentation, visit our{" "}
              <a href="/api-reference" className="text-primary hover:underline">
                API Reference
              </a>
              {" "}page
            </p>
          </Card>

          {/* Security */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Security & Compliance</h2>
            </div>
            <div className="space-y-2 text-muted-foreground">
              <p>LomuAI is built with enterprise-grade security:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>End-to-end encryption for sensitive data</li>
                <li>Role-based access control (RBAC)</li>
                <li>Rate limiting and DDoS protection</li>
                <li>Regular security audits</li>
              </ul>
            </div>
          </Card>

          {/* Version Badge */}
          <div className="flex gap-2">
            <Badge variant="default">v1.0.0</Badge>
            <Badge variant="outline">Last Updated: November 2025</Badge>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
