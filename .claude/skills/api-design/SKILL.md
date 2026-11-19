---
name: api-design
description: REST API design, GraphQL schemas, API versioning, OpenAPI/Swagger documentation, HATEOAS, pagination, filtering, sorting, error responses, rate limiting, authentication, and API best practices. Use when designing APIs, creating RESTful endpoints, building GraphQL schemas, documenting APIs, implementing versioning, or establishing API standards.
license: MIT
version: 1.0.0
trigger: When designing APIs, creating RESTful endpoints, building GraphQL schemas, documenting APIs, implementing versioning, or establishing API standards.
---

# API Design Skill

Design clean, consistent, and developer-friendly APIs with REST, GraphQL, proper documentation, and industry best practices.

## When to Use

- Designing RESTful APIs
- Building GraphQL schemas
- Documenting APIs with OpenAPI/Swagger
- Implementing API versioning
- Setting up authentication/authorization
- Designing pagination and filtering
- Establishing API standards
- Creating developer-friendly interfaces

## REST API Design Principles

**Resource-Oriented:**
- Use nouns for resources: `/users`, `/posts`, `/comments`
- Use HTTP methods correctly: GET, POST, PUT, PATCH, DELETE
- Avoid verbs in URLs: `/users` not `/getUsers`

**Consistent Naming:**
- Use plural nouns: `/users` not `/user`
- Use kebab-case: `/user-profiles` not `/userProfiles`
- Be consistent across all endpoints

**HTTP Methods:**
```
GET    /users          - List users
GET    /users/:id      - Get single user
POST   /users          - Create user
PUT    /users/:id      - Replace user
PATCH  /users/:id      - Update user
DELETE /users/:id      - Delete user
```

## URL Structure

**Hierarchical Resources:**
```
GET /users/:userId/posts          - User's posts
GET /users/:userId/posts/:postId  - Specific post
```

**Query Parameters:**
```
GET /users?status=active&role=admin
GET /posts?sort=-createdAt&limit=20&offset=40
GET /search?q=keyword&category=tech
```

**Avoid:**
```
GET /getUsers                    - Verb in URL
GET /users?filter=active         - Ambiguous
GET /user/123/post/456/comment   - Too deep
```

## Response Format

**Success Response:**
```json
{
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "meta": {
    "requestId": "abc-123",
    "timestamp": "2024-11-07T10:30:00Z"
  }
}
```

**List Response:**
```json
{
  "data": [
    { "id": 1, "name": "User 1" },
    { "id": 2, "name": "User 2" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email format is invalid"
      }
    ]
  },
  "meta": {
    "requestId": "abc-123",
    "timestamp": "2024-11-07T10:30:00Z"
  }
}
```

## Status Codes

**Success:**
- `200 OK` - Successful GET, PUT, PATCH, DELETE
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE (no response body)

**Client Errors:**
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Authenticated but not authorized
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Resource already exists
- `422 Unprocessable Entity` - Validation errors
- `429 Too Many Requests` - Rate limit exceeded

**Server Errors:**
- `500 Internal Server Error` - Unexpected error
- `503 Service Unavailable` - Temporary overload

## Pagination

**Offset-Based:**
```
GET /users?limit=20&offset=40
```
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 40,
    "total": 100,
    "hasMore": true
  }
}
```

**Cursor-Based (Better for large datasets):**
```
GET /users?limit=20&cursor=eyJpZCI6MTAwfQ
```
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "cursor": "eyJpZCI6MTIwfQ",
    "hasMore": true
  }
}
```

**Page-Based:**
```
GET /users?page=2&limit=20
```
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Filtering, Sorting, Searching

**Filtering:**
```
GET /users?status=active&role=admin&createdAfter=2024-01-01
```

**Sorting:**
```
GET /users?sort=-createdAt,name  // - for descending
GET /posts?sort=views            // ascending
```

**Searching:**
```
GET /users?q=john
GET /products?search=laptop&category=electronics
```

**Field Selection:**
```
GET /users?fields=id,name,email
GET /posts?include=author,comments
```

## API Versioning

**URL Versioning:**
```
GET /v1/users
GET /v2/users
```

**Header Versioning:**
```
GET /users
Accept: application/vnd.myapi.v2+json
```

**Query Parameter:**
```
GET /users?version=2
```

**Best Practice:** Use URL versioning for clarity

## Authentication

**Bearer Token (JWT):**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**API Key:**
```
X-API-Key: your-api-key-here
```

**OAuth 2.0:**
```
Authorization: Bearer access_token
```

## Rate Limiting

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699354800
```

**Response (429):**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

## OpenAPI/Swagger Documentation

**Basic Structure:**
```yaml
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0
  description: API documentation
servers:
  - url: https://api.example.com/v1
paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        email:
          type: string
```

## GraphQL Design

**Schema:**
```graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
}

type Query {
  users(limit: Int, offset: Int): [User!]!
  user(id: ID!): User
  posts(userId: ID): [Post!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}

input CreateUserInput {
  name: String!
  email: String!
}

input UpdateUserInput {
  name: String
  email: String
}
```

**Query Example:**
```graphql
query {
  users(limit: 10) {
    id
    name
    posts {
      title
    }
  }
}
```

## HATEOAS (Hypermedia)

```json
{
  "data": {
    "id": 123,
    "name": "John Doe",
    "_links": {
      "self": { "href": "/users/123" },
      "posts": { "href": "/users/123/posts" },
      "update": { "href": "/users/123", "method": "PUT" },
      "delete": { "href": "/users/123", "method": "DELETE" }
    }
  }
}
```

## Error Handling

**Standard Error Format:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

**Validation Errors:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Invalid format" },
      { "field": "age", "message": "Must be positive" }
    ]
  }
}
```

## Best Practices

**Do:**
- Use consistent naming conventions
- Version your API from day one
- Implement proper error handling
- Use pagination for lists
- Document everything with OpenAPI
- Implement rate limiting
- Use HTTPS always
- Return appropriate status codes
- Support filtering and sorting
- Use CORS properly

**Don't:**
- Expose internal IDs unnecessarily
- Return sensitive data in errors
- Use HTTP verbs in URLs
- Mix singular/plural resources
- Ignore security (auth, validation)
- Return large lists without pagination
- Break backward compatibility
- Use inconsistent error formats

## Resources

- REST API Tutorial: https://restfulapi.net/
- OpenAPI Specification: https://swagger.io/specification/
- GraphQL: https://graphql.org/learn/
- Microsoft API Guidelines: https://docs.microsoft.com/en-us/azure/architecture/best-practices/api-design
- Google API Design Guide: https://cloud.google.com/apis/design
