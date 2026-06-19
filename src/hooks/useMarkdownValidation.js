import { useEffect, useRef, useState } from "react";
import { validateMarkdownSyntax } from "../utils/markdownValidation";

export function useMarkdownValidation(value, delayMs = 450) {
  const [issues, setIssues] = useState([]);
  const [status, setStatus] = useState("checking");
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const canUseWorkerRef = useRef(true);

  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL("../workers/markdownValidationWorker.js", import.meta.url),
        { type: "module" }
      );
      canUseWorkerRef.current = true;
    } catch {
      workerRef.current = null;
      canUseWorkerRef.current = false;
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus("checking");
    let settled = false;
    let guardTimer;

    const runFallbackValidation = async () => {
      try {
        const nextIssues = await validateMarkdownSyntax(value || "");
        if (requestId !== requestIdRef.current) return;
        settled = true;
        setIssues(nextIssues);
        setStatus("ready");
      } catch {
        if (requestId !== requestIdRef.current) return;
        settled = true;
        setIssues([]);
        setStatus("error");
      }
    };

    if (!worker || !canUseWorkerRef.current) {
      const fallbackTimer = window.setTimeout(() => {
        runFallbackValidation();
      }, delayMs);

      return () => {
        window.clearTimeout(fallbackTimer);
      };
    }

    const handleMessage = (event) => {
      const payload = event.data || {};
      if (payload.requestId !== requestIdRef.current) return;

      settled = true;
      window.clearTimeout(guardTimer);

      if (payload.ok) {
        setIssues(payload.issues || []);
        setStatus("ready");
      } else {
        canUseWorkerRef.current = false;
        runFallbackValidation();
      }
    };

    const handleWorkerError = () => {
      if (requestId !== requestIdRef.current) return;
      settled = true;
      window.clearTimeout(guardTimer);
      canUseWorkerRef.current = false;
      runFallbackValidation();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleWorkerError);
    const timer = window.setTimeout(() => {
      worker.postMessage({ text: value || "", requestId });
    }, delayMs);
    guardTimer = window.setTimeout(() => {
      if (!settled && requestId === requestIdRef.current) {
        canUseWorkerRef.current = false;
        runFallbackValidation();
      }
    }, Math.max(delayMs + 4000, 5000));

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(guardTimer);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleWorkerError);
    };
  }, [delayMs, value]);

  return { issues, status };
}
