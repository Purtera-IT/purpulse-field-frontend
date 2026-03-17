/**
 * Permission Model — Role-based access control
 * Maps user roles to UI capabilities
 */

export type UserRole = 'admin' | 'dispatcher' | 'technician' | 'viewer';

export interface PermissionClaim {
  action: string;
  resource: string;
  granted: boolean;
}

export interface UserPermissions {
  role: UserRole;
  claims: PermissionClaim[];
  canCompleteJob: boolean;
  canCancelJob: boolean;
  canReopenJob: boolean;
  canEditJob: boolean;
  canViewAudit: boolean;
  canManageUsers: boolean;
  canExportData: boolean;
  canApproveLabels: boolean;
  canDeleteEvidence: boolean;
}

// Role-based permission matrix
const ROLE_PERMISSIONS: Record<UserRole, Partial<UserPermissions>> = {
  admin: {
    canCompleteJob: true,
    canCancelJob: true,
    canReopenJob: true,
    canEditJob: true,
    canViewAudit: true,
    canManageUsers: true,
    canExportData: true,
    canApproveLabels: true,
    canDeleteEvidence: true,
  },
  dispatcher: {
    canCompleteJob: true,
    canCancelJob: true,
    canReopenJob: true,
    canEditJob: true,
    canViewAudit: true,
    canManageUsers: false,
    canExportData: false,
    canApproveLabels: false,
    canDeleteEvidence: false,
  },
  technician: {
    canCompleteJob: false,
    canCancelJob: false,
    canReopenJob: false,
    canEditJob: false,
    canViewAudit: false,
    canManageUsers: false,
    canExportData: false,
    canApproveLabels: false,
    canDeleteEvidence: false,
  },
  viewer: {
    canCompleteJob: false,
    canCancelJob: false,
    canReopenJob: false,
    canEditJob: false,
    canViewAudit: false,
    canManageUsers: false,
    canExportData: false,
    canApproveLabels: false,
    canDeleteEvidence: false,
  },
};

/**
 * Build permission claims from user role
 */
export function buildPermissions(role: UserRole): UserPermissions {
  const basePerms = ROLE_PERMISSIONS[role] || {};

  const claims: PermissionClaim[] = [
    { action: 'complete', resource: 'job', granted: basePerms.canCompleteJob ?? false },
    { action: 'cancel', resource: 'job', granted: basePerms.canCancelJob ?? false },
    { action: 'reopen', resource: 'job', granted: basePerms.canReopenJob ?? false },
    { action: 'edit', resource: 'job', granted: basePerms.canEditJob ?? false },
    { action: 'view', resource: 'audit', granted: basePerms.canViewAudit ?? false },
    { action: 'manage', resource: 'users', granted: basePerms.canManageUsers ?? false },
    { action: 'export', resource: 'data', granted: basePerms.canExportData ?? false },
    { action: 'approve', resource: 'labels', granted: basePerms.canApproveLabels ?? false },
    { action: 'delete', resource: 'evidence', granted: basePerms.canDeleteEvidence ?? false },
  ];

  return {
    role,
    claims,
    canCompleteJob: basePerms.canCompleteJob ?? false,
    canCancelJob: basePerms.canCancelJob ?? false,
    canReopenJob: basePerms.canReopenJob ?? false,
    canEditJob: basePerms.canEditJob ?? false,
    canViewAudit: basePerms.canViewAudit ?? false,
    canManageUsers: basePerms.canManageUsers ?? false,
    canExportData: basePerms.canExportData ?? false,
    canApproveLabels: basePerms.canApproveLabels ?? false,
    canDeleteEvidence: basePerms.canDeleteEvidence ?? false,
  };
}

/**
 * Check if user has permission for action
 */
export function hasPermission(
  permissions: UserPermissions | null,
  action: string,
  resource: string
): boolean {
  if (!permissions) return false;
  const claim = permissions.claims.find(c => c.action === action && c.resource === resource);
  return claim?.granted ?? false;
}