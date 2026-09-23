/**
 * Export helpers for Wireframe Studio
 * Serializes GrapesJS canvas DOM to PNG using SVG foreignObject and Canvas 2D
 */

export function createFallbackPng(editor, fallbackWidth = 1200, fallbackHeight = 800) {
  const canvas = document.createElement("canvas");
  const width = Math.max(fallbackWidth || 1200, 400);
  const height = Math.max(fallbackHeight || 800, 400);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Canvas background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // Border frame
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Header mockup
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(20, 20, width - 40, 60);
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(44, 40, 20, 20);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Wireframe Mockup", 74, 55);

  // Content area
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(40, 100, width - 80, height - 140);
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(40, 100, width - 80, height - 140);

  ctx.fillStyle = "#64748b";
  ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";

  const html = editor?.getHtml?.() || "";
  const hasContent = html.replace(/<[^>]+>/g, "").trim().length > 10;
  ctx.fillText(hasContent ? "Wireframe UI Design" : "Wireframe Artboard", width / 2, height / 2);

  return canvas.toDataURL("image/png");
}

export function exportWireframeToPng(editor) {
  return new Promise((resolve) => {
    if (!editor) {
      resolve(createFallbackPng(editor));
      return;
    }

    let fullWidth = 1200;
    let fullHeight = 800;

    try {
      const frameDoc = editor.Canvas?.getDocument?.();
      const frameBody = frameDoc?.body;
      let cssText = editor.getCss?.() || "";
      let contentXml = "";

      if (frameDoc && frameBody) {
        // Collect canvas iframe styles
        const styleTags = frameDoc.querySelectorAll("style");
        styleTags.forEach((s) => {
          cssText += "\n" + (s.textContent || "");
        });

        // Determine device constraints
        const currentDevice = editor.getDevice ? editor.getDevice() : "Desktop";
        let minDeviceWidth = 1200;
        if (currentDevice === "Tablet") minDeviceWidth = 768;
        if (currentDevice === "Mobile") minDeviceWidth = 375;

        // Measure true full height across all rendered elements in the document
        const bodyScrollH = frameBody.scrollHeight || 0;
        const docScrollH = frameDoc.documentElement?.scrollHeight || 0;
        const bodyOffsetH = frameBody.offsetHeight || 0;

        let maxBottom = 0;
        let maxRight = 0;

        const allElements = frameBody.querySelectorAll("*");
        allElements.forEach((el) => {
          const className = el.className;
          if (
            typeof className === "string" &&
            (className.includes("gjs-toolbar") ||
              className.includes("gjs-resizer") ||
              className.includes("gjs-badge"))
          ) {
            return;
          }

          const offsetBottom = (el.offsetTop || 0) + (el.offsetHeight || 0);
          if (offsetBottom > maxBottom) maxBottom = offsetBottom;

          const offsetRight = (el.offsetLeft || 0) + (el.offsetWidth || 0);
          if (offsetRight > maxRight) maxRight = offsetRight;

          try {
            const rect = el.getBoundingClientRect();
            const scrollY = frameDoc.defaultView?.scrollY || 0;
            const scrollX = frameDoc.defaultView?.scrollX || 0;
            const clientBottom = rect.bottom + scrollY;
            const clientRight = rect.right + scrollX;
            if (clientBottom > maxBottom) maxBottom = clientBottom;
            if (clientRight > maxRight) maxRight = clientRight;
          } catch {
            // ignore rect measurement errors
          }
        });

        const computedStyle = frameDoc.defaultView?.getComputedStyle?.(frameBody);
        const paddingBottom = parseInt(computedStyle?.paddingBottom || "40", 10) || 40;
        const paddingTop = parseInt(computedStyle?.paddingTop || "40", 10) || 40;

        fullHeight = Math.ceil(
          Math.max(bodyScrollH, docScrollH, bodyOffsetH, maxBottom + paddingBottom, 600)
        );

        fullWidth = Math.ceil(Math.max(frameBody.scrollWidth || 0, maxRight, minDeviceWidth));

        // Clone and sanitize selection markers & UI overlays
        const clone = frameBody.cloneNode(true);
        clone
          .querySelectorAll(".gjs-selected, .gjs-hovered, .gjs-badge, .gjs-toolbar, .gjs-resizer")
          .forEach((el) => {
            el.classList?.remove("gjs-selected", "gjs-hovered");
            if (
              el.classList?.contains("gjs-toolbar") ||
              el.classList?.contains("gjs-resizer") ||
              el.classList?.contains("gjs-badge")
            ) {
              el.remove();
            }
          });

        const serializer = new XMLSerializer();
        let innerXml = "";
        for (let i = 0; i < clone.childNodes.length; i++) {
          innerXml += serializer.serializeToString(clone.childNodes[i]);
        }

        const sanitizedCss = cssText
          .replace(/\bhtml\s*\{/gi, ".wireframe-export-stage {")
          .replace(/\bbody\s*\{/gi, ".wireframe-export-stage {");

        contentXml = `
          <div xmlns="http://www.w3.org/1999/xhtml" class="wireframe-export-stage" style="background:#f8fafc;width:${fullWidth}px;min-height:${fullHeight}px;padding:${paddingTop}px 24px ${paddingBottom}px;box-sizing:border-box;margin:0;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;color:#0f172a;">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
            <style>
              *, *::before, *::after { box-sizing: border-box; }
              ${sanitizedCss}
            </style>
            ${innerXml}
          </div>
        `.trim();
      } else {
        const rawHtml = editor.getHtml?.() || "";
        contentXml = `
          <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff;width:${fullWidth}px;min-height:${fullHeight}px;padding:24px;box-sizing:border-box;color:#0f172a;font-family:system-ui, sans-serif;">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
            <style>
              *, *::before, *::after { box-sizing: border-box; }
              body { margin: 0; padding: 24px; background: #ffffff; color: #0f172a; }
              ${cssText}
            </style>
            ${rawHtml}
          </div>
        `.trim();
      }

      const svgDoc = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${fullWidth}" height="${fullHeight}" viewBox="0 0 ${fullWidth} ${fullHeight}">
          <foreignObject width="${fullWidth}" height="${fullHeight}">
            ${contentXml}
          </foreignObject>
        </svg>
      `.trim();

      const img = new Image();
      const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoc)}`;

      const fallbackTimer = setTimeout(() => {
        resolve(createFallbackPng(editor, fullWidth, fullHeight));
      }, 3500);

      img.onload = () => {
        clearTimeout(fallbackTimer);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = fullWidth;
          canvas.height = fullHeight;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, fullWidth, fullHeight);
          ctx.drawImage(img, 0, 0, fullWidth, fullHeight);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(createFallbackPng(editor, fullWidth, fullHeight));
        }
      };

      img.onerror = () => {
        clearTimeout(fallbackTimer);
        resolve(createFallbackPng(editor, fullWidth, fullHeight));
      };

      img.src = dataUri;
    } catch {
      resolve(createFallbackPng(editor, fullWidth, fullHeight));
    }
  });
}
