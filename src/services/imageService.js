/**
 * Image and media service for handling insertion operations
 */

import {
  readFileAsDataUrl,
  getMediaAltText,
  validateMediaFile,
  isImageFile,
} from "../utils/mediaTypeUtils";
import { saveImage } from "./electronService";
import { normalizeImagePathForMarkdown } from "../utils/markdownUtils";

export async function insertImageFromFile(file) {
  // Keep backward compatibility - validate as image
  if (!isImageFile(file)) {
    throw new Error("This function is for images only. Use insertMediaFromFile for other types.");
  }

  const dataUrl = await readFileAsDataUrl(file);

  const imagePath = await saveImage(file.name, dataUrl);

  const altText = getMediaAltText(file.name);
  return { imagePath: normalizeImagePathForMarkdown(imagePath), altText };
}

export async function insertMediaFromFile(file) {
  validateMediaFile(file);

  const dataUrl = await readFileAsDataUrl(file);

  const mediaPath = await saveImage(file.name, dataUrl);

  const altText = getMediaAltText(file.name);
  return { mediaPath: normalizeImagePathForMarkdown(mediaPath), altText };
}

export async function insertImagesFromFiles(files) {
  const imageFiles = Array.from(files).filter(isImageFile);

  if (imageFiles.length === 0) {
    throw new Error("No image files selected");
  }

  const results = [];
  for (const file of imageFiles) {
    try {
      const result = await insertImageFromFile(file);
      results.push(result);
    } catch (error) {
      console.error(`Failed to insert image ${file.name}:`, error);
    }
  }

  if (results.length === 0) {
    throw new Error("Failed to insert any images");
  }

  return results;
}

export async function insertMediaFromFiles(files) {
  const validFiles = Array.from(files).filter((f) => {
    try {
      validateMediaFile(f);
      return true;
    } catch {
      return false;
    }
  });

  if (validFiles.length === 0) {
    throw new Error("No valid media files selected");
  }

  const results = [];
  for (const file of validFiles) {
    try {
      const result = await insertMediaFromFile(file);
      results.push(result);
    } catch (error) {
      console.error(`Failed to insert media ${file.name}:`, error);
    }
  }

  if (results.length === 0) {
    throw new Error("Failed to insert any media files");
  }

  return results;
}

