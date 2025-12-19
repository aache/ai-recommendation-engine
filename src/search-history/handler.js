// src/search-history/handler.js

import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { dynamoClient } from "../../shared/dynamo.js";
import { extractTags } from "../../shared/text-utils.js";
import { TABLES, TTL } from "../../shared/constants.js";

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    const { userId, email, searchText } = body;

    if (!userId || !email || !searchText) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "userId, email and searchText are required"
        })
      };
    }

    const timestamp = Date.now();
    const extractedTags = extractTags(searchText);

    // TTL in seconds (30 days)
    // TTL is required to automatically delete old search history entries 
    // This helps in managing storage and ensuring relevance of data
    const ttl =
      Math.floor(timestamp / 1000) +
      TTL.SEARCH_HISTORY_DAYS * 24 * 60 * 60;

    const command = new PutItemCommand({
      TableName: TABLES.USER_SEARCH_HISTORY,
      Item: {
        userId: { S: userId },
        timestamp: { N: timestamp.toString() },
        email: { S: email },
        searchText: { S: searchText },
        extractedTags: {
          L: extractedTags.map(tag => ({ S: tag }))
        },
        ttl: { N: ttl.toString() }
      }
    });

    await dynamoClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Search history saved successfully"
      })
    };
  } catch (error) {
    console.error("Error saving search history:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error"
      })
    };
  }
};