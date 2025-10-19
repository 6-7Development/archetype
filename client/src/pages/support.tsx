import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Headphones, Plus, MessageSquare, Clock, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: 'technical' | 'billing' | 'feature_request' | 'bug_report' | 'other';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
}

interface UsageStats {
  subscription: {
    plan: string;
  } | null;
  plan: string;
}

const STATUS_INFO = {
  open: { label: "Open", color: "default" as const },
  in_progress: { label: "In Progress", color: "default" as const },
  resolved: { label: "Resolved", color: "default" as const },
  closed: { label: "Closed", color: "secondary" as const },
};

const PRIORITY_INFO = {
  low: { label: "Low", color: "secondary" as const },
  medium: { label: "Medium", color: "default" as const },
  high: { label: "High", color: "default" as const },
  urgent: { label: "Urgent", color: "destructive" as const },
};

// Support SLA based on plan
const SUPPORT_SLA = {
  free: { responseTime: "48 hours", icon: Clock },
  starter: { responseTime: "48 hours", icon: Clock },
  pro: { responseTime: "24 hours", icon: Clock },
  business: { responseTime: "12 hours", icon: Clock },
  enterprise: { responseTime: "4 hours", icon: Clock },
};

export default function SupportPage() {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<'technical' | 'billing' | 'feature_request' | 'bug_report' | 'other'>('technical');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: stats } = useQuery<UsageStats>({
    queryKey: ["/api/usage/stats"],
  });

  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
  });

  const createTicket = useMutation({
    mutationFn: async (data: { subject: string; description: string; category: string; priority: string }) => {
      return await apiRequest("POST", "/api/support/tickets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setShowCreateDialog(false);
      setSubject("");
      setDescription("");
      setCategory('technical');
      setPriority('medium');
      toast({
        title: "Ticket created",
        description: "Your support ticket has been submitted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create support ticket",
        variant: "destructive",
      });
    },
  });

  const userPlan = stats?.plan || 'free';
  const sla = SUPPORT_SLA[userPlan as keyof typeof SUPPORT_SLA] || SUPPORT_SLA.free;

  return (
    <div className="flex-1 overflow-y-auto p-6" data-testid="page-support">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-support-title">Support</h1>
            <p className="text-muted-foreground">
              Get help from our support team
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-ticket">
                <Plus className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Support Ticket</DialogTitle>
                <DialogDescription>
                  Describe your issue and we'll get back to you within {sla.responseTime}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket-subject">Subject</Label>
                  <Input
                    id="ticket-subject"
                    placeholder="Brief description of your issue"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    data-testid="input-ticket-subject"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket-category">Category</Label>
                  <Select value={category} onValueChange={(value: 'technical' | 'billing' | 'feature_request' | 'bug_report' | 'other') => setCategory(value)}>
                    <SelectTrigger id="ticket-category" data-testid="select-ticket-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technical">Technical Support</SelectItem>
                      <SelectItem value="billing">Billing & Payments</SelectItem>
                      <SelectItem value="feature_request">Feature Request</SelectItem>
                      <SelectItem value="bug_report">Bug Report</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket-description">Description</Label>
                  <Textarea
                    id="ticket-description"
                    placeholder="Provide detailed information about your issue..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    data-testid="input-ticket-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket-priority">Priority</Label>
                  <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') => setPriority(value)}>
                    <SelectTrigger id="ticket-priority" data-testid="select-ticket-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - General question</SelectItem>
                      <SelectItem value="medium">Medium - Standard issue</SelectItem>
                      <SelectItem value="high">High - Important problem</SelectItem>
                      <SelectItem value="urgent">Urgent - Critical issue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createTicket.mutate({ subject, description, category, priority })}
                  disabled={!subject.trim() || !description.trim() || createTicket.isPending}
                  data-testid="button-submit-ticket"
                >
                  {createTicket.isPending ? "Submitting..." : "Submit Ticket"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Support SLA Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-primary" />
              Your Support Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Response Time</p>
                <p className="text-2xl font-bold" data-testid="text-response-time">{sla.responseTime}</p>
              </div>
              <Badge className="text-sm" data-testid="badge-plan">
                {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Plan
              </Badge>
            </div>
            {userPlan === 'free' || userPlan === 'starter' ? (
              <p className="text-sm text-muted-foreground mt-4">
                Upgrade to Pro or higher for faster response times
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Support Tickets */}
        <Card>
          <CardHeader>
            <CardTitle>Your Support Tickets</CardTitle>
            <CardDescription>
              Track the status of your support requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : tickets && tickets.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => {
                    const statusInfo = STATUS_INFO[ticket.status];
                    const priorityInfo = PRIORITY_INFO[ticket.priority];
                    return (
                      <TableRow key={ticket.id} data-testid={`ticket-row-${ticket.id}`}>
                        <TableCell className="font-medium max-w-xs truncate" data-testid={`ticket-subject-${ticket.id}`}>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            {ticket.subject}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.color} data-testid={`ticket-status-${ticket.id}`}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={priorityInfo.color} data-testid={`ticket-priority-${ticket.id}`}>
                            {priorityInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`ticket-created-${ticket.id}`}>
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell data-testid={`ticket-updated-${ticket.id}`}>
                          {new Date(ticket.updatedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12" data-testid="text-no-tickets">
                <Headphones className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No support tickets yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create a ticket if you need help or have questions
                </p>
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  data-testid="button-create-first-ticket"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Ticket
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Resources */}
        <Card>
          <CardHeader>
            <CardTitle>Other Ways to Get Help</CardTitle>
            <CardDescription>
              Quick resources for common questions
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Documentation</h4>
              <p className="text-sm text-muted-foreground">
                Browse our comprehensive guides
              </p>
              <Button variant="outline" size="sm" className="w-full">
                View Docs
              </Button>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Community</h4>
              <p className="text-sm text-muted-foreground">
                Join our community forum
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Join Community
              </Button>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Status Page</h4>
              <p className="text-sm text-muted-foreground">
                Check system status
              </p>
              <Button variant="outline" size="sm" className="w-full">
                View Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
