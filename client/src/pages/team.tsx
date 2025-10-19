import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Crown, Edit, Eye, Trash2, UserPlus, Mail, Copy, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TeamWorkspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

interface TeamMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
  user?: {
    id: string;
    email: string;
  };
}

interface TeamInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: 'editor' | 'viewer';
  token: string;
  expiresAt: string;
  createdAt: string;
}

const ROLE_INFO = {
  owner: { label: "Owner", icon: Crown, color: "default" as const, description: "Full access and team management" },
  editor: { label: "Editor", icon: Edit, color: "default" as const, description: "Can create and edit projects" },
  viewer: { label: "Viewer", icon: Eye, color: "secondary" as const, description: "View-only access" },
};

export default function TeamWorkspace() {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [teamName, setTeamName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data: workspaces, isLoading: workspacesLoading } = useQuery<TeamWorkspace[]>({
    queryKey: ["/api/teams/workspaces"],
  });

  const { data: members, isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/teams/members"],
    enabled: !!workspaces && workspaces.length > 0,
  });

  const { data: invitations, isLoading: invitationsLoading } = useQuery<TeamInvitation[]>({
    queryKey: ["/api/teams/invitations"],
    enabled: !!workspaces && workspaces.length > 0,
  });

  const createWorkspace = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/teams/workspaces", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/workspaces"] });
      setShowCreateDialog(false);
      setTeamName("");
      toast({
        title: "Team created",
        description: "Your team workspace has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create team workspace",
        variant: "destructive",
      });
    },
  });

  const inviteMember = useMutation({
    mutationFn: async ({ workspaceId, email, role }: { workspaceId: string; email: string; role: 'editor' | 'viewer' }) => {
      return await apiRequest("POST", "/api/teams/invitations", { workspaceId, email, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/invitations"] });
      setShowInviteDialog(false);
      setInviteEmail("");
      toast({
        title: "Invitation sent",
        description: "Team invitation has been sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const removeMember = useMutation({
    mutationFn: async ({ workspaceId, userId }: { workspaceId: string; userId: string }) => {
      return await apiRequest("DELETE", `/api/teams/workspaces/${workspaceId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/members"] });
      toast({
        title: "Member removed",
        description: "Team member has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  const cancelInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      return await apiRequest("DELETE", `/api/teams/invitations/${invitationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/invitations"] });
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled.",
      });
    },
  });

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/team/join/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast({
      title: "Link copied",
      description: "Invitation link copied to clipboard",
    });
  };

  const activeWorkspace = workspaces?.[0];

  return (
    <div className="flex-1 overflow-y-auto p-6" data-testid="page-team">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-team-title">Team Workspace</h1>
            <p className="text-muted-foreground">
              Collaborate with your team on projects
            </p>
          </div>
          {!activeWorkspace && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-team">
                  <Users className="w-4 h-4 mr-2" />
                  Create Team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Team Workspace</DialogTitle>
                  <DialogDescription>
                    Create a new team to collaborate with others
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="team-name">Team Name</Label>
                    <Input
                      id="team-name"
                      placeholder="My Awesome Team"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      data-testid="input-team-name"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createWorkspace.mutate(teamName)}
                    disabled={!teamName.trim() || createWorkspace.isPending}
                    data-testid="button-create-team-submit"
                  >
                    {createWorkspace.isPending ? "Creating..." : "Create Team"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* No Team State */}
        {!workspacesLoading && !activeWorkspace && (
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No team workspace yet</h3>
              <p className="text-muted-foreground mb-4">
                Create a team workspace to collaborate with others
              </p>
            </CardContent>
          </Card>
        )}

        {/* Active Workspace */}
        {activeWorkspace && (
          <>
            {/* Workspace Info */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      {activeWorkspace.name}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Created {new Date(activeWorkspace.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-invite-member">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                          Send an invitation to collaborate on this workspace
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="invite-email">Email Address</Label>
                          <Input
                            id="invite-email"
                            type="email"
                            placeholder="colleague@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            data-testid="input-invite-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="invite-role">Role</Label>
                          <Select value={inviteRole} onValueChange={(value: 'editor' | 'viewer') => setInviteRole(value)}>
                            <SelectTrigger id="invite-role" data-testid="select-invite-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="editor">Editor - Can create and edit</SelectItem>
                              <SelectItem value="viewer">Viewer - View only</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => inviteMember.mutate({ 
                            workspaceId: activeWorkspace.id, 
                            email: inviteEmail, 
                            role: inviteRole 
                          })}
                          disabled={!inviteEmail.trim() || inviteMember.isPending}
                          data-testid="button-send-invite"
                        >
                          {inviteMember.isPending ? "Sending..." : "Send Invitation"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
            </Card>

            {/* Team Members */}
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  {members?.length || 0} member{members?.length !== 1 ? 's' : ''} in this workspace
                </CardDescription>
              </CardHeader>
              <CardContent>
                {membersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : members && members.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => {
                        const roleInfo = ROLE_INFO[member.role];
                        const RoleIcon = roleInfo.icon;
                        return (
                          <TableRow key={member.id} data-testid={`member-row-${member.id}`}>
                            <TableCell className="font-medium" data-testid={`member-email-${member.id}`}>
                              {member.user?.email || member.userId}
                            </TableCell>
                            <TableCell>
                              <Badge variant={roleInfo.color} className="gap-1" data-testid={`member-role-${member.id}`}>
                                <RoleIcon className="w-3 h-3" />
                                {roleInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`member-joined-${member.id}`}>
                              {new Date(member.joinedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {member.role !== 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMember.mutate({ 
                                    workspaceId: member.workspaceId, 
                                    userId: member.userId 
                                  })}
                                  data-testid={`button-remove-member-${member.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-members">
                    No team members yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Invitations */}
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>
                  Invitations waiting to be accepted
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invitationsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : invitations && invitations.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((invitation) => {
                        const roleInfo = ROLE_INFO[invitation.role];
                        const RoleIcon = roleInfo.icon;
                        return (
                          <TableRow key={invitation.id} data-testid={`invitation-row-${invitation.id}`}>
                            <TableCell className="font-medium" data-testid={`invitation-email-${invitation.id}`}>
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                {invitation.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={roleInfo.color} className="gap-1">
                                <RoleIcon className="w-3 h-3" />
                                {roleInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`invitation-expires-${invitation.id}`}>
                              {new Date(invitation.expiresAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyInviteLink(invitation.token)}
                                  data-testid={`button-copy-link-${invitation.id}`}
                                >
                                  {copiedToken === invitation.token ? (
                                    <>
                                      <CheckCircle2 className="w-4 h-4 mr-2" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copy Link
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => cancelInvitation.mutate(invitation.id)}
                                  data-testid={`button-cancel-invitation-${invitation.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-invitations">
                    No pending invitations
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
