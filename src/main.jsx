import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { ConfirmationProvider } from "./components/ConfirmationProvider.jsx";
import { UIStateProvider } from "./contexts/UIStateContext.jsx";
import "./styles.css";

import { RecordingOverlayApp } from "./components/RecordingOverlayApp.jsx";

const isOverlayWindow = window.location.hash === "#recording-overlay";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isOverlayWindow ? (
      <RecordingOverlayApp />
    ) : (
      <ErrorBoundary label="Notely">
        <ConfirmationProvider>
          <UIStateProvider>
            <App />
          </UIStateProvider>
        </ConfirmationProvider>
      </ErrorBoundary>
    )}
  </React.StrictMode>
);
