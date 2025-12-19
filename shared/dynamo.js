// shared/dynamo.js

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DEFAULTS } from "./constants.js";

export const dynamoClient = new DynamoDBClient({
  region: DEFAULTS.REGION,
});