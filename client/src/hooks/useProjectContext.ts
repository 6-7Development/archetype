import { useContext, createContext, useCallback, useState, useEffect } from 'react';

interface ProjectContextType {
  projectId: string | null;
  refreshKey: number;
  setProjectId: (id: string | null) => void;
  forceRefresh: () => void;
}

export const ProjectContext = createContext<ProjectContextType | null>(null);

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within ProjectProvider');
  }
  return context;
}

export function useProjectProvider(initialProjectId: string | null) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [refreshKey, setRefreshKey] = useState(0);

  // Detect actual project ID changes and force refresh
  useEffect(() => {
    if (projectId !== initialProjectId) {
      console.log('[PROJECT-CONTEXT] 🔄 Project changed:', initialProjectId, '→', projectId);
      forceRefresh();
    }
  }, [projectId, initialProjectId]);

  const forceRefresh = useCallback(() => {
    console.log('[PROJECT-CONTEXT] ⚡ Force refresh triggered');
    setRefreshKey(prev => prev + 1);
  }, []);

  return {
    projectId: projectId || initialProjectId,
    refreshKey,
    setProjectId,
    forceRefresh,
  };
}
