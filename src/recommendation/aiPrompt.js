// src/recommendation/aiPrompt.js

import { LIMITS } from "../../shared/constants.js";

export function buildRecommendationPrompt({
  recentSearches,
  dominantTags,
  candidateProducts
}) {
  return `
You are an AI recommendation engine.

User intent is inferred from recent searches and dominant keywords.

Recent Searches:
${recentSearches.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Dominant Intent Tags:
${dominantTags.join(", ")}

Candidate Products (max ${LIMITS.MAX_AI_PRODUCTS}):
${candidateProducts
  .map(
    (p, i) =>
      `${i + 1}. ${p.productName}
   Tags: ${p.tags.join(", ")}
   Price: ${p.priceRange}
   Rating: ${p.rating}`
  )
  .join("\n\n")}

Task:
- Rank the top ${LIMITS.MAX_RECOMMENDATIONS} products
- Consider relevance to user intent first
- Prefer higher ratings when relevance is equal
- Return output strictly as JSON in the format below

Output format:
[
  {
    "productId": "string",
    "score": number,
    "reason": "short explanation"
  }
]
`;
}