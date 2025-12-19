export const TABLES = {
  USER_SEARCH_HISTORY: "UserSearchHistory",
  PRODUCT_CATALOG: "ProductCatalog"
};

export const LIMITS = {
  MAX_SEARCH_HISTORY: 10,
  MAX_RECOMMENDATIONS: 5,
  MAX_AI_PRODUCTS: 30 // per request
};

export const TTL = {
  SEARCH_HISTORY_DAYS: 30 // days
};

export const DEFAULTS = {
  REGION: process.env.AWS_REGION || "ap-south-1" // Mumbai
};