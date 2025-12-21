# Authentication Setup

This document explains how to enable and configure authentication for the Playwright Dashboard.

## Overview

The dashboard supports three user roles:

- **Administrator**: Full access to all features including editing projects and viewing all data
- **Reporter**: Can only use API endpoints for submitting test results (`/api/test-runs/submit` and `/api/test-runs/upload`)
- **User**: Read-only access to all dashboard pages and data

## Enabling Authentication

Authentication is disabled by default. To enable it:

1. Copy the `.env.example` file to `.env`:
   ```bash
   cd application
   cp .env.example .env
   ```

2. Edit `.env` and set the following variables:
   ```bash
   NUXT_AUTH_ENABLED=true
   NUXT_AUTH_SECRET=your-secret-key-here
   ```

   **Important**: Generate a strong secret key for production. You can use:
   ```bash
   openssl rand -hex 32
   ```

3. Restart the application

## Initial Setup

When authentication is first enabled, you need to create an administrator account:

1. Make a POST request to `/api/auth/setup`:
   ```bash
   curl -X POST http://localhost:3000/api/auth/setup \
     -H "Content-Type: application/json" \
     -d '{
       "username": "admin",
       "password": "your-secure-password",
       "name": "Administrator"
     }'
   ```

2. This endpoint is only available when no users exist in the database

3. After creating the first admin user, this endpoint will return an error

## Logging In

1. Navigate to `/login` in your browser
2. Enter your username and password
3. Upon successful login, you'll be redirected to the dashboard

## User Management

Currently, user management must be done directly in the database. Future versions will include a UI for user management.

To create additional users, you can:

1. Use a database tool to insert records into the `users` table
2. Password must be SHA-256 hashed
3. Role must be one of: `administrator`, `reporter`, or `user`

## API Authentication

When authentication is enabled:

- All API endpoints except `/api/auth/*` require authentication
- Reporters should use their credentials to authenticate before submitting test results
- Sessions are stored in encrypted cookies and last for 7 days

## Reporter Configuration

When using the Playwright reporter with authentication enabled:

1. You need to create a user with the `reporter` role
2. The reporter will need to authenticate before submitting results
3. Currently, the reporter doesn't support automatic authentication - you'll need to ensure the reporter has valid credentials

**Note**: Future versions will add API key support for easier reporter authentication.

## Security Considerations

- Always use HTTPS in production
- Use strong, unique passwords
- Generate a strong random secret for `NUXT_AUTH_SECRET`
- The default secret should never be used in production
- Passwords are hashed using SHA-256 (consider upgrading to bcrypt or argon2 for production use)

## Disabling Authentication

To disable authentication:

1. Set `NUXT_AUTH_ENABLED=false` in `.env`
2. Or remove the environment variable entirely
3. Restart the application

When disabled, all endpoints are accessible without authentication.
