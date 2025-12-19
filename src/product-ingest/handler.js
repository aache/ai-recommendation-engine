// src/product-ingest/handler.js

import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { dynamoClient } from "../../shared/dynamo.js";
import { TABLES } from "../../shared/constants.js";

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    const {
      category,
      productId,
      productName,
      tags,
      partnerId,
      priceRange,
      rating,
      availability
    } = body;

    // Basic validation
    if (
      !category ||
      !productId ||
      !productName ||
      !Array.isArray(tags) ||
      !partnerId ||
      availability === undefined
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Missing or invalid product fields"
        })
      };
    }

    const command = new PutItemCommand({
      TableName: TABLES.PRODUCT_CATALOG,
      Item: {
        category: { S: category },
        productId: { S: productId },
        productName: { S: productName },
        tags: {
          L: tags.map(tag => ({ S: tag.toLowerCase() }))
        },
        partnerId: { S: partnerId },
        priceRange: { S: priceRange || "unknown" },
        rating: { N: (rating || 0).toString() },
        availability: { BOOL: availability },
        createdAt: { N: Date.now().toString() }
      },
      ConditionExpression: "attribute_not_exists(productId)"
    });

    await dynamoClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Product saved successfully"
      })
    };
  } catch (error) {
    console.error("Error saving product:", error);

    // Handle duplicate product
    if (error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 409,
        body: JSON.stringify({
          message: "Product already exists"
        })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error"
      })
    };
  }
};