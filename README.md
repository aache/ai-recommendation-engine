🧠 AI-Based Product Recommendation Engine (AWS Serverless)

A lightweight, low-cost, serverless recommendation engine built on AWS.
It analyzes recent user search history, matches it against partner products, and generates relevant recommendations using Amazon Bedrock (Titan Text Express) with a deterministic fallback.

Designed to be:
	•	💰 Extremely cheap
	•	⚡ Scalable
	•	🧩 Easy to extend
	•	🧠 AI-assisted but not AI-dependent

⸻

🏗 Architecture Overview

Services Used
	•	AWS Lambda – Business logic
	•	Amazon API Gateway (HTTP API) – REST endpoints
	•	Amazon DynamoDB – Search history & product catalog
	•	Amazon Bedrock (Titan Text Express) – AI ranking
	•	AWS SAM – Infrastructure as Code

High-level flow
	1.	User searches are stored
	2.	Products are ingested by partners/admins
	3.	Recent searches → dominant intent
	4.	Products are pre-filtered deterministically
	5.	Titan ranks top products (optional)
	6.	Fallback logic guarantees output

Project Structure
.
├── events/
├── README.md
├── shared/
│   ├── constants.js
│   ├── dynamo.js
│   ├── text-utils.js
│   └── package.json
├── src/
│   ├── search-history/
│   │   ├── handler.js
│   │   └── package.json
│   ├── product-ingest/
│   │   ├── handler.js
│   │   └── package.json
│   └── recommendation/
│       ├── handler.js
│       ├── aiPrompt.js
│       └── package.json
└── template.yaml

---
🚀 Setup Instructions

1️⃣ Prerequisites
	•	AWS Account
	•	AWS CLI configured
	•	AWS SAM CLI installed
	•	Node.js 18+ or 20+
2️⃣ Clone the Repository
    git clone
    cd ai-recommendation-engine
Check 
    aws --version
    sam --version
    node -v

Build & Deploy 
    sam build --clean
    sam deploy --guided

🔌 API Endpoints

1️⃣ Save Search History

POST /search-history

Stores a single search event.
{
  "userId": "user123",
  "email": "user123@email.com",
  "searchText": "best noise cancelling headphones for office"
}

2️⃣ Ingest Product
POST /product-ingest
Adds/updates a product in the catalog.
{
  "category": "Electronics",
  "productId": "prd-elec-001",
  "productName": "Sony WH-1000XM5",
  "tags": ["headphones", "noise cancelling", "wireless", "office"],
  "partnerId": "sony",
  "priceRange": "premium",
  "rating": 4.8,
  "availability": true
}

3️⃣ Get Recommendations

GET /recommendations/{userId}

{
  "userId": "user123",
  "dominantTags": ["headphones", "office", "noise"],
  "recommendations": [
    {
      "productId": "prd-elec-001",
      "productName": "Sony WH-1000XM5",
      "score": 3,
      "reason": "Ranked by AI relevance"
    }
  ]
}