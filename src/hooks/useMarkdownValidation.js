import { useEffect, useRef, useState } from "react";

export function useMarkdownValidation(value, delayMs = 450) {
  const [issues, setIssues] = useState([]);
  const [status, setStatus] = useState("idle");
  const workerRef = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../workers/markdownValidationWorker.js", import.meta.url),
      { type: "module" }
    );

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return undefined;

    setStatus("checking");

    const handleMessage = (event) => {
      const payload = event.data || {};
      if (payload.ok) {
        setIssues(payload.issues || []);
        setStatus("ready");
      } else {
        setIssues([]);
        setStatus("error");
      }
    };

    worker.addEventListener("message", handleMessage);
    const timer = window.setTimeout(() => {
      worker.postMessage({ text: value || "" });
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      worker.removeEventListener("message", handleMessage);
    };
  }, [delayMs, value]);

  return { issues, status };
}
