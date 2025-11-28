/**
 * Hook to check project protection status before making changes
 * Used by HexadAI and users before committing code
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';

export function useProjectProtection(projectId: string) {
  const { toast } = useToast();

  // Get project configuration
  const { data: config, isLoading } = useQuery({
    queryKey: [`/api/projects/${projectId}/config`],
    enabled: !!projectId,
  });

  // Check if file requires approval
  const checkFileMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const response = await fetch(
        `/api/projects/${projectId}/config/protection-status/${encodeURIComponent(filePath)}`
      );
      if (!response.ok) throw new Error('Failed to check protection status');
      return response.json();
    },
  });

  // Validate batch changes
  const validateChangesMutation = useMutation({
    mutationFn: async (files: Array<{ path: string; operation: string }>) => {
      const response = await fetch(`/api/projects/${projectId}/validate-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      if (!response.ok) throw new Error('Failed to validate changes');
      return response.json();
    },
  });

  return {
    config,
    isLoading,
    protectedFiles: config?.protectedFiles || [],
    
    /**
     * Check if a specific file is protected
     */
    isFileProtected: async (filePath: string) => {
      const result = await checkFileMutation.mutateAsync(filePath);
      return result.requiresApproval;
    },

    /**
     * Validate multiple file changes before committing
     */
    validateChanges: async (files: Array<{ path: string; operation: string }>) => {
      const result = await validateChangesMutation.mutateAsync(files);
      
      if (result.blockedChanges?.length > 0) {
        toast({
          title: 'Cannot Apply Changes',
          description: `${result.blockedChanges.length} file(s) are protected`,
          variant: 'destructive',
        });
        return false;
      }

      if (result.changesRequiringApproval?.length > 0) {
        toast({
          title: 'Approval Required',
          description: `${result.changesRequiringApproval.length} file(s) require owner approval`,
          variant: 'default',
        });
      }

      return true;
    },

    /**
     * Check if can modify file without approval
     */
    canModifyFile: (filePath: string) => {
      if (!config?.protectedFiles) return true;
      return !config.protectedFiles.includes(filePath);
    },
  };
}
