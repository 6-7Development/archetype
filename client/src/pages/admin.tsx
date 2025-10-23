import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Users, DollarSign, Activity, TrendingUp, BarChart3, Clock, Settings, AlertTriangle, CheckCircle, Github } from "lucide-react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  planDistribution: { plan: string; count: number }[];
}

interface UserWithDetails {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
  plan: string | null;
  status: string | null;
  aiCreditsRemaining: number | null;
  currentPeriodEnd: string | null;
}

interface UsageAnalytics {
  monthlyTrends: Array<{
    month: string;
    totalTokens: number;
    totalAICost: number;
    totalRevenue: number;
    totalCost: number;
    overage: number;
  }>;
  topUsers: Array<{
    userId: string;
    email: string;
    totalTokens: number;
    totalCost: number;
  }>;
  usageByType: Array<{
    type: string;
    count: number;
    totalTokens: number;
    totalCost: number;
  }>;
}

interface UsageLog {
  id: string;
  userId: string;
  email: string | null;
  type: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: string;
}

interface MaintenanceModeStatus {
  enabled: boolean;
  reason: string | null;
  enabledAt: string | null;
  enabledBy: string | null;
}

export default function Admin() {
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [maintenanceReason, setMaintenanceReason] = useState<string>("");

  // SECURITY: Redirect if not authenticated or not admin
  if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
    setLocation('/dashboard');
    return null;
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading...</div>
        </div>
      </div>
    );
  }

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery<UserWithDetails[]>({
    queryKey: ["/api/admin/users"],
  });

  // Fetch usage analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery<UsageAnalytics>({
    queryKey: ["/api/admin/analytics"],
  });

  // Fetch usage logs
  const { data: usageLogs, isLoading: logsLoading } = useQuery<UsageLog[]>({
    queryKey: ["/api/admin/usage-logs"],
  });

  // Fetch maintenance mode status
  const { data: maintenanceMode, isLoading: maintenanceModeLoading } = useQuery<MaintenanceModeStatus>({
    queryKey: ["/api/maintenance-mode/status"],
  });

  // Enable maintenance mode mutation
  const enableMaintenanceModeMutation = useMutation({
    mutationFn: async (reason: string) => {
      return await apiRequest("POST", "/api/maintenance-mode/enable", { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-mode/status"] });
      toast({
        title: "Maintenance Mode Enabled",
        description: "Platform modifications will now commit to GitHub",
      });
      setMaintenanceReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to enable maintenance mode",
        variant: "destructive",
      });
    },
  });

  // Disable maintenance mode mutation
  const disableMaintenanceModeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/maintenance-mode/disable", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-mode/status"] });
      toast({
        title: "Maintenance Mode Disabled",
        description: "Platform modifications blocked in production",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disable maintenance mode",
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
      setRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const handleUpdateRole = () => {
    if (selectedUser && newRole) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
    }
  };

  const getPlanBadgeVariant = (plan: string | null) => {
    switch (plan) {
      case "enterprise":
        return "default";
      case "pro":
        return "secondary";
      case "starter":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string | null) => {
    return status === "active" ? "default" : "secondary";
  };

  if (statsLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="admin-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-admin">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, subscriptions, and analytics</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="card-total-users">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-users">
                  {stats?.totalUsers || 0}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-active-subs">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-active-subs">
                  {stats?.activeSubscriptions || 0}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-monthly-revenue">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-monthly-revenue">
                  ${stats?.monthlyRevenue || 0}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-plan-distribution">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Plan Distribution</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground space-y-1">
                  {stats?.planDistribution?.map((item) => (
                    <div key={item.plan} data-testid={`plan-dist-${item.plan}`}>
                      {item.plan}: {item.count}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Maintenance Mode Card - Owner Only */}
          {(user as any)?.isOwner && (
            <Card data-testid="card-maintenance-mode">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Maintenance Mode
                  {maintenanceMode?.enabled ? (
                    <Badge variant="default" className="ml-auto" data-testid="badge-maintenance-enabled">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-auto" data-testid="badge-maintenance-disabled">
                      Disabled
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Control platform modifications on production (GitHub integration)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {maintenanceMode?.enabled ? (
                  <>
                    <div className="rounded-lg bg-primary/10 p-4 space-y-2" data-testid="maintenance-active-info">
                      <div className="flex items-start gap-2">
                        <Github className="h-5 w-5 text-primary mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Platform modifications enabled</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            SySop can now modify platform files. Changes will be committed to GitHub and auto-deployed.
                          </p>
                        </div>
                      </div>
                      {maintenanceMode.reason && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs font-medium">Reason:</p>
                          <p className="text-xs text-muted-foreground">{maintenanceMode.reason}</p>
                        </div>
                      )}
                      {maintenanceMode.enabledAt && (
                        <div className="text-xs text-muted-foreground">
                          Enabled {new Date(maintenanceMode.enabledAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => disableMaintenanceModeMutation.mutate()}
                      disabled={disableMaintenanceModeMutation.isPending}
                      className="w-full"
                      data-testid="button-disable-maintenance"
                    >
                      {disableMaintenanceModeMutation.isPending ? "Disabling..." : "Disable Maintenance Mode"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg bg-muted p-4 space-y-2" data-testid="maintenance-disabled-info">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Platform modifications blocked</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Enable maintenance mode to allow SySop to modify platform files and commit to GitHub.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maintenance-reason">Reason (optional)</Label>
                      <Textarea
                        id="maintenance-reason"
                        placeholder="e.g., Deploying new feature, fixing critical bug..."
                        value={maintenanceReason}
                        onChange={(e) => setMaintenanceReason(e.target.value)}
                        className="resize-none"
                        rows={2}
                        data-testid="input-maintenance-reason"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        const reason = maintenanceReason.trim() || "Platform maintenance in progress";
                        enableMaintenanceModeMutation.mutate(reason);
                      }}
                      disabled={enableMaintenanceModeMutation.isPending}
                      className="w-full"
                      data-testid="button-enable-maintenance"
                    >
                      {enableMaintenanceModeMutation.isPending ? "Enabling..." : "Enable Maintenance Mode"}
                    </Button>
                  </>
                )}
                
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium">How it works:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>Maintenance mode commits platform changes to GitHub</li>
                    <li>Render auto-deploys from GitHub commits</li>
                    <li>Changes persist across container restarts</li>
                    <li>Owner-only access for security</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage user accounts and subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Credits</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell className="font-medium" data-testid={`user-email-${user.id}`}>
                        {user.email}
                      </TableCell>
                      <TableCell data-testid={`user-name-${user.id}`}>
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"} data-testid={`user-role-${user.id}`}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPlanBadgeVariant(user.plan)} data-testid={`user-plan-${user.id}`}>
                          {user.plan || "none"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.status ? (
                          <Badge variant={getStatusBadgeVariant(user.status)} data-testid={`user-status-${user.id}`}>
                            {user.status}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell data-testid={`user-credits-${user.id}`}>
                        {user.aiCreditsRemaining ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewRole(user.role);
                            setRoleDialogOpen(true);
                          }}
                          data-testid={`button-edit-role-${user.id}`}
                        >
                          Edit Role
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading analytics...</div>
            </div>
          ) : (
            <>
              {/* Monthly Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Monthly Usage & Revenue Trends
                  </CardTitle>
                  <CardDescription>Token usage and revenue over the last 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics?.monthlyTrends || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="totalTokens" stroke="#8884d8" name="Tokens" />
                      <Line yAxisId="right" type="monotone" dataKey="totalRevenue" stroke="#82ca9d" name="Revenue ($)" />
                      <Line yAxisId="right" type="monotone" dataKey="totalAICost" stroke="#ffc658" name="AI Cost ($)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Top Users Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Users by Cost</CardTitle>
                    <CardDescription>Users with highest total costs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics?.topUsers?.slice(0, 5) || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="email" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="totalCost" fill="#8884d8" name="Total Cost ($)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Usage by Type Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Usage by Type</CardTitle>
                    <CardDescription>Token usage breakdown by request type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics?.usageByType || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="totalTokens" fill="#82ca9d" name="Tokens" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Usage Logs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Usage Activity
                  </CardTitle>
                  <CardDescription>Latest AI usage requests across all users</CardDescription>
                </CardHeader>
                <CardContent>
                  {logsLoading ? (
                    <div className="text-center py-6 text-muted-foreground">Loading logs...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Input Tokens</TableHead>
                          <TableHead>Output Tokens</TableHead>
                          <TableHead>Total Tokens</TableHead>
                          <TableHead>Cost</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usageLogs?.slice(0, 20).map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.email || log.userId.substring(0, 8)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.type}</Badge>
                            </TableCell>
                            <TableCell>{log.inputTokens.toLocaleString()}</TableCell>
                            <TableCell>{log.outputTokens.toLocaleString()}</TableCell>
                            <TableCell>{log.totalTokens.toLocaleString()}</TableCell>
                            <TableCell>${log.cost.toFixed(4)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Role Update Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent data-testid="dialog-update-role">
          <DialogHeader>
            <DialogTitle>Update User Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user" data-testid="option-role-user">User</SelectItem>
                <SelectItem value="admin" data-testid="option-role-admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              data-testid="button-cancel-role"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={updateRoleMutation.isPending}
              data-testid="button-save-role"
            >
              {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
