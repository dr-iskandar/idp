# Authentication Guidance

## Overview

This API uses a multi-layer authentication system:

1. API Key: Required for all requests
2. Access Token: Required for authenticated endpoints
3. Refresh Token: Used to obtain a new access token when it expires

## 1. Obtaining an API Key

The API Key is a static credential provided by the master admin. It should be included in all API requests.

- **How to obtain**: Contact the master admin to receive your API Key.
- **Usage**: Include in all API requests using the `IDP-API-Key` header.

Example:

```
IDP-API-Key: your_api_key_here
```

## 2. User Login

To access protected endpoints, you need to obtain an access token and a refresh token by logging in.

- **URL**: `/user/v1/login`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "username": "your_username",
    "password": "your_password"
  }
  ```
- **Response**:
  ```json
  {
    "status_code": "SUCCESSFUL",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "user_role"
  }
  ```

## 3. Using the Access Token

The access token should be included in all authenticated API requests.

- **Usage**: Include in the `Authorization` header of your requests.
- **Format**: `Bearer <access_token>`

Example:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 4. Refreshing the Access Token

Access tokens expire after a certain period. Use the refresh token to obtain a new access token.

- **URL**: `/v1/refresh`
- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <refresh_token>`
- **Response**:
  ```json
  {
    "status_code": "SUCCESSFUL",
    "access_token": "new_access_token_here"
  }
  ```

## Understanding Access and Refresh Tokens

### Access Token

- A short-lived token (expires in 30 minutes)
- Should be kept secure and never stored on the client side

### Refresh Token

- A long-lived token (for weeks)
- Used only to obtain a new access token
- Should be stored securely on the client side
- Can be revoked by the server if necessary (e.g., on logout)

## Best Practices

1. Always use HTTPS to encrypt all API requests.
2. Never share your API Key or tokens with anyone.
3. Store the refresh token securely on the client side.
4. Implement token refresh logic in your application to handle expired access tokens.

## Example API Request

Here's an example of how a typical authenticated API request should look:

```http
GET /../v1/protected-endpoint
Host: https://docidp.optifit.digital/api
IDP-API-Key: your_api_key_here
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Remember to include both the API Key and the Access Token in your requests to authenticated endpoints.

# API Documentation

## Base URL

`https://docidp.optifit.digital/api/`

## User

### 1. Get User Detail

- **URL**: `/user/v1/detail`
- **Method**: `GET`
- **Authentication**: Custom authentication required
- **Description**: Retrieves details of the authenticated user.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "status_code": "SUCCESSFUL",
      "user_details": {
        "id": "string",
        "username": "string",
        "role": "string"
      }
    }
    ```
  - Error (404 Not Found):
    ```json
    {
      "status_code": "FAILED",
      "message": "User not found"
    }
    ```

### 2. User Login

- **URL**: `/user/v1/login`
- **Method**: `POST`
- **Description**: Authenticates a user and returns access and refresh tokens.
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string",
    "plt": "string" // Optional
  }
  ```
- **Response**:
  - Success (200 OK):
    ```json
    {
      "status_code": "SUCCESSFUL",
      "access_token": "string",
      "refresh_token": "string",
      "role": "string"
    }
    ```
  - Error (401 Unauthorized):
    ```json
    {
      "status_code": "FAILED",
      "message": "Invalid credentials"
    }
    ```

### 3. User Logout

- **URL**: `/user/v1/logout`
- **Method**: `POST`
- **Description**: Logs out the current user.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "success": true,
      "message": "Logged out successfully"
    }
    ```

### 4. Refresh Token

- **URL**: `/user/v1/refresh`
- **Method**: `POST`
- **Authentication**: JWT refresh token required
- **Description**: Generates a new access token using a refresh token.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "status_code": "SUCCESSFUL",
      "access_token": "string"
    }
    ```

### 5. Refresh API Key

- **URL**: `/user/v1/refresh_api_key`
- **Method**: `POST`
- **Authentication**: JWT access token required
- **Description**: Generates a new API key for the authenticated user.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "status_code": "SUCCESSFUL",
      "new_api_key": "string"
    }
    ```
  - Error (404 Not Found):
    ```json
    {
      "status_code": "FAILED",
      "message": "User not found"
    }
    ```

## Analytics

### 1. Get User Analytics

- **URL**: `/analytics/v1/limit`
- **Method**: `GET`
- **Authentication**: Custom authentication required
- **Description**: Retrieves analytics data for the authenticated user's company, including usage limits and recent history.
- **Authorization**: Requires "operational" role
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "data": {
        "limit": number,
        "usage": number,
        "recent_history": [
          {
            "type": string,
            "id": string,
            "title": string,
            "created_at": datetime,
            "status": string,
            "username": string,
            "pages": number
          }
        ]
      }
    }
    ```
  - Error (404 Not Found):
    ```json
    {
      "status_code": "FAILED",
      "message": "User not found"
    }
    ```
  - Error (403 Forbidden):
    ```json
    {
      "status_code": "FAILED",
      "message": "Operational access required"
    }
    ```
  - Error (500 Internal Server Error):
    ```json
    {
      "status_code": "FAILED",
      "message": "An error occurred while fetching analytics data"
    }
    ```

### 2. Get Usage Summary

- **URL**: `/analytics/v1/usage_summary`
- **Method**: `GET`
- **Authentication**: Custom authentication required
- **Description**: Retrieves a summary of usage data for the authenticated user's company, broken down by user and document type.
- **Authorization**: Requires "operational" role
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "data": {
        "FaasBs": [
          {
            "user": string,
            "records": number,
            "pages": number
          }
        ],
        "FaasFs": [
          {
            "user": string,
            "records": number,
            "pages": number
          }
        ],
        "TradeFinance": [
          {
            "user": string,
            "records": number,
            "pages": number
          }
        ]
      }
    }
    ```
  - Error (404 Not Found):
    ```json
    {
      "status_code": "FAILED",
      "message": "User not found"
    }
    ```
  - Error (403 Forbidden):
    ```json
    {
      "status_code": "FAILED",
      "message": "Operational access required"
    }
    ```
  - Error (500 Internal Server Error):
    ```json
    {
      "status_code": "FAILED",
      "message": "An error occurred while fetching summary data"
    }
    ```

## Bank Statement

### 1. Get Bank Statement List

- **URL**: `/faas/bs/v1/list`
- **Method**: `GET`
- **Authentication**: Custom authentication required
- **Authorization**: Requires "analyst" role
- **Description**: Retrieves a list of bank statements for the authenticated user.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "bankStatements": [
        {
          "id": string,
          "title": string,
          "totalPages": number,
          "status": string,
          "createdAt": string,
          "updatedAt": string
        }
      ]
    }
    ```
  - Error (404 Not Found):
    ```json
    {
      "statusCode": "FAILED",
      "message": "No bank statements found"
    }
    ```

### 2. Create Bank Statement

- **URL**: `/faas/bs/v1/create`
- **Method**: `POST`
- **Authentication**: Custom authentication required
- **Authorization**: Requires "analyst" role
- **Description**: Creates a new bank statement by processing uploaded files.
- **Request Body**:
  - `title`: string
  - `files`: file(s)
- **Response**:
  - Success (201 Created):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "faasBsId": string
    }
    ```
  - Error (400 Bad Request):
    ```json
    {
      "statusCode": "FAILED",
      "message": "Invalid file format"
    }
    ```

### 3. Delete Bank Statement

- **URL**: `/faas/bs/v1/delete`
- **Method**: `DELETE`
- **Authentication**: Custom authentication required
- **Authorization**: Requires "analyst" role
- **Query Parameters**:
  - `bsId`: string (Bank Statement ID)
- **Description**: Deletes a specific bank statement and its related data.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "message": "Bank statement and related data deleted successfully"
    }
    ```
  - Error (404 Not Found):
    ```json
    {
      "statusCode": "FAILED",
      "message": "Bank statement not found"
    }
    ```

### 4. Get Bank Statement Summary

- **URL**: `/faas/bs/v1/summary`
- **Method**: `GET`
- **Authentication**: Custom authentication required
- **Authorization**: Requires "analyst" role
- **Query Parameters**:
  - `bsId`: string (Bank Statement ID)
- **Description**: Retrieves a summary of a specific bank statement.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "bsId": string,
      "totalBanks": number,
      "totalAccounts": number,
      "totalPages": number,
      "totalTransactions": number
    }
    ```

### 5. Get Bank Statement Accounts List

- **URL**: `/faas/bs/v1/accounts/list`
- **Method**: `GET`
- **Authentication**: Custom authentication required
- **Authorization**: Requires "analyst" role
- **Query Parameters**:
  - `bsId`: string (Bank Statement ID)
- **Description**: Retrieves a list of accounts in a specific bank statement.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "bsId": string,
      "accountsList": [
        {
          "accountNumber": string,
          "bankName": string,
          "accountType": string,
          "pagesIndex": [string],
          "accountHolderName": string,
          "statementPeriode": string,
          "currency": string,
          "totalDeposits": number,
          "totalDebits": number,
          "totalNoOfDeposits": number,
          "totalNoOfDebits": number
        }
      ]
    }
    ```

### 6. Get Bank Statement Pages Details

- **URL**: `/faas/bs/v1/pages/details`
- **Method**: `GET`
- **Authentication**: Custom authentication required
- **Authorization**: Requires "analyst" role
- **Query Parameters**:
  - `bsId`: string (Bank Statement ID)
- **Description**: Retrieves detailed information about pages in a specific bank statement.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "pages": [
        {
          "id": string,
          "source": string,
          "bankName": string,
          "accountNumber": string,
          "accountType": string,
          "accountHolderName": string,
          "statementPeriode": string,
          "currency": string,
          "transactions": [
            {
              "id": string,
              "date": string,
              "description": string,
              "type": string,
              "amount": number
            }
          ]
        }
      ]
    }
    ```

### 7. Update Bank Statement Page Details

- **URL**: `/faas/bs/v1/page`
- **Method**: `PUT`
- **Authentication**: Custom authentication required
- **Authorization**: Requires "analyst" role
- **Description**: Updates details of a specific page in a bank statement.
- **Request Body**:
  ```json
  {
    "id": string,
    "bankName": string,
    "accountNumber": string,
    "accountType": string,
    "accountHolderName": string,
    "statementPeriode": string,
    "currency": string,
    "transactions": [
      {
        "id": string,
        "date": string,
        "description": string,
        "type": string,
        "amount": number
      }
    ]
  }
  ```
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "message": "Page details updated successfully"
    }
    ```

### 8. Get Subcategories

- **URL**: `/faas/bs/v1/subcategories`
- **Method**: `GET`
- **Authentication**: Custom authentication required
- **Authorization**: Requires "analyst" role
- **Query Parameters**:
  - `bsId`: string (Bank Statement ID)
- **Description**: Retrieves subcategories for a specific bank statement.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "categories": [
        {
          "name": string,
          "subcategories": [
            {
              "subcategoryName": string,
              "keywords": [string]
            }
          ]
        }
      ]
    }
    ```

### 9. Manage Subcategories

- **URL**: `/faas/bs/v1/subcategories`
- **Method**: `POST`
- **Authentication**: Custom authentication required
- **Authorization**: Requires "analyst" role
- **Description**: Updates subcategories for a specific bank statement.
- **Request Body**:
  ```json
  {
    "bsId": string,
    "categories": [
      {
        "name": string,
        "subcategories": [
          {
            "subcategoryName": string,
            "keywords": [string]
          }
        ]
      }
    ]
  }
  ```
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "message": "Subcategories updated successfully"
    }
    ```

### 10. Get Transactions Activity

- **URL**: `/faas/bs/v1/transactions/activity`
- **Method**: `GET`
- **Authentication**: Custom authentication required
- **Authorization**: Requires "analyst" role
- **Query Parameters**:
  - `bsId`: string (Bank Statement ID)
- **Description**: Retrieves transaction activity for a specific bank statement.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "months": [string],
      "transactionsData": [
        {
          "date": string,
          "month": string,
          "currency": string,
          "category": string,
          "subcategory": string,
          "type": string,
          "amount": number,
          "description": string
        }
      ]
    }
    ```

## Financial Statement

### 1. Get Financial Statement List

- **URL**: `/faas/fs/list`
- **Method**: `GET`
- **Description**: Retrieves a list of financial statements for the authenticated user.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "financialStatements": [
        {
          "id": string,
          "title": string,
          "totalPages": number,
          "status": string,
          "createdAt": string,
          "updatedAt": string
        }
      ]
    }
    ```
  - Error (404 Not Found):
    ```json
    {
      "statusCode": "FAILED",
      "message": "No bank statements found"
    }
    ```

### 2. Create Financial Statement

- **URL**: `/faas/fs/create`
- **Method**: `POST`
- **Description**: Creates a new financial statement by processing uploaded files.
- **Request Body**:
  - `title`: string
  - `files`: file(s)
- **Response**:
  - Success (201 Created):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "message": "FS created successfully",
      "id": string
    }
    ```
  - Error (400 Bad Request):
    ```json
    {
      "statusCode": "FAILED",
      "message": "Invalid file format"
    }
    ```
  - Error (403 Forbidden):
    ```json
    {
      "statusCode": "FAILED",
      "message": "Usage limit exceeded"
    }
    ```

### 3. Get Financial Statement Pages Details

- **URL**: `/faas/fs/pages/details`
- **Method**: `GET`
- **Query Parameters**:
  - `fsId`: string (Financial Statement ID)
- **Description**: Retrieves detailed information about pages in a specific financial statement.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "pages": [
        {
          "id": string,
          "documentType": string,
          "source": [string],
          "companyName": string,
          "fields": [string],
          "years": [string],
          "data": [
            {
              "field": string,
              "year1": number,
              "year2": number
            }
          ]
        }
      ]
    }
    ```
  - Error (404 Not Found):
    ```json
    {
      "statusCode": "FAILED",
      "message": "Financial statement not found"
    }
    ```

### 4. Delete Financial Statement

- **URL**: `/faas/fs/delete`
- **Method**: `DELETE`
- **Query Parameters**:
  - `fsId`: string (Financial Statement ID)
- **Description**: Deletes a specific financial statement and its related data.
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "message": "Financial statement and related data deleted successfully"
    }
    ```
  - Error (404 Not Found):
    ```json
    {
      "statusCode": "FAILED",
      "message": "Financial statement not found"
    }
    ```

### 5. Update Financial Statement Page Details

- **URL**: `/faas/fs/page`
- **Method**: `PUT`
- **Description**: Updates details of a specific page in a financial statement.
- **Request Body**:
  ```json
  {
    "id": string,
    "documentType": string,
    "companyName": string,
    "years": [string],
    "data": [
      {
        "field": string,
        "year1": number,
        "year2": number
      }
    ]
  }
  ```
- **Response**:
  - Success (200 OK):
    ```json
    {
      "statusCode": "SUCCESSFUL",
      "message": "Financial statement document updated successfully"
    }
    ```
  - Error (400 Bad Request):
    ```json
    {
      "statusCode": "FAILED",
      "message": "Invalid request data"
    }
    ```
  - Error (404 Not Found):
    ```json
    {
      "statusCode": "FAILED",
      "message": "Page not found"
    }
    ```

## Authentication

- JWT authentication is used for token refresh and API key refresh.

## Notes

- Users must have an "operational" role to access Analytics endpoints.
- Users must have an "analyst" role to access Bank Statement and Financial Statement endpoints.
- There's a usage limit per company. If exceeded, certain operations may be restricted.
