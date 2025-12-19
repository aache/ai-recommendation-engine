// src/recommendation/handler.js

import {
  QueryCommand,
  ScanCommand
} from "@aws-sdk/client-dynamodb";

import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime";

import { dynamoClient } from "../../shared/dynamo.js";
import { TABLES, LIMITS } from "../../shared/constants.js";
import { buildRecommendationPrompt } from "./aiPrompt.js";

const bedrockClient = new BedrockRuntimeClient({});

/**
 * Parse ranked list text from Titan output.
 * Example:
 * 1. Product A
 * 2. Product B
 */
function parseTitanRanking(text, candidates) {
  const lines = text.split("\n");
  const results = [];

  for (const line of lines) {
    const match = line.match(/^\d+\.\s+(.*)$/);
    if (match) {
      const name = match[1].trim().toLowerCase();
      const product = candidates.find(
        p => p.productName.toLowerCase() === name
      );
      if (product) {
        results.push({
          productId: product.productId,
          productName: product.productName,
          score: product.score,
          reason: "Ranked by AI relevance"
        });
      }
    }
  }
  return results;
}

export const handler = async (event) => {
  try {
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "userId is required" })
      };
    }

    /* --------------------------------------------------
       1️⃣ Fetch last N searches
    -------------------------------------------------- */
    const searchResult = await dynamoClient.send(
      new QueryCommand({
        TableName: TABLES.USER_SEARCH_HISTORY,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: {
          ":uid": { S: userId }
        },
        ScanIndexForward: false,
        Limit: LIMITS.MAX_SEARCH_HISTORY
      })
    );

    if (!searchResult.Items || searchResult.Items.length < 3) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Not enough data for recommendations"
        })
      };
    }

    /* --------------------------------------------------
       2️⃣ Aggregate intent
    -------------------------------------------------- */
    const tagFrequency = {};
    const recentSearches = [];

    for (const item of searchResult.Items) {
      recentSearches.push(item.searchText.S);
      for (const tag of item.extractedTags.L) {
        const t = tag.S;
        tagFrequency[t] = (tagFrequency[t] || 0) + 1;
      }
    }

    const dominantTags = Object.keys(tagFrequency)
      .sort((a, b) => tagFrequency[b] - tagFrequency[a])
      .slice(0, 5);

    /* --------------------------------------------------
       3️⃣ Fetch available products
    -------------------------------------------------- */
    const productResult = await dynamoClient.send(
      new ScanCommand({
        TableName: TABLES.PRODUCT_CATALOG,
        FilterExpression: "availability = :a",
        ExpressionAttributeValues: {
          ":a": { BOOL: true }
        }
      })
    );

    if (!productResult.Items || productResult.Items.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No products available" })
      };
    }

    /* --------------------------------------------------
       4️⃣ Pre-filter by tag overlap
    -------------------------------------------------- */
    const candidates = productResult.Items
      .map(p => {
        const tags = p.tags.L.map(t => t.S);
        const overlap = tags.filter(t => dominantTags.includes(t)).length;

        return {
          productId: p.productId.S,
          productName: p.productName.S,
          tags,
          priceRange: p.priceRange.S,
          rating: Number(p.rating.N),
          score: overlap
        };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, LIMITS.MAX_AI_PRODUCTS);

    if (candidates.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No relevant products found" })
      };
    }

    /* --------------------------------------------------
       5️⃣ Build prompt
    -------------------------------------------------- */
    const prompt = buildRecommendationPrompt({
      recentSearches,
      dominantTags,
      candidateProducts: candidates
    });

    /* --------------------------------------------------
       6️⃣ Invoke Titan Text Express
    -------------------------------------------------- */
    let aiResults = [];

    try {
      const response = await bedrockClient.send(
        new InvokeModelCommand({
          modelId: "amazon.titan-text-express-v1",
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            inputText: prompt,
            textGenerationConfig: {
              maxTokenCount: 256,
              temperature: 0.3
            }
          })
        })
      );

      const responseBody = JSON.parse(
        new TextDecoder().decode(response.body)
      );

      console.log("AI Response:", responseBody);

      const outputText = responseBody.results?.[0]?.outputText || "";

      aiResults = parseTitanRanking(outputText, candidates);
    } catch (aiError) {
      console.warn("AI ranking failed, using fallback:", aiError.message);
    }

    /* --------------------------------------------------
       7️⃣ Fallback deterministic ranking
    -------------------------------------------------- */
    const finalRecommendations = (aiResults.length > 0
      ? aiResults
      : candidates
          .sort((a, b) => b.score - a.score || b.rating - a.rating)
          .slice(0, LIMITS.MAX_RECOMMENDATIONS)
          .map(p => ({
            productId: p.productId,
            productName: p.productName,
            score: p.score,
            reason: "Matched dominant search intent"
          }))
    ).slice(0, LIMITS.MAX_RECOMMENDATIONS);

    return {
      statusCode: 200,
      body: JSON.stringify({
        userId,
        dominantTags,
        recommendations: finalRecommendations
      })
    };
  } catch (error) {
    console.error("Recommendation error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error"
      })
    };
  }
};