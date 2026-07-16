import { useState, useEffect } from "react";

export function useWorkspaceMetadata() {
  const [metadata, setMetadata] = useState({});

  useEffect(() => {
    let mounted = true;
    
    if (window.notesApi?.getWorkspaceMetadata) {
      window.notesApi.getWorkspaceMetadata().then((data) => {
        if (mounted) setMetadata(data || {});
      });
    }

    let unlisten = () => {};
    if (window.notesApi?.onWorkspaceMetadataChanged) {
      unlisten = window.notesApi.onWorkspaceMetadataChanged((newMetadata) => {
        if (mounted) setMetadata(newMetadata || {});
      });
    }

    return () => {
      mounted = false;
      unlisten();
    };
  }, []);

  const updateMetadata = async (absolutePath, updates) => {
    if (window.notesApi?.updateWorkspaceMetadata) {
      await window.notesApi.updateWorkspaceMetadata({ absolutePath, ...updates });
    }
  };

  const getMetadata = (absolutePath) => {
    // Quick and dirty relative path matcher - we just find the suffix match
    // since the backend sends posix-style relative paths.
    if (!absolutePath) return {};
    const norm = absolutePath.replace(/\\/g, "/");
    for (const [relPath, data] of Object.entries(metadata)) {
      if (norm.endsWith(relPath)) return data;
    }
    return {};
  };

  return { metadata, updateMetadata, getMetadata };
}
