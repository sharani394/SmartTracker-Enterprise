# Database reference

SmartTracker uses MongoDB through Mongoose. Model definitions in [`backend/src/models/`](../backend/src/models/) are the source of truth; Mongoose creates collections and indexes when the models are used. There is no separate SQL schema or migration system in this repository.

## Collections

Mongoose derives the collection names from the model names (lowercase, pluralized).

| Model / collection | Purpose and principal fields |
| --- | --- |
| `Organisation` / `organisations` | Tenant profile: `name`, `emailDomain`, `industry`, `country`, `settings` (`supportEmail`, `timezone`, `memberRegistrationEnabled`, `loginAlertsEnabled`), `status`, and `ownerUserId`. Login alerts are disabled by default; when enabled, successful password sign-ins trigger an email to the signing-in account. |
| `User` / `users` | Tenant member: `organisationId`, `fullName`, `email`, `phone`, `passwordHash`, `role`, `requestedRole`, `permissions`, `status`, `emailVerifiedAt`, department/job profile fields, approval metadata, and password-change timestamp. |
| `Department` / `departments` | Tenant department: `organisationId`, `name`, normalized `nameKey`, `description`, `status`, `createdBy`, and `updatedBy`. |
| `Ticket` / `tickets` | Support request: tenant and ticket number, title/description, category, priority, status, assignment acceptance state, creator and employee details, department and agent details, rejection reason, and resolution time. |
| `TicketActivity` / `ticketactivities` | Append-only ticket timeline entries with tenant/ticket/actor identifiers, action, `PUBLIC` or `INTERNAL` visibility, and mixed `details`. |
| `TicketComment` / `ticketcomments` | Ticket discussion entry with tenant/ticket/author identifiers, message, author role, and visibility. |
| `KnowledgeBaseArticle` / `knowledgebasearticles` | Tenant article with title, slug, category, summary/content, draft/published/archived status, creator/updater, and publication/archive timestamps. |
| `Notification` / `notifications` | Ticket notification with tenant, recipient, optional actor, ticket, notification type, title/message, and `readAt`. |
| `AuditEvent` / `auditevents` | Tenant-scoped administrative and application audit record with actor, action, target, metadata, IP address, and creation time. |
| `Session` / `sessions` | Refresh-session record with user/tenant, `refreshTokenHash`, expiry/revocation timestamps, user agent, and IP address. |
| `EmailVerification` / `emailverifications` | One-time email verification record with user/email, purpose, `codeHash`, attempts, expiry, and consumption timestamp. |
| `PasswordReset` / `passwordresets` | One-time password reset record with user/email, `codeHash`, attempts, expiry, and consumption timestamp. |
| `PrimaryAdminCode` / `primaryadmincodes` | One-time Primary Admin appointment code with tenant/issuer, `codeHash`, attempts, expiry, and consumed/revoked timestamps. |
| `AdminInvitation` / `admininvitations` | Internal Admin invitation with tenant/invitee/issuer, delegated permissions, `codeHash`, attempts, expiry, and consumed/revoked timestamps. |

Fields marked as hashes are stored instead of their plaintext passwords, refresh tokens, verification codes, or invitation codes. Password hashes and code/token hashes are excluded from normal Mongoose query results where configured.

## Relationships

- An organisation owns its users, departments, tickets, articles, notifications, and audit records.
- Users belong to an organisation. User references are used for organisation ownership, department administration, ticket actors/assignees, article authors, notification recipients, sessions, and audit actors.
- A ticket may reference a department and assigned Support Agent. Its activity, comments, and notifications reference the ticket and organisation.
- Email verification, password reset requests, and sessions reference users. Primary Admin codes and Internal Admin invitations reference their organisation and issuing/target users.

These are Mongoose `ObjectId` references; they are not MongoDB-enforced foreign keys. Tenant ownership and access checks are enforced by the API.

## Important constraints and indexes

- Organisation email domains are unique.
- User email is unique; each organisation can have at most one `PRIMARY_ADMIN`.
- Department name keys and ticket numbers are unique within an organisation.
- Knowledge Base slugs are unique within an organisation.
- One verification or password reset record is allowed per user; one active Primary Admin code per organisation; one invitation per invited user.
- Ticket, activity, comment, notification, audit, user, and session indexes support tenant-scoped listing and filtering.
- Sessions, email verifications, password reset requests, Primary Admin codes, and Admin invitations have MongoDB TTL indexes on `expiresAt`. MongoDB removes expired documents asynchronously; expiry checks in the application remain authoritative.

See each model file for field-level validation, defaults, enums, and the complete index declarations.

## Data included in this repository

No MongoDB export, production dataset, or reusable development seed data is tracked here. Runtime records live in the MongoDB database selected by `MONGODB_URI`; the default local database is `smarttracker`. Automated tests create their own test records in `smarttracker_phase2_test` by default.

Real records can contain personal information, authentication metadata, ticket contents, and audit data. Do not export them into this public repository. Teammates can create their own local organisation and accounts through the registration and verification flow described in the [backend guide](../backend/README.md). Configure local environment variables from `.env.example`; do not share or commit `.env`.
