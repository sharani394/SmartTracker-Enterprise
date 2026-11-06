const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const body = (schema) => ({ required: true, content: json(ref(schema)) });
const errorResponse = (description = 'Request failed.') => ({ description, content: json(ref('ErrorResponse')) });
const auth = [{ bearerAuth: [] }];
const operation = (tag, summary, responses, options = {}) => ({
  tags: [tag],
  summary,
  description: options.description || summary,
  ...(options.operationId ? { operationId: options.operationId } : {}),
  ...(options.security ? { security: options.security } : {}),
  ...(options.parameters ? { parameters: options.parameters } : {}),
  ...(options.requestBody ? { requestBody: options.requestBody } : {}),
  responses,
});

const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'SmartTracker API',
    version: '1.5.0',
    description: 'Tenant-scoped authentication, administration, ticket collaboration, knowledge articles, analytics and audit history.',
  },
  servers: [{ url: 'http://localhost:5000', description: 'Local development server' }],
  tags: [
    { name: 'Health', description: 'Service and database health.' },
    { name: 'Organisations', description: 'Organisation settings, member approval, delegated administrators, users, departments and audit events.' },
    { name: 'Authentication', description: 'Email verification, access tokens, sessions and account profile.' },
    { name: 'Tickets', description: 'Tenant-scoped tickets, assignments, collaboration history and notifications.' },
    { name: 'Knowledge Base', description: 'Tenant knowledge articles and publication lifecycle.' },
    { name: 'Reports', description: 'Tenant-scoped ticket analytics and performance summaries.' },
  ],
  paths: {
    '/api/v1/health': {
      get: operation('Health', 'Check API and MongoDB status', {
        200: { description: 'API is available and MongoDB is connected.', content: json(ref('HealthResponse')) },
        503: { description: 'MongoDB is not connected.', content: json(ref('HealthResponse')) },
      }, { operationId: 'getHealth' }),
    },
    '/api/v1/organisations': {
      post: operation('Organisations', 'Register an organisation and its owner', {
        201: { description: 'Organisation created; owner email verification is required.', content: json(ref('OrganisationRegistrationResponse')) },
        400: errorResponse('Invalid information or email domain mismatch.'),
        409: errorResponse('Email or organisation domain is already registered.'),
        503: errorResponse('SMTP email delivery is not configured or unavailable.'),
      }, { operationId: 'registerOrganisation', requestBody: body('OrganisationRegistrationRequest') }),
    },
    '/api/v1/organisations/members': {
      get: operation('Organisations', 'List registrations awaiting approval', {
        200: { description: 'Pending employee and support agent registrations in the authenticated organisation.', content: json(ref('MemberListResponse')) },
        401: errorResponse('Authentication is required.'),
        403: errorResponse('Owner or Primary Admin access is required.'),
      }, { operationId: 'listPendingMembers', security: auth }),
    },
    '/api/v1/organisations/members/{memberId}/approval': {
      patch: operation('Organisations', 'Approve or reject a member registration', {
        200: { description: 'Registration reviewed.', content: json(ref('MemberReviewResponse')) },
        400: errorResponse('Invalid decision or missing rejection reason.'),
        401: errorResponse('Authentication is required.'),
        403: errorResponse('Owner or Primary Admin access is required.'),
        404: errorResponse('Pending member not found in the authenticated organisation.'),
      }, {
        operationId: 'reviewMember',
        security: auth,
        parameters: [{ name: 'memberId', in: 'path', required: true, description: 'Member account identifier.', schema: { type: 'string', format: 'mongo-id' } }],
        requestBody: body('MemberReviewRequest'),
      }),
    },
    '/api/v1/organisations/settings': {
      get: operation('Organisations', 'Read settings for the authenticated organisation', {
        200: { description: 'Tenant settings.', content: json(ref('OrganisationSettingsResponse')) },
        401: errorResponse('Authentication is required.'), 403: errorResponse('settings:read is not delegated.'),
      }, { operationId: 'getOrganisationSettings', security: auth }),
      patch: operation('Organisations', 'Update organisation profile settings', {
        200: { description: 'Updated tenant settings.', content: json(ref('OrganisationSettingsResponse')) },
        400: errorResponse('Invalid timezone or settings.'), 401: errorResponse('Authentication is required.'),
        403: errorResponse('settings:manage is not delegated.'),
      }, { operationId: 'updateOrganisationSettings', security: auth, requestBody: body('OrganisationSettingsUpdateRequest') }),
    },
    '/api/v1/organisations/internal-admins': {
      get: operation('Organisations', 'List Internal Admins in the authenticated organisation', {
        200: { description: 'Tenant-scoped Internal Admin accounts and permissions.', content: json(ref('InternalAdminListResponse')) },
        401: errorResponse('Authentication is required.'), 403: errorResponse('Internal Admin management is restricted to Owner and Primary Admin.'),
      }, { operationId: 'listInternalAdmins', security: auth }),
      post: operation('Organisations', 'Invite an Internal Admin with delegated permissions', {
        201: { description: 'Invitation sent; account activates after the invitee sets a password.', content: json(ref('InternalAdminInvitationResponse')) },
        400: errorResponse('Invalid email, permission, or organisation domain.'), 401: errorResponse('Authentication is required.'),
        403: errorResponse('Permission cannot be delegated by the current administrator.'), 409: errorResponse('Email is already registered.'),
        503: errorResponse('SMTP email delivery is unavailable.'),
      }, { operationId: 'inviteInternalAdmin', security: auth, requestBody: body('InternalAdminCreateRequest') }),
    },
    '/api/v1/organisations/internal-admins/{adminId}/permissions': {
      patch: operation('Organisations', 'Replace an Internal Admin permission set', {
        200: { description: 'Updated delegated permissions.', content: json(ref('InternalAdminResponse')) },
        400: errorResponse('Unsupported permission.'), 401: errorResponse('Authentication is required.'),
        403: errorResponse('Only Owner or Primary Admin may manage Internal Admins.'), 404: errorResponse('Internal Admin not found in this organisation.'),
      }, { operationId: 'updateInternalAdminPermissions', security: auth,
        parameters: [{ name: 'adminId', in: 'path', required: true, description: 'Internal Admin user ID.', schema: { type: 'string', format: 'mongo-id' } }],
        requestBody: body('InternalAdminPermissionsRequest') }),
    },
    '/api/v1/organisations/internal-admins/{adminId}/status': {
      patch: operation('Organisations', 'Activate or deactivate an Internal Admin', {
        200: { description: 'Updated Internal Admin status.', content: json(ref('InternalAdminResponse')) },
        400: errorResponse('Invalid status.'), 401: errorResponse('Authentication is required.'),
        403: errorResponse('Only Owner or Primary Admin may manage Internal Admins.'), 404: errorResponse('Internal Admin not found in this organisation.'),
        409: errorResponse('The invitation must be accepted before activation.'),
      }, { operationId: 'updateInternalAdminStatus', security: auth,
        parameters: [{ name: 'adminId', in: 'path', required: true, description: 'Internal Admin user ID.', schema: { type: 'string', format: 'mongo-id' } }],
        requestBody: body('AccountStatusRequest') }),
    },
    '/api/v1/organisations/users': {
      get: operation('Organisations', 'List employees and Support Agents allowed by delegated read permissions', {
        200: { description: 'Tenant-scoped users; Internal Admin results are limited to delegated roles.', content: json(ref('UserListResponse')) },
        400: errorResponse('Invalid role or status filter.'), 401: errorResponse('Authentication is required.'),
        403: errorResponse('users:read or agents:read is required for the requested role.'),
      }, { operationId: 'listOrganisationUsers', security: auth, parameters: [
        { name: 'role', in: 'query', required: false, schema: { type: 'string', enum: ['EMPLOYEE', 'SUPPORT_AGENT'] } },
        { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['PENDING_EMAIL', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED'] } },
      ] }),
    },
    '/api/v1/organisations/users/{userId}/status': {
      patch: operation('Organisations', 'Activate or deactivate an approved employee or Support Agent', {
        200: { description: 'Updated user status; deactivation revokes active sessions.', content: json(ref('UserResponse')) },
        400: errorResponse('Invalid account status.'), 401: errorResponse('Authentication is required.'),
        403: errorResponse('users:manage or agents:manage is required for the target role.'),
        404: errorResponse('Employee or Support Agent not found in this organisation.'), 409: errorResponse('Only approved verified users can be changed here.'),
      }, { operationId: 'updateUserStatus', security: auth,
        parameters: [{ name: 'userId', in: 'path', required: true, description: 'Employee or Support Agent user ID.', schema: { type: 'string', format: 'mongo-id' } }],
        requestBody: body('AccountStatusRequest') }),
    },
    '/api/v1/organisations/departments': {
      get: operation('Organisations', 'List active or inactive departments in the authenticated organisation', {
        200: { description: 'Tenant-scoped departments. Defaults to ACTIVE.', content: json(ref('DepartmentListResponse')) },
        400: errorResponse('Invalid status filter.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('departments:read is not delegated.'),
      }, { operationId: 'listDepartments', security: auth, parameters: [
        { name: 'status', in: 'query', required: false, description: 'Use ALL to include active and inactive departments.', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ALL'] } },
      ] }),
      post: operation('Organisations', 'Create a department', {
        201: { description: 'Department created.', content: json(ref('DepartmentResponse')) },
        400: errorResponse('Invalid department fields.'), 401: errorResponse('Authentication is required.'),
        403: errorResponse('departments:manage is not delegated.'), 409: errorResponse('Department name already exists in this organisation.'),
      }, { operationId: 'createDepartment', security: auth, requestBody: body('DepartmentCreateRequest') }),
    },
    '/api/v1/organisations/departments/{departmentId}': {
      patch: operation('Organisations', 'Update or deactivate a department', {
        200: { description: 'Updated department.', content: json(ref('DepartmentResponse')) },
        400: errorResponse('Invalid update.'), 401: errorResponse('Authentication is required.'),
        403: errorResponse('departments:manage is not delegated.'), 404: errorResponse('Department not found in this organisation.'),
        409: errorResponse('Department name already exists in this organisation.'),
      }, { operationId: 'updateDepartment', security: auth,
        parameters: [{ name: 'departmentId', in: 'path', required: true, description: 'Department identifier.', schema: { type: 'string', format: 'mongo-id' } }],
        requestBody: body('DepartmentUpdateRequest') }),
    },
    '/api/v1/organisations/audit-events': {
      get: operation('Organisations', 'List organisation audit events', {
        200: { description: 'Tenant-scoped audit events in reverse chronological order.', content: json(ref('AuditEventListResponse')) },
        400: errorResponse('Invalid pagination parameter.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('audit:read is not delegated.'),
      }, { operationId: 'listAuditEvents', security: auth, parameters: [
        { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
        { name: 'before', in: 'query', required: false, description: 'Return events created before this ISO 8601 timestamp.', schema: { type: 'string', format: 'date-time' } },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'action', in: 'query', schema: { type: 'string' } },
        { name: 'targetType', in: 'query', schema: { type: 'string' } },
        { name: 'actorId', in: 'query', schema: { type: 'string', format: 'mongo-id' } },
        { name: 'category', in: 'query', schema: { type: 'string', enum: ['Ticket', 'User', 'Admin', 'Administrator', 'Access', 'Organisation', 'Organization', 'Security'] } },
        { name: 'q', in: 'query', description: 'Search actor name, event, target and selected metadata labels.', schema: { type: 'string' } },
      ] }),
    },
    '/api/v1/auth/login': {
      post: operation('Authentication', 'Sign in and create a session', {
        200: { description: 'Authenticated user and access/refresh credentials.', content: json(ref('LoginResponse')) },
        400: errorResponse('Invalid request body.'),
        401: errorResponse('Invalid email or password.'),
        403: errorResponse('Email, account, approval or organisation is not active.'),
        429: errorResponse('Authentication request rate limit reached.'),
      }, { operationId: 'login', requestBody: body('LoginRequest') }),
    },
    '/api/v1/auth/refresh': {
      post: operation('Authentication', 'Rotate a refresh token and issue a new access token', {
        200: { description: 'New access and refresh tokens.', content: json(ref('LoginResponse')) },
        400: errorResponse('Invalid request body.'),
        401: errorResponse('Refresh token is invalid, expired or already used.'),
        403: errorResponse('Account or organisation is inactive.'),
      }, { operationId: 'refreshSession', requestBody: body('RefreshRequest') }),
    },
    '/api/v1/auth/logout': {
      post: operation('Authentication', 'Revoke the current session', {
        200: { description: 'Current session revoked.', content: json(ref('MessageResponse')) },
        401: errorResponse('Authentication is required or session was revoked.'),
      }, { operationId: 'logout', security: auth }),
    },
    '/api/v1/auth/email-verification/confirm': {
      post: operation('Authentication', 'Verify a company email address', {
        200: { description: 'Email verified; member registrations move to pending administrator approval.', content: json(ref('EmailVerificationResponse')) },
        400: errorResponse('Verification code is invalid, expired or locked after failed attempts.'),
        409: errorResponse('Account is not awaiting verification.'),
      }, { operationId: 'confirmEmail', requestBody: body('EmailVerificationRequest') }),
    },
    '/api/v1/auth/email-verification/resend': {
      post: operation('Authentication', 'Resend an email verification code', {
        202: { description: 'Generic response to avoid account enumeration.', content: json(ref('MessageResponse')) },
        400: errorResponse('Invalid email address.'),
        429: errorResponse('Authentication request rate limit reached.'),
      }, { operationId: 'resendVerification', requestBody: body('EmailVerificationResendRequest') }),
    },
    '/api/v1/auth/internal-admin-invitations/accept': {
      post: operation('Authentication', 'Accept an Internal Admin invitation and set the account password', {
        200: { description: 'Invitation consumed; account activated.', content: json(ref('InternalAdminResponse')) },
        400: errorResponse('Invitation code is invalid, expired or already used.'), 403: errorResponse('Organisation is inactive.'),
        429: errorResponse('Authentication request rate limit reached.'),
      }, { operationId: 'acceptInternalAdminInvitation', requestBody: body('InternalAdminInvitationAcceptRequest') }),
    },
    '/api/v1/auth/primary-admin-codes': {
      post: operation('Authentication', 'Generate a one-time Primary Admin registration code', {
        201: { description: 'Code and expiration; the plaintext code is returned only once.', content: json(ref('PrimaryAdminCodeResponse')) },
        401: errorResponse('Authentication is required.'),
        403: errorResponse('Only the authenticated Owner may generate the code.'),
        409: errorResponse('Primary Admin exists, does not exist for replacement, or changed concurrently.'),
      }, { operationId: 'issuePrimaryAdminCode', security: auth,
        requestBody: { required: false, content: json(ref('PrimaryAdminCodeRequest')) } }),
    },
    '/api/v1/auth/primary-admin/register': {
      post: operation('Authentication', 'Register the Primary Admin using the one-time code', {
        201: { description: 'Account created; company email verification is required.', content: json(ref('UserRegistrationResponse')) },
        400: errorResponse('Invalid code, organisation, email domain or request body.'),
        409: errorResponse('Code unavailable or Primary Admin position is filled.'),
        503: errorResponse('SMTP email delivery is unavailable.'),
      }, { operationId: 'registerPrimaryAdmin', requestBody: body('PrimaryAdminRegistrationRequest') }),
    },
    '/api/v1/auth/members/register': {
      post: operation('Authentication', 'Register an employee or support agent', {
        201: { description: 'Account created; email verification precedes administrator approval.', content: json(ref('UserRegistrationResponse')) },
        400: errorResponse('Organisation could not be matched to the company email or request is invalid.'),
        409: errorResponse('An account with this email already exists.'),
        503: errorResponse('SMTP email delivery is unavailable.'),
      }, { operationId: 'registerMember', requestBody: body('MemberRegistrationRequest') }),
    },
    '/api/v1/auth/me': {
      get: operation('Authentication', 'Get the authenticated account and organisation', {
        200: { description: 'Account and organisation derived from the verified session.', content: json(ref('MeResponse')) },
        401: errorResponse('Authentication is required.'),
      }, { operationId: 'getMe', security: auth }),
      patch: operation('Authentication', 'Update the authenticated account profile', {
        200: { description: 'Updated account profile.', content: json(ref('UserResponse')) },
        400: errorResponse('Invalid profile fields.'),
        401: errorResponse('Authentication is required.'),
      }, { operationId: 'updateMe', security: auth, requestBody: body('ProfileUpdateRequest') }),
    },
    '/api/v1/auth/password': {
      put: operation('Authentication', 'Change the authenticated account password', {
        200: { description: 'Password changed and all active sessions revoked.', content: json(ref('MessageResponse')) },
        400: errorResponse('Current password is incorrect or new password is invalid.'),
        401: errorResponse('Authentication is required.'),
      }, { operationId: 'changePassword', security: auth, requestBody: body('PasswordChangeRequest') }),
    },
    '/api/v1/auth/sessions': {
      get: operation('Authentication', 'List active sessions for the authenticated account', {
        200: { description: 'Only sessions belonging to the authenticated account are returned.', content: json(ref('SessionListResponse')) },
        401: errorResponse('Authentication is required.'),
      }, { operationId: 'listSessions', security: auth }),
    },
    '/api/v1/auth/sessions/{sessionId}': {
      delete: operation('Authentication', 'Revoke one of the authenticated account sessions', {
        200: { description: 'Session revoked.', content: json(ref('MessageResponse')) },
        401: errorResponse('Authentication is required.'),
        404: errorResponse('Active session not found for the authenticated account.'),
      }, {
        operationId: 'revokeSession',
        security: auth,
        parameters: [{ name: 'sessionId', in: 'path', required: true, description: 'Session identifier.', schema: { type: 'string', format: 'mongo-id' } }],
      }),
    },
    '/api/v1/tickets': {
      get: operation('Tickets', 'List tickets visible to the authenticated account', {
        200: { description: 'Paginated tickets. Employees see their own tickets, Support Agents their assignments, and ticket staff the organisation queue.', content: json(ref('TicketListResponse')) },
        400: errorResponse('Invalid filters or pagination.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('Ticket listing is not permitted.'),
      }, { operationId: 'listTickets', security: auth, parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['Open', 'Assigned', 'In Progress', 'On Hold', 'Resolved'] } },
        { name: 'priority', in: 'query', schema: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] } },
        { name: 'category', in: 'query', schema: { type: 'string', enum: ['Hardware', 'Software', 'Network', 'Access', 'Other'] } },
        { name: 'q', in: 'query', description: 'Search ticket number, title, description or department.', schema: { type: 'string' } },
        { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'ticketNumber', 'title', 'priority', 'status'] } },
        { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        { name: 'assignedAgentId', in: 'query', description: 'Ticket staff only.', schema: { type: 'string', format: 'mongo-id' } },
      ] }),
      post: operation('Tickets', 'Create a ticket as the authenticated Employee', {
        201: { description: 'Ticket created with server-derived owner and organisation.', content: json(ref('TicketResponse')) },
        400: errorResponse('Invalid ticket fields.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('Only active Employees can create tickets.'),
      }, { operationId: 'createTicket', security: auth, requestBody: body('TicketCreateRequest') }),
    },
    '/api/v1/tickets/{ticketId}': { get: operation('Tickets', 'Get a ticket and comments visible to the authenticated account', {
      200: { description: 'Tenant and role scoped ticket details.', content: json(ref('TicketResponse')) }, 401: errorResponse('Authentication is required.'), 403: errorResponse('Ticket access is not permitted.'), 404: errorResponse('Ticket not found in your organisation.'),
    }, { operationId: 'getTicket', security: auth, parameters: [{ name: 'ticketId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }] }) },
    '/api/v1/tickets/{ticketId}/assignment': {
      put: operation('Tickets', 'Assign or reassign a ticket to an active same-organisation Support Agent', {
        200: { description: 'Assignment saved and notifications created.', content: json(ref('TicketResponse')) }, 400: errorResponse('Invalid agent ID.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('tickets:manage is required.'), 404: errorResponse('Ticket or eligible agent not found in this organisation.'), 409: errorResponse('Ticket state prevents assignment.'),
      }, { operationId: 'assignTicket', security: auth, parameters: [{ name: 'ticketId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }], requestBody: body('TicketAssignmentRequest') }),
      delete: operation('Tickets', 'Remove the current Support Agent assignment', {
        200: { description: 'Ticket returned to Open and notifications created.', content: json(ref('TicketResponse')) }, 401: errorResponse('Authentication is required.'), 403: errorResponse('tickets:manage is required.'), 404: errorResponse('Ticket not found.'), 409: errorResponse('Ticket cannot be unassigned in its current state.'),
      }, { operationId: 'unassignTicket', security: auth, parameters: [{ name: 'ticketId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }] }),
    },
    '/api/v1/tickets/{ticketId}/assignment-response': { put: operation('Tickets', 'Accept or reject the authenticated Support Agent assignment', {
      200: { description: 'Assignment accepted or declined; affected parties are notified.', content: json(ref('TicketResponse')) }, 400: errorResponse('Invalid decision or rejection reason.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('Only the assigned Support Agent may respond.'), 404: errorResponse('Ticket not found or not assigned to you.'), 409: errorResponse('There is no pending assignment.'),
    }, { operationId: 'respondToAssignment', security: auth, parameters: [{ name: 'ticketId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }], requestBody: body('AssignmentResponseRequest') }) },
    '/api/v1/tickets/{ticketId}/status': { patch: operation('Tickets', 'Change ticket status using permitted transitions', {
      200: { description: 'Status changed and activity/notifications recorded.', content: json(ref('TicketResponse')) }, 400: errorResponse('Invalid status.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('Only assigned agents or ticket managers may change status.'), 404: errorResponse('Ticket not found.'), 409: errorResponse('Status transition is not allowed.'),
    }, { operationId: 'changeTicketStatus', security: auth, parameters: [{ name: 'ticketId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }], requestBody: body('TicketStatusRequest') }) },
    '/api/v1/tickets/{ticketId}/priority': { patch: operation('Tickets', 'Change ticket priority', {
      200: { description: 'Priority changed and activity/notifications recorded.', content: json(ref('TicketResponse')) }, 400: errorResponse('Invalid priority.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('tickets:manage is required.'), 404: errorResponse('Ticket not found.'),
    }, { operationId: 'changeTicketPriority', security: auth, parameters: [{ name: 'ticketId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }], requestBody: body('TicketPriorityRequest') }) },
    '/api/v1/tickets/{ticketId}/comments': {
      get: operation('Tickets', 'List comments visible to the authenticated account', {
        200: { description: 'Public comments for participants; internal notes are included only for authorised staff.', content: json(ref('CommentListResponse')) }, 401: errorResponse('Authentication is required.'), 403: errorResponse('Ticket access is not permitted.'), 404: errorResponse('Ticket not found.'),
      }, { operationId: 'listTicketComments', security: auth, parameters: [{ name: 'ticketId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }, { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }] }),
      post: operation('Tickets', 'Add a public comment or authorised staff internal note', {
        201: { description: 'Comment created. Internal notes do not notify ticket requesters.', content: json(ref('CommentResponse')) }, 400: errorResponse('Invalid comment.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('Ticket access or internal-note permission is not allowed.'), 404: errorResponse('Ticket not found.'),
      }, { operationId: 'addTicketComment', security: auth, parameters: [{ name: 'ticketId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }], requestBody: body('CommentCreateRequest') }),
    },
    '/api/v1/tickets/{ticketId}/activity': { get: operation('Tickets', 'List timestamped activity visible to the authenticated account', {
      200: { description: 'Ticket history with actor identity; internal events are hidden from Employees.', content: json(ref('ActivityListResponse')) }, 401: errorResponse('Authentication is required.'), 403: errorResponse('Ticket access is not permitted.'), 404: errorResponse('Ticket not found.'),
    }, { operationId: 'listTicketActivity', security: auth, parameters: [{ name: 'ticketId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }, { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }] }) },
    '/api/v1/notifications': { get: operation('Tickets', 'List the authenticated account notifications', {
      200: { description: 'Recipient and tenant scoped notifications with unread count.', content: json(ref('NotificationListResponse')) }, 400: errorResponse('Invalid pagination or read filter.'), 401: errorResponse('Authentication is required.'),
    }, { operationId: 'listNotifications', security: auth, parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }, { name: 'read', in: 'query', schema: { type: 'boolean' } }] }) },
    '/api/v1/notifications/read': { patch: operation('Tickets', 'Mark all of the authenticated account notifications as read', {
      200: { description: 'Read markers updated.', content: json(ref('NotificationReadAllResponse')) }, 401: errorResponse('Authentication is required.'),
    }, { operationId: 'markAllNotificationsRead', security: auth }) },
    '/api/v1/notifications/{notificationId}/read': { patch: operation('Tickets', 'Set one notification read or unread', {
      200: { description: 'Read state updated.', content: json(ref('NotificationResponse')) }, 400: errorResponse('read must be true or false.'), 401: errorResponse('Authentication is required.'), 404: errorResponse('Notification not found for the authenticated account.'),
    }, { operationId: 'setNotificationReadState', security: auth, parameters: [{ name: 'notificationId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }], requestBody: body('NotificationReadRequest') }) },
    '/api/v1/knowledge-base/articles': {
      get: operation('Knowledge Base', 'List knowledge articles visible to the authenticated user', {
        200: { description: 'Paginated article results. Employees and Support Agents see published articles only; administrators with knowledge:read can view drafts and archived articles.', content: json(ref('KnowledgeArticleListResponse')) },
        400: errorResponse('Invalid filters or pagination.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('Requested article state is not visible to this account.'),
      }, { operationId: 'listKnowledgeArticles', security: auth, parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['Draft', 'Published', 'Archived'] } },
        { name: 'category', in: 'query', schema: { type: 'string' } },
        { name: 'q', in: 'query', description: 'Search title, category, summary and content.', schema: { type: 'string' } },
        { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'category'] } },
        { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
      ] }),
      post: operation('Knowledge Base', 'Create a draft or published knowledge article', {
        201: { description: 'Article created and audit event recorded.', content: json(ref('KnowledgeArticleResponse')) },
        400: errorResponse('Invalid article or published content is missing.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('knowledge:manage is required.'), 409: errorResponse('Article slug conflicts with an existing article.'),
      }, { operationId: 'createKnowledgeArticle', security: auth, requestBody: body('KnowledgeArticleCreateRequest') }),
    },
    '/api/v1/knowledge-base/articles/{articleId}': {
      get: operation('Knowledge Base', 'Get an article visible to the authenticated user', {
        200: { description: 'Article from the authenticated organisation.', content: json(ref('KnowledgeArticleResponse')) }, 401: errorResponse('Authentication is required.'), 404: errorResponse('Article not found or not published for this account.'),
      }, { operationId: 'getKnowledgeArticle', security: auth, parameters: [{ name: 'articleId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }] }),
      patch: operation('Knowledge Base', 'Edit an article or change its publication state', {
        200: { description: 'Article updated and audit event recorded.', content: json(ref('KnowledgeArticleResponse')) }, 400: errorResponse('Invalid fields or published content is missing.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('knowledge:manage is required.'), 404: errorResponse('Article not found in this organisation.'),
      }, { operationId: 'updateKnowledgeArticle', security: auth, parameters: [{ name: 'articleId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }], requestBody: body('KnowledgeArticleUpdateRequest') }),
      delete: operation('Knowledge Base', 'Delete an article and retain its audit event', {
        200: { description: 'Article deleted; audit metadata remains available.', content: json(ref('MessageResponse')) }, 401: errorResponse('Authentication is required.'), 403: errorResponse('knowledge:manage is required.'), 404: errorResponse('Article not found in this organisation.'),
      }, { operationId: 'deleteKnowledgeArticle', security: auth, parameters: [{ name: 'articleId', in: 'path', required: true, schema: { type: 'string', format: 'mongo-id' } }] }),
    },
    '/api/v1/reports/summary': { get: operation('Reports', 'Get organisation ticket and Support Agent analytics', {
      200: { description: 'Tenant-scoped counts, workload, resolution metrics and ticket trends for the date range.', content: json(ref('ReportSummaryResponse')) }, 400: errorResponse('Invalid date range.'), 401: errorResponse('Authentication is required.'), 403: errorResponse('reports:read is required.'),
    }, { operationId: 'getReportSummary', security: auth, parameters: [
      { name: 'from', in: 'query', description: 'Inclusive ISO 8601 start date; defaults to 30 days before to.', schema: { type: 'string', format: 'date-time' } },
      { name: 'to', in: 'query', description: 'Inclusive ISO 8601 end date; defaults to now.', schema: { type: 'string', format: 'date-time' } },
    ] }) },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErrorResponse: {
        type: 'object', required: ['error'], properties: {
          error: { type: 'object', required: ['code', 'message'], properties: {
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'Request data failed validation.' },
            details: { type: 'array', items: { type: 'object', additionalProperties: true } },
          } },
        },
      },
      MessageResponse: { type: 'object', properties: { message: { type: 'string' } } },
      User: {
        type: 'object', required: ['id', 'organisationId', 'fullName', 'email', 'role', 'status', 'emailVerified'],
        properties: {
          id: { type: 'string', format: 'mongo-id' },
          organisationId: { type: 'string', format: 'mongo-id' },
          fullName: { type: 'string', example: 'Alex Morgan' },
          email: { type: 'string', format: 'email', example: 'alex@example.org' },
          phone: { type: 'string', example: '+1 555 010 2000' },
          role: { type: 'string', enum: ['OWNER', 'PRIMARY_ADMIN', 'INTERNAL_ADMIN', 'EMPLOYEE', 'SUPPORT_AGENT'] },
          requestedRole: { type: 'string', enum: ['EMPLOYEE', 'SUPPORT_AGENT'], description: 'Member requested role; effective role is assigned by an administrator on approval.' },
          permissions: { type: 'array', items: { type: 'string', enum: ['users:read', 'users:manage', 'agents:read', 'agents:manage', 'departments:read', 'departments:manage', 'settings:read', 'settings:manage', 'audit:read', 'tickets:read', 'tickets:manage', 'knowledge:read', 'knowledge:manage', 'reports:read'] } },
          status: { type: 'string', enum: ['PENDING_EMAIL', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED'] },
          emailVerified: { type: 'boolean' },
          department: { type: 'string' }, employeeId: { type: 'string' }, jobTitle: { type: 'string' },
          experience: { type: 'string' }, skills: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Organisation: {
        type: 'object', properties: {
          id: { type: 'string', format: 'mongo-id' }, name: { type: 'string' }, emailDomain: { type: 'string', example: 'example.org' },
          industry: { type: 'string' }, country: { type: 'string' }, status: { type: 'string', enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'] },
          settings: { $ref: '#/components/schemas/OrganisationSettings' },
        },
      },
      SessionCredentials: {
        type: 'object', required: ['accessToken', 'refreshToken', 'tokenType', 'expiresIn', 'sessionId', 'refreshExpiresAt'], properties: {
          accessToken: { type: 'string', description: 'Short lived JWT. Example is a placeholder.', example: '<access-token>' },
          refreshToken: { type: 'string', description: 'Opaque rotating refresh token. Example is a placeholder.', example: '<refresh-token>' },
          tokenType: { type: 'string', example: 'Bearer' }, expiresIn: { type: 'string', example: '15m' },
          sessionId: { type: 'string', format: 'mongo-id' }, refreshExpiresAt: { type: 'string', format: 'date-time' },
        },
      },
      OrganisationRegistrationRequest: {
        type: 'object', required: ['organisationName', 'domain', 'ownerName', 'email', 'phone', 'industry', 'country', 'password'],
        properties: {
          organisationName: { type: 'string', example: 'Example Company' }, domain: { type: 'string', example: 'example.org' },
          ownerName: { type: 'string', example: 'Alex Morgan' }, email: { type: 'string', format: 'email', example: 'alex@example.org' },
          phone: { type: 'string', example: '+1 555 010 2000' }, industry: { type: 'string', example: 'Technology' },
          country: { type: 'string', example: 'United States' }, password: { type: 'string', format: 'password', example: '<choose-a-password>' },
        },
      },
      OrganisationRegistrationResponse: {
        type: 'object', properties: {
          message: { type: 'string' }, organisation: ref('Organisation'), user: ref('User'), emailVerificationRequired: { type: 'boolean' },
        },
      },
      LoginRequest: {
        type: 'object', required: ['email', 'password'], properties: {
          email: { type: 'string', format: 'email', example: 'alex@example.org' },
          password: { type: 'string', format: 'password', example: '<account-password>' },
        },
      },
      LoginResponse: { type: 'object', properties: { user: ref('User'), session: ref('SessionCredentials') } },
      RefreshRequest: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string', example: '<refresh-token>' } } },
      EmailVerificationRequest: {
        type: 'object', required: ['email', 'code'], properties: {
          email: { type: 'string', format: 'email', example: 'alex@example.org' }, code: { type: 'string', pattern: '^\\d{6}$', example: '000000' },
        },
      },
      EmailVerificationResendRequest: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email', example: 'alex@example.org' } } },
      EmailVerificationResponse: { type: 'object', properties: { message: { type: 'string' }, user: ref('User') } },
      PrimaryAdminCodeResponse: {
        type: 'object', properties: {
          message: { type: 'string' }, code: { type: 'string', description: 'One-time code shown only to the authenticated Owner.', example: '000000' }, expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      PrimaryAdminCodeRequest: {
        type: 'object', properties: {
          replaceCurrent: { type: 'boolean', default: false, description: 'Set true only when replacing an existing Primary Admin.' },
          currentPassword: { type: 'string', format: 'password', example: '<owner-password>', description: 'Required when replaceCurrent is true.' },
        },
      },
      PrimaryAdminRegistrationRequest: {
        type: 'object', required: ['organisationName', 'fullName', 'email', 'phone', 'registrationCode', 'password'], properties: {
          organisationName: { type: 'string', example: 'Example Company' }, fullName: { type: 'string', example: 'Jordan Lee' },
          email: { type: 'string', format: 'email', example: 'jordan@example.org' }, phone: { type: 'string', example: '+1 555 010 2001' },
          registrationCode: { type: 'string', pattern: '^\\d{6}$', example: '000000' }, password: { type: 'string', format: 'password', example: '<choose-a-password>' },
        },
      },
      MemberRegistrationRequest: {
        type: 'object', required: ['organisationName', 'email', 'fullName', 'phone', 'accountType', 'department', 'jobTitle', 'experience', 'password'], properties: {
          organisationName: { type: 'string', example: 'Example Company' }, email: { type: 'string', format: 'email', example: 'employee@example.org' },
          fullName: { type: 'string', example: 'Taylor Reed' }, phone: { type: 'string', example: '+1 555 010 2002' },
          employeeId: { type: 'string', example: 'EMP-1042' }, accountType: { type: 'string', enum: ['Employee', 'Support Agent'] },
          department: { type: 'string', example: 'IT Support' }, jobTitle: { type: 'string', example: 'Analyst' },
          experience: { type: 'string', example: '1–2 years' }, skills: { oneOf: [{ type: 'string', example: 'Networking, Windows' }, { type: 'array', items: { type: 'string' } }] },
          password: { type: 'string', format: 'password', example: '<choose-a-password>' },
        },
      },
      UserRegistrationResponse: { type: 'object', properties: { message: { type: 'string' }, user: ref('User'), emailVerificationRequired: { type: 'boolean' } } },
      MemberListResponse: { type: 'object', properties: { members: { type: 'array', items: ref('User') } } },
      MemberReviewRequest: {
        type: 'object', required: ['decision'], properties: {
          decision: { type: 'string', enum: ['APPROVE', 'REJECT'] },
          approvedRole: { type: 'string', enum: ['EMPLOYEE', 'SUPPORT_AGENT'], description: 'Required for APPROVE; the administrator explicitly selects the effective role.' },
          reason: { type: 'string', maxLength: 500, description: 'Required for REJECT.' },
        },
      },
      MemberReviewResponse: { type: 'object', properties: { message: { type: 'string' }, member: ref('User') } },
      Permission: { type: 'string', enum: ['users:read', 'users:manage', 'agents:read', 'agents:manage', 'departments:read', 'departments:manage', 'settings:read', 'settings:manage', 'audit:read', 'tickets:read', 'tickets:manage', 'knowledge:read', 'knowledge:manage', 'reports:read'] },
      InternalAdminCreateRequest: {
        type: 'object', required: ['fullName', 'email', 'phone', 'permissions'], properties: {
          fullName: { type: 'string', example: 'Sam Administrator' },
          email: { type: 'string', format: 'email', example: 'sam@example.org' },
          phone: { type: 'string', example: '+1 555 010 2040' },
          permissions: { type: 'array', uniqueItems: true, items: ref('Permission') },
        },
      },
      InternalAdminPermissionsRequest: {
        type: 'object', required: ['permissions'], properties: { permissions: { type: 'array', uniqueItems: true, items: ref('Permission') } },
      },
      AccountStatusRequest: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] } } },
      InternalAdminInvitationResponse: { type: 'object', properties: { message: { type: 'string' }, user: ref('User'), invitationExpiresAt: { type: 'string', format: 'date-time' } } },
      InternalAdminInvitationAcceptRequest: {
        type: 'object', required: ['email', 'code', 'password'], properties: {
          email: { type: 'string', format: 'email', example: 'sam@example.org' },
          code: { type: 'string', pattern: '^\\d{6}$', example: '000000' },
          password: { type: 'string', format: 'password', example: '<choose-a-password>' },
        },
      },
      InternalAdminResponse: { type: 'object', properties: { message: { type: 'string' }, internalAdmin: ref('User'), user: ref('User') } },
      InternalAdminListResponse: { type: 'object', properties: { internalAdmins: { type: 'array', items: ref('User') } } },
      UserListResponse: { type: 'object', properties: { users: { type: 'array', items: ref('User') } } },
      OrganisationSettings: {
        type: 'object', properties: {
          supportEmail: { type: 'string', format: 'email', nullable: true },
          timezone: { type: 'string', example: 'Asia/Kolkata' }, memberRegistrationEnabled: { type: 'boolean', default: true },
        },
      },
      OrganisationSettingsUpdateRequest: {
        type: 'object', properties: {
          name: { type: 'string', example: 'Example Company' }, industry: { type: 'string', example: 'Technology' },
          country: { type: 'string', example: 'India' }, supportEmail: { type: 'string', format: 'email', example: 'help@example.org' },
          timezone: { type: 'string', example: 'Asia/Kolkata' }, memberRegistrationEnabled: { type: 'boolean' },
        },
      },
      OrganisationSettingsResponse: { type: 'object', properties: { organisation: ref('Organisation') } },
      Department: {
        type: 'object', properties: {
          id: { type: 'string', format: 'mongo-id' }, name: { type: 'string', example: 'IT Support' }, description: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      DepartmentCreateRequest: { type: 'object', required: ['name'], properties: { name: { type: 'string', example: 'IT Support' }, description: { type: 'string', maxLength: 500 } } },
      DepartmentUpdateRequest: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string', maxLength: 500 }, status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } } },
      DepartmentResponse: { type: 'object', properties: { department: ref('Department') } },
      DepartmentListResponse: { type: 'object', properties: { departments: { type: 'array', items: ref('Department') } } },
      AuditEvent: {
        type: 'object', properties: {
          id: { type: 'string', format: 'mongo-id' }, actorId: { type: 'string', format: 'mongo-id' }, actorName: { type: 'string' }, actorRole: { type: 'string' },
          action: { type: 'string', example: 'DEPARTMENT_CREATED' }, targetType: { type: 'string' }, targetId: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true }, ipAddress: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuditEventListResponse: { type: 'object', properties: { events: { type: 'array', items: ref('AuditEvent') }, nextBefore: { type: 'string', format: 'date-time', nullable: true } } },
      ProfileUpdateRequest: { type: 'object', required: ['fullName', 'phone'], properties: { fullName: { type: 'string', example: 'Alex Morgan' }, phone: { type: 'string', example: '+1 555 010 2000' } } },
      UserResponse: { type: 'object', properties: { user: ref('User') } },
      MeResponse: { type: 'object', properties: { user: ref('User'), organisation: ref('Organisation') } },
      PasswordChangeRequest: { type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string', format: 'password', example: '<current-password>' }, newPassword: { type: 'string', format: 'password', example: '<new-password>' } } },
      Session: { type: 'object', properties: { id: { type: 'string', format: 'mongo-id' }, userAgent: { type: 'string' }, ipAddress: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, expiresAt: { type: 'string', format: 'date-time' }, current: { type: 'boolean' } } },
      SessionListResponse: { type: 'object', properties: { sessions: { type: 'array', items: ref('Session') } } },
      HealthResponse: {
        type: 'object', required: ['status', 'service', 'timestamp', 'database'], properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] }, service: { type: 'string', example: 'smarttracker-api' },
          timestamp: { type: 'string', format: 'date-time' }, database: { type: 'object', properties: {
            status: { type: 'string', enum: ['disconnected', 'connected', 'connecting', 'disconnecting', 'unknown'] },
            ready: { type: 'boolean' }, name: { type: 'string', nullable: true, example: 'smarttracker' },
          } },
        },
      },
      KnowledgeArticle: { type: 'object', example: { id: '507f1f77bcf86cd799439021', title: 'How to reset your password', slug: 'how-to-reset-your-password', category: 'Account Access', summary: 'Reset an account password through the identity portal.', content: 'Open the identity portal and follow the password reset steps.', status: 'Published', createdAt: '2026-11-05T08:00:00.000Z', updatedAt: '2026-11-05T08:00:00.000Z' }, properties: { id: { type: 'string', format: 'mongo-id' }, title: { type: 'string' }, slug: { type: 'string' }, category: { type: 'string' }, summary: { type: 'string' }, content: { type: 'string' }, status: { type: 'string', enum: ['Draft', 'Published', 'Archived'] }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }, publishedAt: { type: 'string', format: 'date-time', nullable: true }, archivedAt: { type: 'string', format: 'date-time', nullable: true } } },
      KnowledgeArticleCreateRequest: { type: 'object', required: ['title', 'category'], example: { title: 'How to reset your password', category: 'Account Access' }, properties: { title: { type: 'string', minLength: 3, maxLength: 180 }, category: { type: 'string', maxLength: 100 }, summary: { type: 'string', maxLength: 500 }, content: { type: 'string', maxLength: 50000, description: 'Required to create the article directly in Published state.' }, status: { type: 'string', enum: ['Draft', 'Published', 'Archived'], default: 'Draft' } } },
      KnowledgeArticleUpdateRequest: { type: 'object', example: { content: 'Open the identity portal and follow the password reset steps.', status: 'Published' }, properties: { title: { type: 'string', minLength: 3, maxLength: 180 }, category: { type: 'string', maxLength: 100 }, summary: { type: 'string', maxLength: 500 }, content: { type: 'string', maxLength: 50000 }, status: { type: 'string', enum: ['Draft', 'Published', 'Archived'] } } },
      KnowledgeArticleResponse: { type: 'object', properties: { article: ref('KnowledgeArticle') } },
      KnowledgeArticleListResponse: { type: 'object', properties: { articles: { type: 'array', items: ref('KnowledgeArticle') }, pagination: ref('Pagination') } },
      ReportSummaryResponse: { type: 'object', example: { range: { from: '2026-10-06T00:00:00.000Z', to: '2026-11-05T00:00:00.000Z' }, totals: { tickets: 12, resolved: 8, open: 4 }, statusCounts: { OPEN: 2, ASSIGNED: 1, IN_PROGRESS: 1, ON_HOLD: 0, RESOLVED: 8 }, priorityCounts: { LOW: 2, MEDIUM: 5, HIGH: 4, CRITICAL: 1 }, departmentCounts: [{ department: 'IT Support', count: 7 }], agentPerformance: [], resolution: { resolvedInRange: 8, averageMinutes: 240, totalMinutes: 1920 }, trends: [] }, properties: { range: { type: 'object', properties: { from: { type: 'string', format: 'date-time' }, to: { type: 'string', format: 'date-time' } } }, totals: { type: 'object', additionalProperties: { type: 'integer' } }, statusCounts: { type: 'object', additionalProperties: { type: 'integer' } }, priorityCounts: { type: 'object', additionalProperties: { type: 'integer' } }, departmentCounts: { type: 'array', items: { type: 'object', properties: { department: { type: 'string' }, count: { type: 'integer' } } } }, agentPerformance: { type: 'array', items: { type: 'object', properties: { agentId: { type: 'string', format: 'mongo-id' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, assigned: { type: 'integer' }, resolved: { type: 'integer' }, averageResolutionMinutes: { type: 'integer', nullable: true } } } }, resolution: { type: 'object', properties: { resolvedInRange: { type: 'integer' }, averageMinutes: { type: 'integer', nullable: true }, totalMinutes: { type: 'integer' } } }, trends: { type: 'array', items: { type: 'object', properties: { period: { type: 'string' }, created: { type: 'integer' }, currentlyResolved: { type: 'integer' } } } } } },
      TicketCreateRequest: { type: 'object', required: ['title', 'description', 'category'], example: { title: 'Laptop will not start', description: 'The device does not power on after charging.', category: 'Hardware', priority: 'High', department: 'IT' }, properties: { title: { type: 'string', minLength: 3, maxLength: 160, example: 'Laptop will not start' }, description: { type: 'string', minLength: 5, maxLength: 10000, example: 'The device does not power on after charging.' }, category: { type: 'string', enum: ['Hardware', 'Software', 'Network', 'Access', 'Other'] }, priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' }, department: { type: 'string', example: 'IT' }, departmentId: { type: 'string', format: 'mongo-id' } } },
      Ticket: { type: 'object', example: { id: '507f1f77bcf86cd799439011', ticketNumber: 'ST-1A2B3C4D', title: 'Laptop will not start', description: 'The device does not power on after charging.', category: 'Hardware', priority: 'High', status: 'Assigned', acceptance: 'Pending', employeeEmail: 'employee@example.org', employeeName: 'Taylor Reed', department: 'IT', agentEmail: 'agent@example.org', agentName: 'Jordan Lee', createdAt: '2026-11-05T08:00:00.000Z', updatedAt: '2026-11-05T08:10:00.000Z' }, properties: { id: { type: 'string', format: 'mongo-id' }, ticketNumber: { type: 'string', example: 'ST-1A2B3C4D' }, title: { type: 'string' }, description: { type: 'string' }, category: { type: 'string', enum: ['Hardware', 'Software', 'Network', 'Access', 'Other'] }, priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] }, status: { type: 'string', enum: ['Open', 'Assigned', 'In Progress', 'On Hold', 'Resolved'] }, acceptance: { type: 'string', enum: ['Not Assigned', 'Pending', 'Accepted', 'Rejected'] }, employeeEmail: { type: 'string', format: 'email' }, employeeName: { type: 'string' }, department: { type: 'string' }, agentEmail: { type: 'string', format: 'email' }, agentName: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }, comments: { type: 'array', items: ref('Comment') }, internalNotes: { type: 'array', items: ref('Comment'), description: 'Returned only to authorised staff.' } } },
      Pagination: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } },
      TicketResponse: { type: 'object', properties: { ticket: ref('Ticket') } }, TicketListResponse: { type: 'object', properties: { tickets: { type: 'array', items: ref('Ticket') }, pagination: ref('Pagination') } },
      TicketAssignmentRequest: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string', format: 'mongo-id' } }, example: { agentId: '507f1f77bcf86cd799439011' } },
      AssignmentResponseRequest: { type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['ACCEPT', 'REJECT'] }, reason: { type: 'string', minLength: 3, maxLength: 1000, description: 'Required for REJECT.' } } },
      TicketStatusRequest: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['Open', 'Assigned', 'In Progress', 'On Hold', 'Resolved'] } } },
      TicketPriorityRequest: { type: 'object', required: ['priority'], properties: { priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] } } },
      Comment: { type: 'object', example: { id: '507f1f77bcf86cd799439012', author: 'Taylor Reed', authorRole: 'EMPLOYEE', message: 'Any update on this issue?', isInternal: false, createdAt: '2026-11-05T08:15:00.000Z' }, properties: { id: { type: 'string', format: 'mongo-id' }, author: { type: 'string' }, authorRole: { type: 'string' }, message: { type: 'string' }, isInternal: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' } } },
      CommentCreateRequest: { type: 'object', required: ['message'], example: { message: 'Any update on this issue?', isInternal: false }, properties: { message: { type: 'string', minLength: 1, maxLength: 5000 }, isInternal: { type: 'boolean', default: false, description: 'Only assigned Support Agents and authorised ticket staff may set true.' } } },
      CommentResponse: { type: 'object', properties: { comment: ref('Comment') } }, CommentListResponse: { type: 'object', properties: { comments: { type: 'array', items: ref('Comment') }, pagination: ref('Pagination') } },
      Activity: { type: 'object', properties: { id: { type: 'string', format: 'mongo-id' }, actorName: { type: 'string' }, actorRole: { type: 'string' }, action: { type: 'string' }, details: { type: 'object', additionalProperties: true }, createdAt: { type: 'string', format: 'date-time' } } },
      ActivityListResponse: { type: 'object', properties: { activities: { type: 'array', items: ref('Activity') }, pagination: ref('Pagination') } },
      Notification: { type: 'object', example: { id: '507f1f77bcf86cd799439013', ticketId: '507f1f77bcf86cd799439011', type: 'TICKET_ASSIGNED', title: 'New ticket assigned', message: 'Ticket ST-1A2B3C4D has been assigned to you.', read: false, createdAt: '2026-11-05T08:10:00.000Z' }, properties: { id: { type: 'string', format: 'mongo-id' }, ticketId: { type: 'string', format: 'mongo-id' }, type: { type: 'string' }, title: { type: 'string' }, message: { type: 'string' }, read: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' } } },
      NotificationListResponse: { type: 'object', properties: { notifications: { type: 'array', items: ref('Notification') }, unreadCount: { type: 'integer' }, pagination: ref('Pagination') } },
      NotificationReadRequest: { type: 'object', required: ['read'], properties: { read: { type: 'boolean' } } },
      NotificationResponse: { type: 'object', properties: { notification: ref('Notification') } }, NotificationReadAllResponse: { type: 'object', properties: { message: { type: 'string' }, updatedCount: { type: 'integer' } } },
    },
  },
};

module.exports = openApiDocument;
