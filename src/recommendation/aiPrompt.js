// src/recommendation/aiPrompt.js

export function buildRecommendationPrompt({
  recentSearches,
  dominantTags,
  candidateProducts
}) {
  return `
User recent searches:
${recentSearches.join(", ")}

User intent keywords:
${dominantTags.join(", ")}

Available products:
${candidateProducts
  .map((p, i) => `${i + 1}. ${p.productName}`)
  .join("\n")}

Task:
From the list above, choose the TOP 3 products most relevant to the user's intent.

Respond ONLY with a numbered list in this exact format:
1. Product name
2. Product name
3. Product name
`;
}