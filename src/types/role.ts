export interface Role {
  id: number;
  name: string;
  code?: string;
  description?: string;
  defaultPath?: string;
  system?: boolean;
}

export interface RoleMenu {
  id: number;
  roleId: number;
  menuId: number;
  menuName: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export interface AssignRoleRequest {
  userId: number;
  roleId: number;
}

export interface AssignMenuRequest {
  menuId: number;
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
}
