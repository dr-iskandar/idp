# WideIDP

[![Flask](https://img.shields.io/badge/Flask-1.1.2-blue.svg)](https://flask.palletsprojects.com/)  
A brief description of your project, its purpose, and its main features.

## Table of Contents

- [About the Project](#about-the-project)
- [Getting Started](#getting-started)

  - [Prerequisites](#prerequisites)
  - [Server IP](#server-ip)
  - [Installation](#installation)
  - [Run the App](#run-the-app)
  - [Deployment](#deployment)
  - [HTTPS Configuration](#https-configuration)
  - [Logs](#logs)

- [Usage](#usage)
  - [Main Flow](#main-flow)
  - [Administrator Routes](#administrator-routes)
  - [Trade Finance Routes](#trade-finance-routes)
  - [Bank Statement Routes](#bank-statement-routes)
  - [Financial Statement Routes](#financial-statement-routes)
- [Testing Account](#testing-account)
- [Technologies Used](#technologies-used)
- [Authentication Guidance](#authentication-guidance)
  - [Obtaining an API Key](#obtaining-an-api-key)
  - [User Login](#user-login)
  - [Using the Access Token](#using-the-access-token)
  - [Refreshing the Access Token](#refreshing-the-access-token)
  - [Understanding Access and Refresh Tokens](#understanding-access-and-refresh-tokens)
- [API References](#api-references)
- [Developer](#developer)

---

## About the Project

**WideIDP** is an ..

## Getting Started

### Prerequisites

To run this project, ensure you have the following installed:

- Python (>= 3.9)
- conda
- pip (Python package installer)
- Flask
- Docker (server side)
- OpenAI Key (ask Kak Dicky)
- poppler-utils
- cryptography

### Server IP

- Production: `http://43.157.198.77`

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/dr-iskandar/idp.git
   cd idp
   ```

2. **Set up a virtual environment (optional but recommended)**

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

### Run the App

Panduan lengkap instalasi dan konfigurasi lokal dapat dilihat pada [CARA_MENJALANKAN.md](file:///Users/dicky.iskandar/Downloads/idp%202/CARA_MENJALANKAN.md).

```bash
python WideIDP.py
```

Open a web browser and go to `http://localhost:3336` to view the web app.

### Pre-Deployment

1. Make Your Changes

   ```bash
   git add .
   ```

2. Commit Your Changes: Write clear, concise commit messages describing what each commit does.

   ```bash
   git commit -m "Add detailed description of changes"
   ```

3. Push Your Changes
   ```bash
   git push
   ```
4. Login to the Server
   ```bash
   ssh dev@43.157.198.77
   ```
5. Navigate to the Application Directory
   ```bash
   cd /var/www/wideidp
   ```
6. Pull the Latest Code: Use git pull to fetch and merge the latest changes from the repository.
   ```bash
   git pull
   ```

### Deployment

To build and run the Hoople Web App using Docker, follow these steps:

1. Stop any existing container (optional, if you have a container running from a previous session):

   ```bash
   docker stop wideidp
   ```

2. Remove the existing container (optional, to remove any stopped container named "hoople"):

   ```bash
   docker rm wideidp
   ```

3. Build the Docker image:

   ```bash
   docker build -t wideidp:latest .
   ```

4. Run the Docker container:
   ```bash
    sudo docker run -d --name wideidp \
    -v ~/wideidp:/usr/src/app/data \
    -p 3336:3336\
    wideidp:latest
   ```
5. Open a web browser and go to `http://{{server_ip}}:3336` to view the web app.

### HTTPS Configuration

1. Configure Nginx to proxy requests to your Docker container.

```bash
sudo nano /etc/nginx/sites-available/wideidp
```

2. Add the following configuration inside the file.

```
server {
    server_name wideidp.optifit.digital;

    location / {
        proxy_pass http://localhost:3336;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Enable the site by linking it to the sites-enabled directory.

```bash
sudo ln -s /etc/nginx/sites-available/wideidp /etc/nginx/sites-enabled/
```

4. Test the Nginx configuration and restart Nginx.

```bash
sudo nginx -t
sudo systemctl restart nginx
```

5. Use Certbot to obtain an SSL certificate.

```bash
sudo certbot --nginx -d wideidp.optifit.digital
```

6. Wait for 5-10 mins and test the SSL by navigating to https://wideidp.optifit.digital. Verify that the connection is secure (look for the padlock icon) and check certificate details to ensure they are correct.

### Logs

```bash
sudo docker logs -f wideidp
```

## Usage

### Main Flow

#### Flow Diagram

![IDP Main Flow](IDP_Main_Flow.jpg)

#### Step-by-Step Explanation

1. **Start**  
   The process begins when a user uploads a file to the system.

2. **User File(s)**  
   The uploaded file(s) are taken as input and passed to the next step.

3. **PDF Check**

   - If the uploaded file is a PDF, the system extracts its pages.
   - If not, the file is processed directly in its current format.

4. **Extract Pages (if PDF)**  
   If the file is a PDF, the pages are extracted for further processing.

5. **Convert to Image**  
   Each extracted page (from PDFs) or non-PDF file is converted to an image format for easier data extraction.

6. **Get Images Public URL**  
   The system retrieves a public URL for each image, which can then be accessed for processing.

7. **Extract Information**

   - **Model Used**: `gpt-4o-mini`
   - **Prompt Path**: `api/ai/...py`  
     Using the specified model and prompt path, the system extracts relevant information from each image.

8. **Encryption**

   - **Private Key Path**: `private_key.pem`
   - **Public Key Path**: `public_key.pem`
   - **Frontend Library**: `cryptoJS`
   - **Backend Library**: `cryptography`  
     The extracted information is encrypted using public/private key encryption to ensure data security.

9. **End**  
   The encrypted data is stored securely, completing the IDP flow.

### Administrator Routes

All administrator routes are prefixed with `/administrator` and require both `login_required` and `admin_required` decorators for access, except for the authentication page.

- **Authentication Page**: Renders the administrator authentication page.

  - **Route**: `/administrator/auth`
  - **Method**: `GET`
  - **Decorators**: None

- **Home Page**: Displays the administrator home page, showing an overview of companies, including company ID, company name, limit, usage, and usage percentage.

  - **Route**: `/administrator/`
  - **Method**: `GET`
  - **Decorators**: `login_required`, `admin_required`

- **Company Details Page**: Displays details of a specific company, including users, usernames, roles, and the option to add a new role.
  - **Route**: `/administrator/details/<company_id>`
  - **Method**: `GET`
  - **Decorators**: `login_required`, `admin_required`

### Trade Finance Routes

All trade finance routes are prefixed with `/tf` and require the `login_required` decorator for access.

- **Dashboard**: Renders the main dashboard page for trade finance.

  - **Route**: `/tf/`
  - **Method**: `GET`
  - **Decorators**: `login_required`

- **Details Page**: Displays details for a specific trade finance record.

  - **Route**: `/tf/details/<record_id>`
  - **Method**: `GET`
  - **Decorators**: `login_required`

### Bank Statement Routes

All bank statement routes are prefixed with `/bs` and require the `login_required` decorator for access.

- **Dashboard**: Renders the main dashboard page for bank statements.

  - **Route**: `/bs/`
  - **Method**: `GET`
  - **Decorators**: `login_required`

- **Details Page**: Displays details for a specific bank statement.
  - **Route**: `/bs/details/<statement_id>`
  - **Method**: `GET`
  - **Decorators**: `login_required`

### Financial Statement Routes

All financial statement routes are prefixed with `/fs` and require the `login_required` decorator for access.

- **Dashboard**: Renders the main dashboard page for financial statements.

  - **Route**: `/fs/`
  - **Method**: `GET`
  - **Decorators**: `login_required`

- **Details Page**: Displays details for a specific financial statement.
  - **Route**: `/fs/details/<statement_id>`
  - **Method**: `GET`
  - **Decorators**: `login_required`

## Testing Account

1. Administrator
   - Page URL: https://wideidp.optifit.digital/administrator/login
   - Email: administrator
   - Password: 123
2. Analyst User
   - Page URL: https://wideidp.optifit.digital/login
   - Email: analyst_user_1
   - Password: 123
3. Admin Operational
   - Page URL: https://wideidp.optifit.digital/login
   - Email: admin_operational_1
   - Password: 123

## Technologies Used

- **Backend Framework**:

  - `Flask`: Micro web framework used to build the core application.

- **Authentication and Security**:

  - `flask_login`: Manages user sessions and authentication.
  - `flask_jwt_extended`: Adds JSON Web Token (JWT) support for secure API authentication.
  - `flask_bcrypt`: Provides password hashing for secure storage.
  - `cryptography`: Used for encryption and secure data handling.

- **Cross-Origin Resource Sharing (CORS)**:

  - `flask_cors`: Allows secure cross-origin requests to enable API access from different domains.

- **Session Management**:

  - `flask_session`: Enables server-side session handling.

- **Database**:

  - `flask_sqlalchemy`: Object Relational Mapper (ORM) for interacting with the SQL database.
  - `psycopg2-binary`: PostgreSQL database adapter for Python, used to connect Flask to a PostgreSQL database.

- **Date and Time**:

  - `pytz`: Handles time zone conversions.

- **External API Integrations**:

  - `requests`: Simplifies HTTP requests for making API calls.

- **PDF and Image Processing**:

  - `PyPDF2`: For working with PDF files, such as reading and extracting text.
  - `pdf2image`: Converts PDF pages into images.
  - `Pillow`: Python Imaging Library for image manipulation.

## Authentication Guidance

This API uses a multi-layer authentication system:

- API Key: Required for all requests
- Access Token: Required for authenticated endpoints
- Refresh Token: Used to obtain a new access token when it expires

### Obtaining an API Key

The API Key is a static credential provided by the master admin. It should be included in all API requests.

- How to obtain: Contact the master admin to receive your API Key.
- Usage: Include in all API requests using the `IDP-API-Key` header.

  Example:

```bash
IDP-API-Key: your_api_key_here
```

### User Login

To access protected endpoints, you need to obtain an access token and a refresh token by logging in.

- **URL**: `/api/user/v1/login`
- **Method**: `POST`

#### Request Headers

| Header       | Type   | Description        |
| ------------ | ------ | ------------------ |
| Content-Type | String | `application/json` |

#### Request Body

| Name         | Type   | Description |
| ------------ | ------ | ----------- |
| `username`\* | string | Username    |
| `password`\* | string | Password    |

#### Example Response

- Success Response

  ```json
  {
    "status_code": "SUCCESSFUL",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "user_role"
  }
  ```

### Using the Access Token

The access token should be included in all authenticated API requests.

- Usage: Include in the `Authorization` header of your requests.
- Format: Bearer `<access_token>`

Example:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

```

### Refreshing the Access Token

Access tokens expire after a certain period. Use the refresh token to obtain a new access token.

- **URL**: `/api/user/v1/refresh`
- **Method**: `POST`

#### Request Headers

| Header        | Type   | Description              |
| ------------- | ------ | ------------------------ |
| Content-Type  | String | `application/json`       |
| Authorization | String | `Bearer <refresh_token>` |

#### Example Response

- Success Response

  ```json
  {
    "status_code": "SUCCESSFUL",
    "access_token": "new_access_token_here"
  }
  ```

### Understanding Access and Refresh Tokens

#### Access Token

- A short-lived token (expires in 30 minutes)
- Should be kept secure and never stored on the client side

#### Refresh Token

- A long-lived token (for weeks)
- Used only to obtain a new access token
- Should be stored securely on the client side
- Can be revoked by the server if necessary (e.g., on logout)

## API References

To test and interact with the API, use the provided Postman collection.

- **Postman Collection**: [WideIDP.postman_collection.json](WideIDP.postman_collection.json)

## Developer

- Angelica Patricia – Initial Developer
