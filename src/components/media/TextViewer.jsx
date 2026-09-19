import { useState, useMemo } from "react";
import { Copy, Check } from "lucide-react";
import AppButton from "../AppButton";
import { dataUrlToUint8Array } from "./mediaUtils";

export function TextViewer({ dataUrl }) {
  const [copied, setCopied] = useState(false);

  const textContent = useMemo(() => {
    if (!dataUrl) return "";
    try {
      const bytes = dataUrlToUint8Array(dataUrl);
      if (!bytes) return "";
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(bytes);
    } catch {
      return "";
    }
  }, [dataUrl]);

  const lines = useMemo(() => textContent.split("\n"), [textContent]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="text-viewer-wrapper">
      <div className="text-viewer-toolbar">
        <span className="text-viewer-meta">{lines.length} lines • {textContent.length} characters</span>
        <AppButton
          variant="small"
          onClick={handleCopy}
          data-tooltip={copied ? "Copied!" : "Copy content"}
          aria-label="Copy text content"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </AppButton>
      </div>
      <div className="text-viewer-content">
        <pre className="text-viewer-pre">
          {lines.map((line, idx) => (
            <div key={`line-${idx}`} className="text-viewer-line">
              <span className="text-viewer-line-num" aria-hidden="true">{idx + 1}</span>
              <span className="text-viewer-line-code">{line || " "}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
