# SmartTracker backend

JavaScript REST API built with Express, Mongoose, dotenv, express-validator, bcryptjs (bcrypt password hashing), JWT, Nodemailer, and Swagger UI.

## Prerequisites

- Node.js 20 or newer and npm.
- MongoDB 6.0 or newer, running locally or available through a MongoDB connection URI.
- An SMTP account for delivering verification messages.

## Setup

From the project root:

```sh
cd backend
npm install
cp .env.example .env
```

Generate and set a unique JWT signing secret:

```sh
openssl rand -base64 48
```

Copy the generated value into `JWT_SECRET` in `backend/.env`. The value must contain at least 32 characters. Configure the SMTP variables in the same file before using registration and verification endpoints. Never commit `.env` or share its values.

Edit `MONGODB_URI` if MongoDB is not listening at `mongodb://127.0.0.1:27017/smarttracker`.

For the collections, relationships, indexes, and data-sharing notes, see the [database reference](../docs/database.md).

To start a local MongoDB Community Server, use your operating system's MongoDB service manager. On systems with the `mongod` executable and a writable database directory, a foreground development instance can be started with:

```sh
mkdir -p /tmp/smarttracker-mongodb
mongod --dbpath /tmp/smarttracker-mongodb --bind_ip 127.0.0.1 --port 27017
```

Keep that terminal open. Start the API from another terminal:

```sh
cd backend
npm start
```

For automatic restart during development, run `npm run dev` from `backend`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime mode; production hides internal error messages. |
| `HOST` | `0.0.0.0` | Address used by the HTTP server. |
| `PORT` | `5000` | HTTP port. |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/smarttracker` | Mongoose connection URI. |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `5000` | Time allowed for initial MongoDB server selection. |
| `JSON_BODY_LIMIT` | `1mb` | Maximum JSON request body size. |
| `CORS_ORIGINS` | `http://localhost:8081,http://127.0.0.1:8081` outside production; empty in production unless configured | Comma-separated exact browser origins allowed to call the API. No paths or wildcard origins. |
| `JWT_SECRET` | Required | Unique random signing secret; at least 32 characters. |
| `ACCESS_TOKEN_TTL` | `15m` | Short-lived access token lifetime. |
| `REFRESH_TOKEN_DAYS` | `30` | Refresh session lifetime; refresh tokens rotate on use. |
| `EMAIL_VERIFICATION_MINUTES` | `15` | Verification code lifetime. |
| `PRIMARY_ADMIN_CODE_MINUTES` | `30` | One-time appointment code lifetime. |
| `BCRYPT_ROUNDS` | `12` | bcrypt work factor; allowed range is 10–15. |
| `SMTP_HOST` | Required for email | SMTP server hostname. |
| `SMTP_PORT` | `587` | SMTP port; port 465 enables implicit TLS. |
| `SMTP_USER` | Required for email | SMTP username. |
| `SMTP_PASSWORD` | Required for email | SMTP password or provider-specific app password. |
| `EMAIL_FROM` | Required for email | Sender address, for example `SmartTracker <no-reply@example.org>`. |
| `ADMIN_INVITATION_MINUTES` | `1440` | Internal Admin invitation code lifetime. |

The SMTP sender must be authorized by your mail provider. Registration endpoints return an email delivery error if mail cannot be sent. The resend endpoint returns a generic response to avoid account enumeration; check the backend logs if an expected verification email does not arrive.

### Browser CORS

The API reflects only an exact origin present in `CORS_ORIGINS`; it never sends a wildcard origin or enables cookie credentials. Development defaults allow Expo web at `http://localhost:8081` and `http://127.0.0.1:8081`. If Expo selects another port, add that exact origin to the comma-separated allowlist and restart the backend. The allowlist supports bearer-authenticated requests with `Authorization` and JSON `Content-Type` headers, and answers allowed `OPTIONS` preflight requests. Set the deployed web origin(s) explicitly in production; do not copy the local development origins into production unless they are actually used.

The Expo frontend's `EXPO_PUBLIC_API_URL_WEB` selects the backend URL. Its default is `http://localhost:5000/api/v1`. See [the mobile frontend setup guide](../frontend/mobile/README.md) for web, emulator, and physical Android configuration.

## API and Swagger

- Swagger UI: <http://localhost:5000/api-docs>
- OpenAPI 3.0 JSON: <http://localhost:5000/openapi.json>
- Health check: <http://localhost:5000/api/v1/health>

Swagger's **Authorize** button accepts a bearer access token after signing in. Do not put actual passwords, access tokens, refresh tokens, or appointment/verification codes in saved examples.

## API routes

| Method | Path | Access |
| --- | --- | --- |
| `POST` | `/api/v1/organisations` | Public registration; creates owner and sends email verification. |
| `GET`, `PATCH` | `/api/v1/organisations/settings` | `settings:read` / `settings:manage`; organisation is derived from the session. Email domain is immutable here. |
| `GET`, `POST` | `/api/v1/organisations/internal-admins` | Owner or Primary Admin; invite or list tenant Internal Admins. |
| `PATCH` | `/api/v1/organisations/internal-admins/{adminId}/permissions` | Owner or Primary Admin; grant only permissions the acting admin can hold. |
| `PATCH` | `/api/v1/organisations/internal-admins/{adminId}/status` | Owner or Primary Admin; activate accepted invite or deactivate and revoke sessions. |
| `GET` | `/api/v1/organisations/users` | `users:read` and/or `agents:read`; optional role/status filters. |
| `PATCH` | `/api/v1/organisations/users/{userId}/status` | `users:manage` for employees; `agents:manage` for Support Agents. Deactivation revokes sessions. |
| `GET`, `POST` | `/api/v1/organisations/departments` | `departments:read` / `departments:manage`; listing defaults to active departments. |
| `PATCH` | `/api/v1/organisations/departments/{departmentId}` | `departments:manage`; update fields or set status to `INACTIVE`. |
| `GET` | `/api/v1/organisations/audit-events` | `audit:read`; tenant-scoped cursor pagination. |
| `POST` | `/api/v1/auth/email-verification/confirm` | Public; consumes a verification code. |
| `POST` | `/api/v1/auth/email-verification/resend` | Public; generic account-safe response. |
| `POST` | `/api/v1/auth/internal-admin-invitations/accept` | Public; consumes the one-time invite code and sets the new password. |
| `POST` | `/api/v1/auth/login` | Public; verifies credentials and account state. |
| `POST` | `/api/v1/auth/refresh` | Public; rotates an opaque refresh token. |
| `POST` | `/api/v1/auth/logout` | Bearer token; revokes the current session. |
| `POST` | `/api/v1/auth/primary-admin-codes` | Owner; issues a single-use code. Replacing an existing admin requires `replaceCurrent: true` and the Owner’s current password. The outgoing admin is suspended and its sessions revoked. |
| `POST` | `/api/v1/auth/primary-admin/register` | Public; registers using the appointment code. |
| `POST` | `/api/v1/auth/members/register` | Public; registers employee/support agent candidates. |
| `GET` | `/api/v1/organisations/members` | Owner or Primary Admin; lists only its tenant's verified, pending applications. |
| `PATCH` | `/api/v1/organisations/members/{memberId}/approval` | Owner or Primary Admin; approves with an explicit role or rejects with a reason. |
| `GET`, `PATCH` | `/api/v1/auth/me` | Bearer token; reads/updates only the authenticated profile. |
| `PUT` | `/api/v1/auth/password` | Bearer token; changes password and revokes all sessions. |
| `GET` | `/api/v1/auth/sessions` | Bearer token; lists the authenticated user's sessions. |
| `DELETE` | `/api/v1/auth/sessions/{sessionId}` | Bearer token; revokes only an owned session. |
| `POST` | `/api/v1/tickets` | Active Employee; creates a ticket using the authenticated user and tenant. |
| `GET` | `/api/v1/tickets` | Employee: own tickets; Support Agent: assigned tickets; ticket staff: tenant queue. Supports pagination, status, priority, category, search, sorting and staff assignment filters. |
| `GET` | `/api/v1/tickets/{ticketId}` | Employee owner, assigned Support Agent, or staff with `tickets:read`/`tickets:manage`; internal notes are staff only. |
| `PUT`, `DELETE` | `/api/v1/tickets/{ticketId}/assignment` | `tickets:manage`; assign/reassign to an active Support Agent in the same organisation or unassign. |
| `PUT` | `/api/v1/tickets/{ticketId}/assignment-response` | Assigned Support Agent; accept or reject a pending assignment. Rejection requires a reason. |
| `PATCH` | `/api/v1/tickets/{ticketId}/status` | Assigned Support Agent after acceptance or staff with `tickets:manage`; valid transitions only. |
| `PATCH` | `/api/v1/tickets/{ticketId}/priority` | `tickets:manage`; Low, Medium, High or Critical. |
| `GET`, `POST` | `/api/v1/tickets/{ticketId}/comments` | Ticket participants; public comments. Only assigned agents or ticket staff may create/read internal notes. |
| `GET` | `/api/v1/tickets/{ticketId}/activity` | Ticket participants and authorised ticket staff; internal activity is staff only. |
| `GET` | `/api/v1/notifications` | Bearer token; lists only the authenticated recipient's notifications, optionally filtered by read state. |
| `PATCH` | `/api/v1/notifications/read` | Bearer token; mark all of the authenticated recipient's notifications read. |
| `PATCH` | `/api/v1/notifications/{notificationId}/read` | Bearer token; mark one owned notification read or unread. |
| `GET`, `POST` | `/api/v1/knowledge-base/articles` | Authenticated users list visible articles; `knowledge:manage` creates drafts or publishes complete articles. Supports search, category/status filters, pagination and sorting. |
| `GET`, `PATCH`, `DELETE` | `/api/v1/knowledge-base/articles/{articleId}` | Published articles are visible to Employees and Support Agents. `knowledge:read` can view all states; `knowledge:manage` edits, publishes, archives and deletes. |
| `GET` | `/api/v1/reports/summary` | `reports:read`; tenant-level ticket status/priority/department counts, agent workload/performance, resolution metrics and trends. Accepts inclusive `from`/`to` ISO 8601 filters and defaults to the last 30 days. |
| `GET` | `/api/v1/organisations/audit-events` | `audit:read`; existing AuditEvent stream with cursor, date, category, action, target, actor and search filters. Includes ticket and Knowledge Base events. |

The server resolves organisations using the company email domain at signup and derives the organisation and role from the account and active MongoDB session on protected requests. A member's requested account type is not granted as an effective role until an Owner or Primary Admin approves and explicitly chooses the role. Owners can replace a Primary Admin only after confirming their password; the previous account is suspended and all its sessions are revoked before the new code is returned.

### Role permissions

| Role | Organisation, ticket and reporting access |
| --- | --- |
| Owner | All organisation settings, department, user, Support Agent, audit and Internal Admin operations; appoints/replaces the Primary Admin, manages tickets and Knowledge Base, and views reports. |
| Primary Admin | Daily user/agent and department operations, audit read, Internal Admin delegation, ticket and Knowledge Base management, and reports. Can read but not change Owner-level organisation settings. |
| Internal Admin | Only explicitly delegated `users:*`, `agents:*`, `departments:*`, `settings:*`, `audit:read`, `tickets:*`, `knowledge:*` and/or `reports:read` permissions. Cannot manage Internal Admins or appoint a Primary Admin. |
| Employee | Account profile, password and own sessions; creates tickets and sees only tickets they submitted, plus published Knowledge Base articles. |
| Support Agent | Account profile, password and own sessions; sees assigned tickets, responds to assignments, updates accepted tickets, collaborates on those tickets and views published Knowledge Base articles. |

Internal Admins cannot delegate permissions; only Owners and Primary Admins manage those accounts. A Primary Admin can delegate only permissions included in the Primary Admin role. Every administrative list and mutation scopes its database query to the authenticated user's organisation. Administrative updates and member approvals write tenant-scoped audit events.

## Tests

The automated authentication, access-control, ticket, Knowledge Base, reporting and audit tests use a separate MongoDB database named `smarttracker_phase2_test` by default. Start MongoDB, then run:

```sh
cd backend
npm test
```

Override `MONGODB_TEST_URI` to select another test database. The test process replaces the email sender with a local test double; production and normal development do not expose verification codes in API responses or logs. Ticket data, Knowledge Base articles, reports, and audit events are backed by MongoDB records; the APIs do not use mock backend data.
