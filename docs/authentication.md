---
title: Authentication
lang: en-US
---

# Authentication

The dashboard supports optional user authentication with role-based access control. Authentication is **disabled by default**.

## Roles

| Role | Description |
|------|-------------|
| **Administrator** | Full access to all features including editing projects, managing users, and deleting runs |
| **Reporter** | Can only call submission API endpoints (`/api/test-runs/submit` and `/api/test-runs/upload`) |
| **User** | Read-only access to all dashboard pages and data |

## Enabling authentication

1. Copy the example environment file:

   ```bash
   cd application
   cp .env.example .env
   ```

2. Edit `.env` and set:

   ```bash
   NUXT_AUTH_ENABLED=true
   NUXT_AUTH_SECRET=your-secret-key-here
   ```

   Generate a strong secret key for production:

   ```bash
   openssl rand -hex 32
   ```

3. Restart the application.

## Initial setup

When authentication is first enabled and no users exist, create the first administrator account:

```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "name": "Administrator"
  }'
```

This endpoint is only available when the users table is empty.

## Logging in

Navigate to `/login` in your browser, or use the API:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-secure-password"}'
```

Sessions are stored in encrypted cookies and last for 7 days.

## User management

User accounts are managed through the admin interface at `/settings/users`.  
This page is accessible to administrators (or to everyone when authentication is disabled, with an informational message).

To create additional users:

1. Navigate to `/settings/users`
2. Click **Add user**
3. Set username, password, role, and optional display name

## API authentication

When authentication is enabled:

- `POST` / `PUT` / `DELETE` endpoints require an active session with appropriate role permissions.
- `GET` endpoints remain publicly accessible (read-only).
- The reporter's submission endpoints (`/api/test-runs/submit` and `/api/test-runs/upload`) require the **reporter** role or higher.

## Security considerations

- Always use HTTPS in production.
- Use strong, unique passwords.
- Generate a strong random secret for `NUXT_AUTH_SECRET`.
- Passwords are hashed using scrypt with per-password salts.
- Never use the default secret in production.

## Disabling authentication

To disable authentication:

1. Set `NUXT_AUTH_ENABLED=false` in `.env`, or remove the variable entirely.
2. Restart the application.

When disabled, all endpoints are accessible without authentication.
