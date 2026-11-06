function publicUser(user) {
  return {
    id: String(user._id),
    organisationId: String(user.organisationId),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    ...(user.requestedRole ? { requestedRole: user.requestedRole } : {}),
    ...(user.role === 'INTERNAL_ADMIN' ? { permissions: user.permissions || [] } : {}),
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    department: user.department || '',
    employeeId: user.employeeId || '',
    jobTitle: user.jobTitle || '',
    experience: user.experience || '',
    skills: user.skills || [],
    createdAt: user.createdAt,
  };
}

module.exports = publicUser;
