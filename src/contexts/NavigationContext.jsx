import React, { createContext, useContext, useState, useCallback } from "react";

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const [activeView, setActiveView] = useState("editor"); // 'editor' | 'landing' | 'graph' | 'media' | 'git' | 'ai-chat' | 'personas' | 'health' | 'logs'
  const [viewParams, setViewParams] = useState({});

  const navigateTo = useCallback((view, params = {}) => {
    setActiveView(view);
    setViewParams(params);
  }, []);

  const value = {
    activeView,
    viewParams,
    navigateTo,
    setActiveView,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}
