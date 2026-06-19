/**
 * Image utility functions for handling image operations
 */

export async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function getImageAltText(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

export function isImageFile(file) {
  return file.type.startsWith("image/");
}

export function validateImageFile(file) {
  if (!file) {
    throw new Error("No file selected");
  }
  if (!isImageFile(file)) {
    throw new Error("Selected file is not an image");
  }
  return true;
}
