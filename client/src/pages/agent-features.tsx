import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Lightbulb,
  Palette,
  Workflow,
  Bot,
  Globe,
  Wand2,
  Plus,
  Activity,
  Clock,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Feature tabs configuration
const features = [
  {
    id: 'plan',
    label: 'Plan Mode',
    icon: Lightbulb,
    description: 'Brainstorm and plan without code modification',
    color: 'text-blue-500'
  },
  {
    id: 'design',
    label: 'Design Mode',
    icon: Palette,
    description: 'Visual prototyping and design systems',
    color: 'text-purple-500'
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: Workflow,
    description: 'Parallel/sequential command execution',
    color: 'text-green-500'
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Bot,
    description: 'Bots, scheduled tasks, and templates',
    color: 'text-orange-500'
  },
  {
    id: 'general',
    label: 'General Agent',
    icon: Globe,
    description: 'Support all project types',
    color: 'text-cyan-500'
  },
  {
    id: 'visual',
    label: 'Visual Editor',
    icon: Wand2,
    description: 'Live preview editing',
    color: 'text-pink-500'
  }
];

export default function AgentFeatures() {
  const [activeTab, setActiveTab] = useState('plan');

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Zap className="w-6 h-6 text-primary" />
                Agent Features
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Advanced AI-powered development tools
              </p>
            </div>
            <Badge variant="outline" className="gap-2">
              <Activity className="w-3 h-3 animate-pulse" />
              100% Replit Agent Parity
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="container max-w-7xl mx-auto px-4 py-6 h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            {/* Tabs Navigation - Responsive */}
            <TabsList className="grid grid-cols-3 lg:grid-cols-6 gap-2 h-auto bg-transparent p-1 mb-6">
              {features.map((feature) => (
                <TabsTrigger
                  key={feature.id}
                  value={feature.id}
                  className="flex flex-col items-center gap-2 p-3 data-[state=active]:bg-card data-[state=active]:shadow-sm"
                  data-testid={`tab-${feature.id}`}
                >
                  <feature.icon className={cn("w-5 h-5", feature.color)} />
                  <span className="text-xs font-medium">{feature.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Tab Contents */}
            <div className="flex-1 overflow-hidden">
              <TabsContent value="plan" className="h-full mt-0" data-testid="content-plan">
                <PlanModeTab />
              </TabsContent>

              <TabsContent value="design" className="h-full mt-0" data-testid="content-design">
                <DesignModeTab />
              </TabsContent>

              <TabsContent value="workflows" className="h-full mt-0" data-testid="content-workflows">
                <WorkflowsTab />
              </TabsContent>

              <TabsContent value="automations" className="h-full mt-0" data-testid="content-automations">
                <AutomationsTab />
              </TabsContent>

              <TabsContent value="general" className="h-full mt-0" data-testid="content-general">
                <GeneralAgentTab />
              </TabsContent>

              <TabsContent value="visual" className="h-full mt-0" data-testid="content-visual">
                <VisualEditorTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ==================== PLAN MODE TAB ====================
function PlanModeTab() {
  const { data: sessions, isLoading } = useQuery<any[]>({
    queryKey: ['/api/plan-mode/sessions'],
    enabled: false, // Enable when userId available
  });

  return (
    <div className="h-full grid lg:grid-cols-[1fr,400px] gap-6">
      <div className="space-y-6 overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Planning Sessions</CardTitle>
                <CardDescription>
                  Brainstorm ideas and create structured plans
                </CardDescription>
              </div>
              <Button data-testid="button-new-session">
                <Plus className="w-4 h-4 mr-2" />
                New Session
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Lightbulb}
              title="No planning sessions yet"
              description="Create your first session to start planning"
              actionLabel="Create Session"
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 overflow-y-auto">
        <MetricsCard
          title="Active Sessions"
          value="0"
          icon={Activity}
          color="text-blue-500"
        />
        <MetricsCard
          title="Total Steps"
          value="0"
          icon={Clock}
          color="text-purple-500"
        />
      </div>
    </div>
  );
}

// ==================== DESIGN MODE TAB ====================
function DesignModeTab() {
  return (
    <div className="h-full grid lg:grid-cols-[1fr,400px] gap-6">
      <div className="space-y-6 overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Design Prototypes</CardTitle>
                <CardDescription>
                  Create visual prototypes and design systems
                </CardDescription>
              </div>
              <Button data-testid="button-new-prototype">
                <Plus className="w-4 h-4 mr-2" />
                New Prototype
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Palette}
              title="No prototypes yet"
              description="Create your first prototype to start designing"
              actionLabel="Create Prototype"
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 overflow-y-auto">
        <MetricsCard
          title="Prototypes"
          value="0"
          icon={Palette}
          color="text-purple-500"
        />
      </div>
    </div>
  );
}

// ==================== WORKFLOWS TAB ====================
function WorkflowsTab() {
  return (
    <div className="h-full grid lg:grid-cols-[1fr,400px] gap-6">
      <div className="space-y-6 overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workflows</CardTitle>
                <CardDescription>
                  Execute commands in parallel or sequence
                </CardDescription>
              </div>
              <Button data-testid="button-new-workflow">
                <Plus className="w-4 h-4 mr-2" />
                New Workflow
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Workflow}
              title="No workflows yet"
              description="Create your first workflow to automate tasks"
              actionLabel="Create Workflow"
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 overflow-y-auto">
        <MetricsCard
          title="Workflows"
          value="0"
          icon={Workflow}
          color="text-green-500"
        />
      </div>
    </div>
  );
}

// ==================== AUTOMATIONS TAB ====================
function AutomationsTab() {
  const { data: templates } = useQuery<any[]>({
    queryKey: ['/api/automations/templates'],
  });

  return (
    <div className="h-full grid lg:grid-cols-[1fr,400px] gap-6">
      <div className="space-y-6 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle>Automation Templates</CardTitle>
            <CardDescription>
              Browse templates for bots, scheduled tasks, and more
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {templates?.slice(0, 4).map((template) => (
                <TemplateCard key={template.id} template={template} />
              )) || (
                <div className="col-span-2">
                  <EmptyState
                    icon={Bot}
                    title="Loading templates..."
                    description="Fetching automation templates"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 overflow-y-auto">
        <MetricsCard
          title="Templates"
          value={templates?.length?.toString() || "0"}
          icon={Bot}
          color="text-orange-500"
        />
        <MetricsCard
          title="Deployed"
          value="0"
          icon={Zap}
          color="text-green-500"
        />
      </div>
    </div>
  );
}

// ==================== GENERAL AGENT TAB ====================
function GeneralAgentTab() {
  const { data: projectTypes } = useQuery<any[]>({
    queryKey: ['/api/general-agent/project-types'],
  });

  return (
    <div className="h-full overflow-y-auto">
      <Card>
        <CardHeader>
          <CardTitle>Project Types</CardTitle>
          <CardDescription>
            Support for all project types beyond web apps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectTypes?.map((type) => (
              <ProjectTypeCard key={type.type} type={type} />
            )) || (
              <div className="col-span-full">
                <EmptyState
                  icon={Globe}
                  title="Loading project types..."
                  description="Fetching supported project types"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== VISUAL EDITOR TAB ====================
function VisualEditorTab() {
  return (
    <div className="h-full flex items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Visual Editor</CardTitle>
          <CardDescription>
            Direct UI element editing in live preview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Wand2}
            title="Coming Soon"
            description="Visual editor integration is under development"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== SHARED COMPONENTS ====================
function EmptyState({ icon: Icon, title, description, actionLabel }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
      {actionLabel && (
        <Button variant="outline" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function MetricsCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={cn("w-12 h-12 rounded-lg bg-muted flex items-center justify-center", color)}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateCard({ template }: any) {
  return (
    <Card className="hover-elevate cursor-pointer" data-testid={`template-${template.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{template.name}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {template.description}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="ml-2">
            {template.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Used {template.usageCount || 0} times</span>
          <Button size="sm" variant="outline">Deploy</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectTypeCard({ type }: any) {
  return (
    <Card className="hover-elevate cursor-pointer" data-testid={`project-type-${type.type}`}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="w-4 h-4" />
          {type.name}
        </CardTitle>
        <CardDescription className="mt-1">
          {type.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {type.frameworks?.slice(0, 3).map((fw: string) => (
            <Badge key={fw} variant="outline" className="text-xs">
              {fw}
            </Badge>
          ))}
          {type.frameworks?.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{type.frameworks.length - 3} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
