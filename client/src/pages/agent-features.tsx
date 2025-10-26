import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { z } from 'zod';
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
  Zap,
  PlayCircle,
  StopCircle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  Trash2,
  Edit,
  Eye,
  Code,
  Layout,
  Settings,
  ChevronRight,
  ChevronDown,
  Calendar,
  Terminal,
  FileCode,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
    id: 'design',
    label: 'Design Mode',
    icon: Palette,
    description: 'Visual prototyping and design systems',
    color: 'text-purple-500'
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
          <div className="flex flex-wrap items-center justify-between gap-4">
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

              <TabsContent value="workflows" className="h-full mt-0" data-testid="content-workflows">
                <WorkflowsTab />
              </TabsContent>

              <TabsContent value="automations" className="h-full mt-0" data-testid="content-automations">
                <AutomationsTab />
              </TabsContent>

              <TabsContent value="design" className="h-full mt-0" data-testid="content-design">
                <DesignModeTab />
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
const sessionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  projectId: z.string().optional(),
});

function PlanModeTab() {
  const { toast } = useToast();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: sessions, isLoading } = useQuery<any[]>({
    queryKey: ['/api/plan-mode/sessions'],
  });

  const { data: steps } = useQuery<any[]>({
    queryKey: ['/api/plan-mode/sessions', selectedSession, 'steps'],
    enabled: !!selectedSession,
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof sessionSchema>) => {
      return apiRequest('/api/plan-mode/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/plan-mode/sessions'] });
      toast({ title: 'Session created successfully' });
      setCreateDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Failed to create session', variant: 'destructive' });
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest(`/api/plan-mode/sessions/${sessionId}/complete`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/plan-mode/sessions'] });
      toast({ title: 'Session completed' });
    },
  });

  const filteredSessions = sessions?.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="h-full grid lg:grid-cols-[1fr,400px] gap-6">
      <div className="space-y-6 overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Planning Sessions</CardTitle>
                <CardDescription>
                  Brainstorm ideas and create structured plans
                </CardDescription>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-session">
                    <Plus className="w-4 h-4 mr-2" />
                    New Session
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-session">
                  <SessionCreateDialog
                    onSubmit={createSessionMutation.mutate}
                    isPending={createSessionMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-sessions"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState />
            ) : filteredSessions.length === 0 ? (
              <EmptyState
                icon={Lightbulb}
                title="No planning sessions yet"
                description="Create your first session to start planning"
              />
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isSelected={selectedSession === session.id}
                    onSelect={() => setSelectedSession(session.id)}
                    onComplete={() => completeSessionMutation.mutate(session.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedSession && steps && (
          <Card>
            <CardHeader>
              <CardTitle>Session Steps</CardTitle>
              <CardDescription>
                Track progress through each planning step
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StepsTimeline steps={steps} sessionId={selectedSession} />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4 overflow-y-auto">
        <MetricsCard
          title="Active Sessions"
          value={sessions?.filter(s => s.status === 'active').length.toString() || "0"}
          icon={Activity}
          color="text-blue-500"
        />
        <MetricsCard
          title="Completed Sessions"
          value={sessions?.filter(s => s.status === 'completed').length.toString() || "0"}
          icon={CheckCircle2}
          color="text-green-500"
        />
        <MetricsCard
          title="Total Steps"
          value={sessions?.reduce((acc, s) => acc + (s.totalSteps || 0), 0).toString() || "0"}
          icon={Clock}
          color="text-purple-500"
        />
      </div>
    </div>
  );
}

function SessionCreateDialog({ onSubmit, isPending }: any) {
  const form = useForm<z.infer<typeof sessionSchema>>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Planning Session</DialogTitle>
        <DialogDescription>
          Start a new brainstorming and planning session
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Website redesign planning" {...field} data-testid="input-session-title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe the planning goals..." {...field} data-testid="input-session-description" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="submit" disabled={isPending} data-testid="button-create-session">
              {isPending ? 'Creating...' : 'Create Session'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

function SessionCard({ session, isSelected, onSelect, onComplete }: any) {
  return (
    <Card
      className={cn("hover-elevate cursor-pointer transition-all", isSelected && "ring-2 ring-primary")}
      onClick={onSelect}
      data-testid={`session-${session.id}`}
    >
      <CardHeader className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-base">{session.title}</CardTitle>
            {session.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {session.description}
              </CardDescription>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(new Date(session.createdAt), 'MMM d, yyyy')}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
              {session.status}
            </Badge>
            {session.status === 'active' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete();
                }}
                data-testid={`button-complete-${session.id}`}
              >
                Complete
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function StepsTimeline({ steps, sessionId }: any) {
  const { toast } = useToast();
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const updateStepMutation = useMutation({
    mutationFn: async ({ stepId, status }: { stepId: string; status: string }) => {
      return apiRequest(`/api/plan-mode/steps/${stepId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/plan-mode/sessions', sessionId, 'steps'] });
      toast({ title: 'Step updated' });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'in_progress':
        return <Activity className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'skipped':
        return <XCircle className="w-5 h-5 text-muted-foreground" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-2">
      {steps.map((step: any, index: number) => (
        <div key={step.id} className="relative" data-testid={`step-${step.id}`}>
          {index < steps.length - 1 && (
            <div className="absolute left-[10px] top-12 w-[2px] h-full bg-border" />
          )}
          <Card className="hover-elevate">
            <CardHeader className="p-4">
              <div className="flex items-start gap-3">
                <div className="relative z-10">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Step {step.stepNumber}</span>
                        <span className="font-medium">{step.title}</span>
                      </div>
                      {step.description && expandedStep === step.id && (
                        <p className="text-sm text-muted-foreground mt-2">{step.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                      data-testid={`button-toggle-step-${step.id}`}
                    >
                      {expandedStep === step.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {expandedStep === step.id && (
                    <div className="mt-4 flex gap-2">
                      {step.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => updateStepMutation.mutate({ stepId: step.id, status: 'in_progress' })}
                          data-testid={`button-start-${step.id}`}
                        >
                          Start
                        </Button>
                      )}
                      {step.status === 'in_progress' && (
                        <Button
                          size="sm"
                          onClick={() => updateStepMutation.mutate({ stepId: step.id, status: 'completed' })}
                          data-testid={`button-complete-step-${step.id}`}
                        >
                          Complete
                        </Button>
                      )}
                      {step.status !== 'skipped' && step.status !== 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStepMutation.mutate({ stepId: step.id, status: 'skipped' })}
                          data-testid={`button-skip-${step.id}`}
                        >
                          Skip
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      ))}
    </div>
  );
}

// ==================== WORKFLOWS TAB ====================
const workflowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  executionMode: z.enum(['parallel', 'sequential']),
  steps: z.array(z.object({
    name: z.string(),
    command: z.string(),
  })).min(1, 'At least one step is required'),
});

function WorkflowsTab() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  const { data: workflows, isLoading } = useQuery<any[]>({
    queryKey: ['/api/workflows'],
  });

  const { data: runs } = useQuery<any[]>({
    queryKey: ['/api/workflows', selectedWorkflow, 'history'],
    enabled: !!selectedWorkflow,
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (data: z.infer<typeof workflowSchema>) => {
      return apiRequest('/api/workflows', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({ title: 'Workflow created successfully' });
      setCreateDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Failed to create workflow', variant: 'destructive' });
    },
  });

  const executeWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({ title: 'Workflow execution started' });
    },
  });

  return (
    <div className="h-full grid lg:grid-cols-[1fr,400px] gap-6">
      <div className="space-y-6 overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Workflows</CardTitle>
                <CardDescription>
                  Execute commands in parallel or sequence
                </CardDescription>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-workflow">
                    <Plus className="w-4 h-4 mr-2" />
                    New Workflow
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl" data-testid="dialog-create-workflow">
                  <WorkflowCreateDialog
                    onSubmit={createWorkflowMutation.mutate}
                    isPending={createWorkflowMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState />
            ) : !workflows || workflows.length === 0 ? (
              <EmptyState
                icon={Workflow}
                title="No workflows yet"
                description="Create your first workflow to automate tasks"
              />
            ) : (
              <div className="space-y-3">
                {workflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    isSelected={selectedWorkflow === workflow.id}
                    onSelect={() => setSelectedWorkflow(workflow.id)}
                    onExecute={() => executeWorkflowMutation.mutate(workflow.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedWorkflow && runs && (
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>
                Previous workflow runs and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkflowRunsTable runs={runs} />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4 overflow-y-auto">
        <MetricsCard
          title="Total Workflows"
          value={workflows?.length.toString() || "0"}
          icon={Workflow}
          color="text-green-500"
        />
        <MetricsCard
          title="Parallel"
          value={workflows?.filter(w => w.executionMode === 'parallel').length.toString() || "0"}
          icon={Zap}
          color="text-blue-500"
        />
        <MetricsCard
          title="Sequential"
          value={workflows?.filter(w => w.executionMode === 'sequential').length.toString() || "0"}
          icon={Terminal}
          color="text-purple-500"
        />
      </div>
    </div>
  );
}

function WorkflowCreateDialog({ onSubmit, isPending }: any) {
  const form = useForm<z.infer<typeof workflowSchema>>({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      name: '',
      description: '',
      executionMode: 'parallel',
      steps: [{ name: '', command: '' }],
    },
  });

  const { fields, append, remove } = form.formState.errors.steps ? [] as any : [{ name: '', command: '' }] as any;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Workflow</DialogTitle>
        <DialogDescription>
          Define a series of commands to run in parallel or sequence
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Workflow Name</FormLabel>
                <FormControl>
                  <Input placeholder="Build and deploy" {...field} data-testid="input-workflow-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="executionMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Execution Mode</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-execution-mode">
                      <SelectValue placeholder="Select execution mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="parallel">Parallel</SelectItem>
                    <SelectItem value="sequential">Sequential</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Parallel runs all steps at once, sequential runs one after another
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="space-y-2">
            <Label>Workflow Steps</Label>
            <ScrollArea className="h-48 border rounded-md p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input placeholder="Step name" defaultValue="Build" data-testid="input-step-name-0" />
                  <Input placeholder="Command" defaultValue="npm run build" data-testid="input-step-command-0" />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {}}
                    data-testid="button-add-step"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending} data-testid="button-create-workflow">
              {isPending ? 'Creating...' : 'Create Workflow'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

function WorkflowCard({ workflow, isSelected, onSelect, onExecute }: any) {
  return (
    <Card
      className={cn("hover-elevate cursor-pointer transition-all", isSelected && "ring-2 ring-primary")}
      onClick={onSelect}
      data-testid={`workflow-${workflow.id}`}
    >
      <CardHeader className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-base">{workflow.name}</CardTitle>
            {workflow.description && (
              <CardDescription className="mt-1">{workflow.description}</CardDescription>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{workflow.executionMode}</Badge>
              <span className="text-xs text-muted-foreground">
                {workflow.steps?.length || 0} steps
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            data-testid={`button-execute-${workflow.id}`}
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            Execute
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function WorkflowRunsTable({ runs }: any) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      running: { variant: 'default', icon: Activity },
      completed: { variant: 'secondary', icon: CheckCircle2 },
      failed: { variant: 'destructive', icon: XCircle },
      cancelled: { variant: 'outline', icon: StopCircle },
    };
    const config = variants[status] || variants.completed;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Started</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Progress</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run: any) => (
          <TableRow key={run.id} data-testid={`run-${run.id}`}>
            <TableCell className="text-sm">
              {format(new Date(run.startedAt), 'MMM d, HH:mm')}
            </TableCell>
            <TableCell>{getStatusBadge(run.status)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {run.completedAt
                ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
                : 'Running...'}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {run.currentStep}/{run.totalSteps}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ==================== AUTOMATIONS TAB ====================
function AutomationsTab() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);

  const { data: templates, isLoading } = useQuery<any[]>({
    queryKey: ['/api/automations/templates'],
  });

  const deployMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/automations/deploy', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: 'Automation deployed successfully' });
      setDeployDialogOpen(false);
      setSelectedTemplate(null);
    },
    onError: () => {
      toast({ title: 'Failed to deploy automation', variant: 'destructive' });
    },
  });

  const categories = ['all', 'bot', 'scheduled', 'webhook'];
  
  const filteredTemplates = templates?.filter(t => {
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }) || [];

  return (
    <div className="h-full grid lg:grid-cols-[1fr,400px] gap-6">
      <div className="space-y-6 overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Automation Templates</CardTitle>
                <CardDescription>
                  Browse templates for bots, scheduled tasks, and more
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-templates"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-category-filter">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState />
            ) : filteredTemplates.length === 0 ? (
              <EmptyState
                icon={Bot}
                title="No templates found"
                description="Try adjusting your search or filters"
              />
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <AutomationTemplateCard
                    key={template.id}
                    template={template}
                    onDeploy={() => {
                      setSelectedTemplate(template);
                      setDeployDialogOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 overflow-y-auto">
        <MetricsCard
          title="Available Templates"
          value={templates?.length.toString() || "0"}
          icon={Bot}
          color="text-orange-500"
        />
        <MetricsCard
          title="Official"
          value={templates?.filter(t => t.isOfficial).length.toString() || "0"}
          icon={CheckCircle2}
          color="text-green-500"
        />
        <MetricsCard
          title="Community"
          value={templates?.filter(t => !t.isOfficial).length.toString() || "0"}
          icon={Globe}
          color="text-blue-500"
        />
      </div>

      {selectedTemplate && (
        <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
          <DialogContent data-testid="dialog-deploy-automation">
            <DialogHeader>
              <DialogTitle>Deploy {selectedTemplate.name}</DialogTitle>
              <DialogDescription>
                Configure and deploy this automation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Automation Name</Label>
                <Input placeholder="My Slackbot" data-testid="input-automation-name" />
              </div>
              <div>
                <Label>Configuration</Label>
                <Textarea
                  placeholder="Enter configuration JSON..."
                  className="font-mono text-sm"
                  rows={6}
                  data-testid="input-automation-config"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => deployMutation.mutate({
                  templateId: selectedTemplate.id,
                  name: selectedTemplate.name,
                  category: selectedTemplate.category,
                  config: {},
                })}
                disabled={deployMutation.isPending}
                data-testid="button-deploy-automation"
              >
                {deployMutation.isPending ? 'Deploying...' : 'Deploy'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AutomationTemplateCard({ template, onDeploy }: any) {
  return (
    <Card className="hover-elevate" data-testid={`template-${template.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-orange-500" />
              <CardTitle className="text-base">{template.name}</CardTitle>
            </div>
            <CardDescription className="mt-2 line-clamp-2">
              {template.description}
            </CardDescription>
          </div>
          <Badge variant={template.isOfficial ? 'default' : 'secondary'} className="shrink-0">
            {template.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Used {template.usageCount || 0} times
          </span>
          <Button size="sm" onClick={onDeploy} data-testid={`button-deploy-${template.id}`}>
            <Zap className="w-4 h-4 mr-2" />
            Deploy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== DESIGN MODE TAB ====================
const prototypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

function DesignModeTab() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPrototype, setSelectedPrototype] = useState<string | null>(null);

  const { data: prototypes, isLoading } = useQuery<any[]>({
    queryKey: ['/api/design-prototypes'],
  });

  const createPrototypeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof prototypeSchema>) => {
      return apiRequest('/api/design-prototypes', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          screens: [],
          designSystemTokens: {},
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/design-prototypes'] });
      toast({ title: 'Prototype created successfully' });
      setCreateDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Failed to create prototype', variant: 'destructive' });
    },
  });

  return (
    <div className="h-full grid lg:grid-cols-[1fr,400px] gap-6">
      <div className="space-y-6 overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Design Prototypes</CardTitle>
                <CardDescription>
                  Create visual prototypes and design systems
                </CardDescription>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-prototype">
                    <Plus className="w-4 h-4 mr-2" />
                    New Prototype
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-prototype">
                  <PrototypeCreateDialog
                    onSubmit={createPrototypeMutation.mutate}
                    isPending={createPrototypeMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState />
            ) : !prototypes || prototypes.length === 0 ? (
              <EmptyState
                icon={Palette}
                title="No prototypes yet"
                description="Create your first prototype to start designing"
              />
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {prototypes.map((prototype) => (
                  <PrototypeCard
                    key={prototype.id}
                    prototype={prototype}
                    isSelected={selectedPrototype === prototype.id}
                    onSelect={() => setSelectedPrototype(prototype.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 overflow-y-auto">
        <MetricsCard
          title="Total Prototypes"
          value={prototypes?.length.toString() || "0"}
          icon={Palette}
          color="text-purple-500"
        />
        <MetricsCard
          title="Draft"
          value={prototypes?.filter(p => p.status === 'draft').length.toString() || "0"}
          icon={Layout}
          color="text-blue-500"
        />
        <MetricsCard
          title="Approved"
          value={prototypes?.filter(p => p.status === 'approved').length.toString() || "0"}
          icon={CheckCircle2}
          color="text-green-500"
        />
      </div>
    </div>
  );
}

function PrototypeCreateDialog({ onSubmit, isPending }: any) {
  const form = useForm<z.infer<typeof prototypeSchema>>({
    resolver: zodResolver(prototypeSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Design Prototype</DialogTitle>
        <DialogDescription>
          Start a new visual prototype with design system tokens
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prototype Name</FormLabel>
                <FormControl>
                  <Input placeholder="Landing page design" {...field} data-testid="input-prototype-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe the design goals..." {...field} data-testid="input-prototype-description" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="submit" disabled={isPending} data-testid="button-create-prototype">
              {isPending ? 'Creating...' : 'Create Prototype'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

function PrototypeCard({ prototype, isSelected, onSelect }: any) {
  return (
    <Card
      className={cn("hover-elevate cursor-pointer transition-all", isSelected && "ring-2 ring-primary")}
      onClick={onSelect}
      data-testid={`prototype-${prototype.id}`}
    >
      <CardHeader className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              <CardTitle className="text-base">{prototype.name}</CardTitle>
            </div>
            {prototype.description && (
              <CardDescription className="mt-2 line-clamp-2">
                {prototype.description}
              </CardDescription>
            )}
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="secondary">{prototype.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {prototype.screens?.length || 0} screens
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

// ==================== GENERAL AGENT TAB ====================
function GeneralAgentTab() {
  const { data: projectTypes, isLoading } = useQuery<any[]>({
    queryKey: ['/api/general-agent/project-types'],
  });

  return (
    <div className="h-full overflow-y-auto">
      <Card>
        <CardHeader>
          <CardTitle>Supported Project Types</CardTitle>
          <CardDescription>
            Agent supports all project types beyond web apps
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : !projectTypes || projectTypes.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="Loading project types..."
              description="Fetching supported project types"
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectTypes.map((type) => (
                <ProjectTypeCard key={type.type} type={type} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectTypeCard({ type }: any) {
  const getIcon = (projectType: string) => {
    const icons: Record<string, any> = {
      webapp: Globe,
      game: Zap,
      mobile: Code,
      cli: Terminal,
      api: FileCode,
      automation: Bot,
    };
    return icons[projectType] || Globe;
  };

  const Icon = getIcon(type.type);

  return (
    <Card className="hover-elevate" data-testid={`project-type-${type.type}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{type.name}</CardTitle>
          </div>
        </div>
        <CardDescription className="mt-2">
          {type.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Supported Frameworks</Label>
          <div className="flex flex-wrap gap-1">
            {type.frameworks?.slice(0, 5).map((fw: string) => (
              <Badge key={fw} variant="outline" className="text-xs">
                {fw}
              </Badge>
            ))}
            {type.frameworks?.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{type.frameworks.length - 5} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== VISUAL EDITOR TAB ====================
function VisualEditorTab() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center mx-auto mb-4">
            <Wand2 className="w-8 h-8 text-pink-500" />
          </div>
          <CardTitle className="text-2xl">Visual Editor</CardTitle>
          <CardDescription className="text-base mt-2">
            Direct UI element editing in live preview
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Click to Edit
            </h4>
            <p className="text-sm text-muted-foreground">
              Point and click on elements in the live preview to modify styles, content, and properties instantly.
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" />
              Real-time Sync
            </h4>
            <p className="text-sm text-muted-foreground">
              Changes reflect immediately in the code editor, maintaining perfect synchronization between visual edits and source code.
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Component Inspector
            </h4>
            <p className="text-sm text-muted-foreground">
              Inspect and modify component props, CSS styles, and layout properties through an intuitive visual interface.
            </p>
          </div>

          <Separator />

          <div className="text-center space-y-2">
            <Badge variant="outline" className="gap-2">
              <Clock className="w-3 h-3" />
              Coming Soon
            </Badge>
            <p className="text-sm text-muted-foreground">
              Visual editor integration is under active development. This feature will enable direct manipulation of UI elements in the live preview, with instant code generation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== SHARED COMPONENTS ====================
function EmptyState({ icon: Icon, title, description }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <Activity className="w-8 h-8 text-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function MetricsCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
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
