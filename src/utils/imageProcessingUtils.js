/**
 * Image processing utilities - downsampling, rotation, optimization
 */

export const IMAGE_DOWNSAMPLE_OPTIONS = {
  ORIGINAL: { label: "Original", scale: 1, quality: 0.95 },
  LARGE: { label: "Large (80%)", scale: 0.8, quality: 0.9 },
  MEDIUM: { label: "Medium (50%)", scale: 0.5, quality: 0.85 },
  SMALL: { label: "Small (25%)", scale: 0.25, quality: 0.8 },
};

export async function downsampleImage(dataUrl, scale = 0.5, quality = 0.85) {
  if (!dataUrl || scale === 1) return dataUrl;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const safeScale = Math.max(Number(scale) || 1, 0.01);
      const newWidth = Math.max(1, Math.round(img.width * safeScale));
      const newHeight = Math.max(1, Math.round(img.height * safeScale));

      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Determine format based on original
      const format = dataUrl.includes("jpeg") ? "image/jpeg" : "image/png";
      const downsampled = canvas.toDataURL(format, quality);
      resolve(downsampled);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

export async function rotateImage(dataUrl, degrees = 90) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const radians = (degrees * Math.PI) / 180;

      // Swap dimensions for 90/270 degree rotations
      if (degrees === 90 || degrees === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(radians);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const format = dataUrl.includes("jpeg") ? "image/jpeg" : "image/png";
      const rotated = canvas.toDataURL(format, 0.95);
      resolve(rotated);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

export function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

export function getImageFileSize(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  if (!base64) return 0;
  const binaryString = atob(base64);
  return binaryString.length;
}

export function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
