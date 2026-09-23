/**
 * Export helpers for Wireframe Studio
 * Serializes GrapesJS canvas DOM to PNG using SVG foreignObject and Canvas 2D
 */

export function createFallbackPng(editor) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");

  // Canvas background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 1200, 800);

  // Border frame
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 1160, 760);

  // Header mockup
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(20, 20, 1160, 60);
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(44, 40, 20, 20);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Wireframe Mockup", 74, 55);

  // Content area
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(60, 120, 1080, 600);
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(60, 120, 1080, 600);

  ctx.fillStyle = "#64748b";
  ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";

  const html = editor?.getHtml?.() || "";
  const hasContent = html.replace(/<[^>]+>/g, "").trim().length > 10;
  ctx.fillText(hasContent ? "Wireframe UI Design" : "Wireframe Artboard", 600, 420);

  return canvas.toDataURL("image/png");
}

export function exportWireframeToPng(editor) {
  return new Promise((resolve) => {
    if (!editor) {
      resolve(createFallbackPng(editor));
      return;
    }

    try {
      const width = 1200;
      const height = 800;

      const frameDoc = editor.Canvas?.getDocument?.();
      const frameBody = frameDoc?.body;
      let bodyXml = "";
      let cssText = editor.getCss?.() || "";

      if (frameDoc && frameBody) {
        // Collect canvas iframe styles
        const styleTags = frameDoc.querySelectorAll("style");
        styleTags.forEach((s) => {
          cssText += "\n" + (s.textContent || "");
        });

        // Clone and sanitize selection markers
        const clone = frameBody.cloneNode(true);
        clone.querySelectorAll(".gjs-selected, .gjs-hovered").forEach((el) => {
          el.classList.remove("gjs-selected", "gjs-hovered");
        });

        const serializer = new XMLSerializer();
        bodyXml = serializer.serializeToString(clone);
      } else {
        const rawHtml = editor.getHtml?.() || "";
        bodyXml = `<div xmlns="http://www.w3.org/1999/xhtml">${rawHtml}</div>`;
      }

      const svgDoc = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff;width:${width}px;height:${height}px;box-sizing:border-box;overflow:hidden;font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
              <style>
                *, *::before, *::after { box-sizing: border-box; }
                body { margin: 0; padding: 24px; background: #ffffff; color: #0f172a; }
                ${cssText}
              </style>
              ${bodyXml}
            </div>
          </foreignObject>
        </svg>
      `.trim();

      const img = new Image();
      const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoc)}`;

      const fallbackTimer = setTimeout(() => {
        resolve(createFallbackPng(editor));
      }, 2000);

      img.onload = () => {
        clearTimeout(fallbackTimer);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(createFallbackPng(editor));
        }
      };

      img.onerror = () => {
        clearTimeout(fallbackTimer);
        resolve(createFallbackPng(editor));
      };

      img.src = dataUri;
    } catch {
      resolve(createFallbackPng(editor));
    }
  });
}
