import { organisationService } from './organisationService';

export const userService = {
  list: (filters) => organisationService.listUsers(filters),
  updateStatus: (userId, status) => organisationService.updateUserStatus(userId, status),
  listPendingApprovals: () => organisationService.listPendingMembers(),
  reviewRegistration: (memberId, decision, role, reason) => organisationService.reviewMember(memberId, decision, role, reason),
};
