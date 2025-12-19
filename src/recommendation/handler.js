// src/recommendation/handler.js

import {
  QueryCommand,
  ScanCommand
} from "@aws-sdk/client-dynamodb";

import { dynamoClient } from "../../shared/dynamo.js";
import { TABLES, LIMITS } from "../../shared/constants.js";
import { buildRecommendationPrompt } from "./aiPrompt.js";

/**
 * NOTE:
 * Bedrock invocation is intentionally commented.
 * Enable it once MVP logic is validated.
 */

export const handler = async (event) => {
  try {
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "userId is required" })
      };
    }

    // 1. Fetch last N searches
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

    // 2. Aggregate tags
    const tagFrequency = {};
    const recentSearches = [];

    searchResult.Items.forEach(item => {
      recentSearches.push(item.searchText.S);
      item.extractedTags.L.forEach(tag => {
        const t = tag.S;
        tagFrequency[t] = (tagFrequency[t] || 0) + 1;
      });
    });

    const dominantTags = Object.keys(tagFrequency)
      .sort((a, b) => tagFrequency[b] - tagFrequency[a])
      .slice(0, 5);

    // 3. Fetch candidate products (MVP: scan)
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
        body: JSON.stringify({
          message: "No products available"
        })
      };
    }

    // 4. Pre-filter products by tag overlap
    const candidates = productResult.Items.map(p => {
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
        body: JSON.stringify({
          message: "No relevant products found"
        })
      };
    }

    // 5. AI prompt (ready, but optional)
    const prompt = buildRecommendationPrompt({
      recentSearches,
      dominantTags,
      candidateProducts: candidates
    });

    /*
    // === Bedrock call (enable later) ===
    const bedrock = new BedrockRuntimeClient({});
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: "amazon.titan-text-lite-v1",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({ inputText: prompt })
      })
    );
    */

    // 6. Deterministic fallback ranking (current)
    const recommendations = candidates
      .sort((a, b) => b.score - a.score || b.rating - a.rating)
      .slice(0, LIMITS.MAX_RECOMMENDATIONS)
      .map(p => ({
        productId: p.productId,
        productName: p.productName,
        score: p.score,
        reason: "Matched dominant search intent"
      }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        userId,
        recommendations
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