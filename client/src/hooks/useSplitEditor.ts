import { useState, useEffect, useCallback } from "react";
import type { File } from "@shared/schema";

interface SplitEditorState {
  leftFileId: string | null;
  rightFileId: string | null;
  splitEnabled: boolean;
  leftContent: string;
  rightContent: string;
}

const STORAGE_KEY = "beehive-split-editor-state";

export function useSplitEditor(files: File[]) {
  const [state, setState] = useState<SplitEditorState>(() => {
    // Load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          leftFileId: parsed.leftFileId || null,
          rightFileId: parsed.rightFileId || null,
          splitEnabled: parsed.splitEnabled || false,
          leftContent: "",
          rightContent: "",
        };
      }
    } catch (error) {
      console.error("Failed to load split editor state:", error);
    }
    
    return {
      leftFileId: null,
      rightFileId: null,
      splitEnabled: false,
      leftContent: "",
      rightContent: "",
    };
  });

  // Sync content when files change
  useEffect(() => {
    const leftFile = files.find(f => f.id === state.leftFileId);
    const rightFile = files.find(f => f.id === state.rightFileId);
    
    setState(prev => ({
      ...prev,
      leftContent: leftFile?.content || "",
      rightContent: rightFile?.content || "",
    }));
  }, [state.leftFileId, state.rightFileId, files]);

  // Persist to localStorage (exclude content)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        leftFileId: state.leftFileId,
        rightFileId: state.rightFileId,
        splitEnabled: state.splitEnabled,
      }));
    } catch (error) {
      console.error("Failed to save split editor state:", error);
    }
  }, [state.leftFileId, state.rightFileId, state.splitEnabled]);

  const setLeftFile = useCallback((fileId: string | null) => {
    setState(prev => ({ ...prev, leftFileId: fileId }));
  }, []);

  const setRightFile = useCallback((fileId: string | null) => {
    setState(prev => ({ ...prev, rightFileId: fileId }));
  }, []);

  const setLeftContent = useCallback((content: string) => {
    setState(prev => ({ ...prev, leftContent: content }));
  }, []);

  const setRightContent = useCallback((content: string) => {
    setState(prev => ({ ...prev, rightContent: content }));
  }, []);

  const toggleSplit = useCallback(() => {
    setState(prev => ({ ...prev, splitEnabled: !prev.splitEnabled }));
  }, []);

  const getActiveFile = useCallback(() => {
    // Return the left file if it exists, otherwise right file
    return files.find(f => f.id === state.leftFileId) || 
           files.find(f => f.id === state.rightFileId) ||
           null;
  }, [files, state.leftFileId, state.rightFileId]);

  const getModifiedFiles = useCallback(() => {
    const modified: Array<{ id: string; content: string }> = [];
    
    const leftFile = files.find(f => f.id === state.leftFileId);
    if (leftFile && state.leftContent !== leftFile.content) {
      modified.push({ id: leftFile.id, content: state.leftContent });
    }
    
    const rightFile = files.find(f => f.id === state.rightFileId);
    if (rightFile && state.rightContent !== rightFile.content) {
      modified.push({ id: rightFile.id, content: state.rightContent });
    }
    
    return modified;
  }, [files, state]);

  return {
    leftFileId: state.leftFileId,
    rightFileId: state.rightFileId,
    splitEnabled: state.splitEnabled,
    leftContent: state.leftContent,
    rightContent: state.rightContent,
    setLeftFile,
    setRightFile,
    setLeftContent,
    setRightContent,
    toggleSplit,
    getActiveFile,
    getModifiedFiles,
  };
}
