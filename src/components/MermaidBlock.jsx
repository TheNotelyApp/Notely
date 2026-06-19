import { useEffect, useState } from "react";
import mermaid from "mermaid";

export function MermaidBlock({ code, index }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${index}-${Math.random().toString(36).slice(2)}`;

    mermaid
      .render(id, code)
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSvg("");
          setError(err?.message || "Unable to render Mermaid diagram.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, index]);

  if (error) {
    return <pre className="diagram-error">{error}</pre>;
  }

  return <div className="mermaid-render" dangerouslySetInnerHTML={{ __html: svg }} />;
}
