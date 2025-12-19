// shared/text-utils.js

export function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();
}

export function extractTags(text) {
  if (!text) return [];

  return normalizeText(text)
    .split(" ")
    .filter(word => word.length > 3);
}