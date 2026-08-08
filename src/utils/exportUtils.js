/**
 * Utility functions for rendering DOM elements (SVG, HTML Tables) to PNG Data URLs
 * for export through ExportManager.
 */

export async function svgElementToPngDataUrl(svgElement) {
  if (!svgElement || !(svgElement instanceof SVGElement)) {
    throw new Error("Invalid SVG element provided for image export.");
  }

  const clonedSvg = svgElement.cloneNode(true);
  if (!clonedSvg.getAttribute("xmlns")) {
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const rect = svgElement.getBoundingClientRect();
  const width = Math.ceil(rect.width || svgElement.viewBox?.baseVal?.width || 800);
  const height = Math.ceil(rect.height || svgElement.viewBox?.baseVal?.height || 600);
  clonedSvg.setAttribute("width", String(width));
  clonedSvg.setAttribute("height", String(height));

  const svgString = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = 2; // 2x resolution for high DPI crisp export
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG image for export."));
    };
    img.src = url;
  });
}

export async function tableElementToPngDataUrl(tableElement) {
  if (!tableElement) {
    throw new Error("Invalid Table element provided for image export.");
  }

  const targetTable = tableElement.tagName === "TABLE" ? tableElement : tableElement.querySelector("table") || tableElement;
  const rect = targetTable.getBoundingClientRect();
  const width = Math.max(Math.ceil(rect.width), 400);
  const height = Math.max(Math.ceil(rect.height), 120);

  const clone = targetTable.cloneNode(true);
  const wrapperHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="background: #ffffff; color: #0f172a; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; box-sizing: border-box;">
          <style>
            table { width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.5; color: #0f172a; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background: #f8fafc; font-weight: 600; color: #1e293b; }
            tr:nth-child(even) { background: #f1f5f9; }
          </style>
          ${clone.outerHTML}
        </div>
      </foreignObject>
    </svg>
  `;

  const blob = new Blob([wrapperHtml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render table image for export."));
    };
    img.src = url;
  });
}
