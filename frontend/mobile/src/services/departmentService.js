import { organisationService } from './organisationService';

export const departmentService = {
  list: (status) => organisationService.listDepartments(status),
  create: (name, description) => organisationService.createDepartment(name, description),
  update: (id, changes) => organisationService.updateDepartment(id, changes),
};
