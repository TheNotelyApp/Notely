/**
 * Utility functions for rendering DOM elements (SVG, HTML Tables) to PNG Data URLs
 * for export through ExportManager.
 */

function toXhtmlString(htmlString) {
  if (!htmlString) return "";
  let xhtml = String(htmlString)
    .replace(/<(br|img|hr|input|col|link|meta|area|embed|param)([^>]*?)(?<!\/)>/gi, "<$1$2 />")
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
  return xhtml;
}

export async function svgElementToPngDataUrl(svgElement) {
  if (!svgElement || !(svgElement instanceof SVGElement)) {
    throw new Error("Invalid SVG element provided for image export.");
  }

  const clonedSvg = svgElement.cloneNode(true);
  if (!clonedSvg.getAttribute("xmlns")) {
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const rect = svgElement.getBoundingClientRect();
  const width = Math.max(Math.ceil(rect.width || svgElement.viewBox?.baseVal?.width || 800), 100);
  const height = Math.max(Math.ceil(rect.height || svgElement.viewBox?.baseVal?.height || 600), 100);
  clonedSvg.setAttribute("width", String(width));
  clonedSvg.setAttribute("height", String(height));

  const svgString = new XMLSerializer().serializeToString(clonedSvg);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
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
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error("Failed to render SVG image for export."));
    };
    img.src = dataUrl;
  });
}

export async function tableElementToPngDataUrl(tableElement) {
  if (!tableElement) {
    throw new Error("Invalid Table element provided for image export.");
  }

  const targetTable = tableElement.tagName === "TABLE" ? tableElement : tableElement.querySelector("table") || tableElement;
  if (!targetTable || targetTable.tagName !== "TABLE") {
    throw new Error("Invalid Table element provided for image export.");
  }

  const rect = targetTable.getBoundingClientRect();
  const paddingHorizontal = 24;
  const paddingVertical = 24;
  const verticalBuffer = 16;

  const tableWidth = Math.max(Math.ceil(rect.width || targetTable.offsetWidth || 600), 400);
  const tableHeight = Math.max(Math.ceil(rect.height || targetTable.offsetHeight || 200), 80);

  const totalWidth = tableWidth + (paddingHorizontal * 2);
  const totalHeight = tableHeight + (paddingVertical * 2) + verticalBuffer;

  const clone = targetTable.cloneNode(true);
  const cleanedTableHtml = toXhtmlString(clone.outerHTML);

  const wrapperHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="background: #ffffff; color: #0f172a; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: ${paddingVertical}px ${paddingHorizontal}px; box-sizing: border-box; width: 100%; min-height: 100%;">
          <style>
            table { width: 100%; margin: 0; padding: 0; border-collapse: collapse; font-size: 13px; line-height: 1.5; color: #0f172a; background: #ffffff; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; word-break: break-word; }
            th { background: #f8fafc; font-weight: 600; color: #1e293b; }
            tr:nth-child(even) { background: #f1f5f9; }
          </style>
          ${cleanedTableHtml}
        </div>
      </foreignObject>
    </svg>
  `;

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wrapperHtml)}`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = 2;
        canvas.width = totalWidth * scale;
        canvas.height = totalHeight * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, totalWidth, totalHeight);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error("Failed to render table image for export."));
    };
    img.src = dataUrl;
  });
}
