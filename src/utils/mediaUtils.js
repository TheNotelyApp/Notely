/**
 * Utility functions for extracting and managing media/images
 */

export function extractImagesFromMarkdown(content) {
  if (!content) return [];

  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images = [];
  let match;

  while ((match = regex.exec(content))) {
    images.push({
      altText: match[1] || "Image",
      path: match[2],
      id: `${match[2]}-${Math.random().toString(36).slice(2)}`,
    });
  }

  return images;
}

export function isLocalImagePath(path) {
  return path.startsWith("./images/") || path.startsWith(".\\images\\");
}

export function getImageFileName(path) {
  return path.split(/[\\/]/).pop() || "image";
}
