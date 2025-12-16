# QuoteStack API Integration Plan  

## Introduction  
QuoteStack SaaS helps traders normalize and compare supplier quotes. A robust API makes it easy for partners and internal teams to integrate with the platform. This document outlines the endpoints, authentication methods, error handling strategy and data contracts for the QuoteStack public API.  

## Target Endpoints  
- **POST /api/v1/auth/login** – authenticate a user and return a JSON Web Token (JWT) for subsequent requests. Clients send credentials (email/password) in the body and receive an access token.  
- **POST /api/v1/auth/refresh** – refresh an expired access token using a valid refresh token.  
- **GET /api/v1/quotes** – return a paginated list of quotes accessible to the authenticated user. Supports optional query parameters for filtering by status, supplier or date.  
- **POST /api/v1/quotes** – create a new quote by submitting normalized supplier data. Returns the created quote object with an identifier. A simple quotes API often exposes a `/quote` endpoint that returns a random quote or accepts a new quote ([What is SaaS Integration and why is it important?](https://www.rudderstack.com/learn/data-trends/what-is-saas-integration/#:~:text=This%20is%20a%20simple%20Express,HTTP%20GET%20and%20POST%2C%20respectively)), and QuoteStack follows a similar RESTful approach.  
- **GET /api/v1/quotes/{quoteId}** – retrieve a single quote by its ID.  
- **PUT /api/v1/quotes/{quoteId}** – update an existing quote. Only draft or unfinalized quotes may be updated.  
- **DELETE /api/v1/quotes/{quoteId}** – remove a draft quote.  
- **POST /api/v1/quotes/compare** – submit a set of quote IDs and receive a comparison result. The response includes normalized pricing, ranking and outlier detection.  
- **GET /api/v1/suppliers** – list suppliers registered in the system; useful for populating forms.  

## Authentication Flow  
1. **User login**: The client calls `POST /api/v1/auth/login` with credentials. On success, the API returns an access token and a refresh token.  
2. **Authenticated requests**: For protected endpoints, clients must include an `Authorization: Bearer <token>` header containing the access token.  
3. **Token refresh**: When the access token is nearing expiry, the client can call `POST /api/v1/auth/refresh` with the refresh token. The API returns a new access token and refresh token.  
4. **Revocation & logout**: Clients can log out by invalidating refresh tokens.  

All tokens are signed JWTs. The API uses HTTPS exclusively to protect credentials and tokens in transit.  

## Error Handling  
The API uses standard HTTP status codes. Errors return a JSON body with fields such as `message`, `code`, and optionally `details`.  

| Status | Meaning | Sample Error Body |  
| --- | --- | --- |  
| 400 Bad Request | The request is malformed or contains invalid parameters. | `{ "message": "Invalid quote ID", "code": "INVALID_INPUT" }` |  
| 401 Unauthorized | The token is missing, expired or invalid. | `{ "message": "Authentication required", "code": "UNAUTHORIZED" }` |  
| 403 Forbidden | The caller does not have permission to perform the operation. | `{ "message": "Not allowed to delete finalized quote", "code": "FORBIDDEN" }` |  
| 404 Not Found | The resource does not exist. | `{ "message": "Quote not found", "code": "NOT_FOUND" }` |  
| 500 Internal Server Error | Unexpected error on the server. | `{ "message": "Server error", "code": "INTERNAL_ERROR" }` |  

In addition to returning human‑readable messages, clients should inspect the `code` field to programmatically handle errors.  

## Data Contracts  
All data is exchanged as JSON with UTF‑8 encoding.  

### Quote Object  
- `id` (string) – unique identifier for the quote.  
- `supplierId` (string) – ID of the supplier.  
- `items` (array of QuoteItem) – normalized line items.  
- `status` (string) – e.g. "draft", "submitted", "compared".  
- `createdAt` (ISO 8601 timestamp).  
- `updatedAt` (ISO 8601 timestamp).  
- `currency` (string) – ISO currency code (e.g. "USD").  
- `total` (number) – total cost.  

### QuoteItem  
- `id` (string) – unique identifier for the line item.  
- `description` (string).  
- `quantity` (number).  
- `unitPrice` (number).  
- `extendedPrice` (number) – calculated as `quantity * unitPrice`.  
- `category` (string) – optional classification.  

### ComparisonResult  
- `quoteIds` (array of strings) – list of quotes compared.  
- `ranking` (array of strings) – quote IDs sorted from lowest cost to highest.  
- `normalizedValues` (object) – normalized values for each quote.  
- `outliers` (array of strings) – quote IDs flagged as pricing outliers.  

Use consistent field names and types across endpoints. All timestamps are ISO 8601 strings in UTC.  

## Versioning  
The API is versioned via the URL (`/api/v1/…`). Breaking changes will result in a new major version. Clients should specify the version in the path.  

## Rate Limiting  
To prevent abuse, the API enforces request limits per API key or user account. Responses that hit a rate limit return a `429 Too Many Requests` status and include a `Retry-After` header.  

## Conclusion  
This integration plan provides a foundation for integrating with QuoteStack SaaS. It defines clear endpoints, authentication, error handling and data contracts. A simple example script in the repository demonstrates how to call a GET endpoint and log the response. 
