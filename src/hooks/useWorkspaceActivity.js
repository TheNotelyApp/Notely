import { useState, useCallback } from "react";
import { getWorkspaceActivity } from "../services/electronService";

export function useWorkspaceActivity({ setError }) {
  const [workspaceActivityOpen, setWorkspaceActivityOpen] = useState(false);
  const [workspaceActivityLoading, setWorkspaceActivityLoading] = useState(false);
  const [workspaceActivity, setWorkspaceActivity] = useState(null);

  const handleOpenWorkspaceActivity = useCallback(async (limit = 100) => {
    setWorkspaceActivityLoading(true);
    try {
      const data = await getWorkspaceActivity({ limit });
      setWorkspaceActivity(data);
      setWorkspaceActivityOpen(true);
    } catch (err) {
      setError(err?.message || "Failed to load workspace activity.");
    } finally {
      setWorkspaceActivityLoading(false);
    }
  }, [setError]);

  return {
    workspaceActivityOpen,
    setWorkspaceActivityOpen,
    workspaceActivityLoading,
    workspaceActivity,
    handleOpenWorkspaceActivity,
  };
}
