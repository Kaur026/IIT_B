/**
 * Frontend permission hints for the approved policy.
 * These checks control navigation and affordances only. Backend authorization
 * remains authoritative; local persona state is never an identity credential.
 */
export type UserRole =
  | 'User'
  | 'AWW'
  | 'LS'
  | 'CDPO'
  | 'DPO'
  | 'System Administrator'
  | 'Rule Administrator'
  | 'Parent/Family';

export interface RoleConfig {
  role: UserRole;
  label: string;
  fullTitle: string;
  scopeLevel: 'Public' | 'Centre' | 'Sector' | 'Project' | 'District' | 'Administrative' | 'Family';
  defaultId: string;
  defaultScope: string;
  description: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  User: {
    role: 'User', label: 'Public User', fullTitle: 'Public User', scopeLevel: 'Public',
    defaultId: 'PUBLIC', defaultScope: 'Public aggregates only',
    description: 'Public pages and aggregate statistics only.',
  },
  AWW: {
    role: 'AWW', label: 'Anganwadi Worker', fullTitle: 'Anganwadi Worker (Frontline)', scopeLevel: 'Centre',
    defaultId: 'AWW-409', defaultScope: 'AWC-702',
    description: 'Assigned-centre work: registration, measurements, permitted follow-ups, and referrals.',
  },
  LS: {
    role: 'LS', label: 'Lady Supervisor', fullTitle: 'Lady Supervisor', scopeLevel: 'Sector',
    defaultId: 'LS-01', defaultScope: 'Assigned sector',
    description: 'Assigned-sector supervision, verification, authorized tasks, referrals, and follow-ups.',
  },
  CDPO: {
    role: 'CDPO', label: 'CDPO', fullTitle: 'Child Development Project Officer', scopeLevel: 'Project',
    defaultId: 'CDPO-01', defaultScope: 'Assigned project',
    description: 'Assigned-project oversight, reports, and approved task coordination.',
  },
  DPO: {
    role: 'DPO', label: 'District Programme Officer', fullTitle: 'District Programme Officer', scopeLevel: 'District',
    defaultId: 'DPO-01', defaultScope: 'Assigned district',
    description: 'District aggregate oversight and read-only reports; beneficiary details are restricted by default.',
  },
  'System Administrator': {
    role: 'System Administrator', label: 'System Administrator', fullTitle: 'System Administrator', scopeLevel: 'Administrative',
    defaultId: 'SYSADMIN-01', defaultScope: 'Administrative functions only',
    description: 'Account, role, and organization-assignment administration; no automatic case-data access.',
  },
  'Rule Administrator': {
    role: 'Rule Administrator', label: 'Rule Administrator', fullTitle: 'Rule Administrator', scopeLevel: 'Administrative',
    defaultId: 'RULEADMIN-01', defaultScope: 'Rule-change workflow only',
    description: 'May draft and submit rule changes. Approval is disabled until an authority is designated.',
  },
  'Parent/Family': {
    role: 'Parent/Family', label: 'Parent / Family Member', fullTitle: 'Parent & Family Portal', scopeLevel: 'Family',
    defaultId: 'FAM-0142', defaultScope: 'Linked Child: Aarav Sharma (BEN-0142)',
    description: 'Family view for growth tracking, developmental milestones, nutrition guidance, and scheduled check-ups.',
  },
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROLE_CONFIGS, value);
}

export const DEMO_AWW_WORKER_CENTRES: Record<string, string> = {
  'AWW-409': 'AWC-702',
  'AWW-412': 'AWC-702',
  'AWW-405': 'AWC-703',
  'AWW-410': 'AWC-704',
  'AWW-417': 'AWC-705',
  'AWW-421': 'AWC-706',
};

export function isValidDemoPersona(value: unknown): value is { id: string; role: UserRole; roleLabel: string; signedInAt: string; centreCode?: string; linkedBeneficiaryIds?: string[]; familyId?: string } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!isUserRole(candidate.role) || typeof candidate.id !== 'string' || typeof candidate.signedInAt !== 'string') return false;
  const config = ROLE_CONFIGS[candidate.role];
  if (candidate.roleLabel !== config.label || !Number.isFinite(Date.parse(candidate.signedInAt))) return false;
  if (candidate.role === 'AWW') {
    return Object.prototype.hasOwnProperty.call(DEMO_AWW_WORKER_CENTRES, candidate.id);
  }
  if (candidate.role === 'Parent/Family') {
    return candidate.id === config.defaultId || candidate.id.startsWith('FAM-');
  }
  return candidate.id === config.defaultId;
}

export interface PermissionMatrixItem {
  id: string;
  label: string;
  category: 'screen' | 'action';
  description: string;
  user: string;
  aww: string;
  ls: string;
  cdpo: string;
  dpo: string;
  systemAdministrator: string;
  ruleAdministrator: string;
  supervisorNote: string;
}

export const PERMISSION_MATRIX: PermissionMatrixItem[] = [
  { id: 'beneficiaries', label: 'Beneficiary records', category: 'screen', description: 'Beneficiary register and profiles', user: 'aggregate only', aww: 'assigned centre', ls: 'assigned sector', cdpo: 'assigned project', dpo: 'detail denied by default', systemAdministrator: 'no access', ruleAdministrator: 'no access', supervisorNote: 'DPO detail requires explicit, time-limited authorization' },
  { id: 'record_measurement', label: 'Record measurement', category: 'action', description: 'Record an operational measurement', user: 'no', aww: 'assigned centre', ls: 'authorized centres', cdpo: 'no', dpo: 'no', systemAdministrator: 'no', ruleAdministrator: 'no', supervisorNote: 'AWW cannot approve their own measurements' },
  { id: 'verify_measurement', label: 'Verify measurement', category: 'action', description: 'Independent measurement verification', user: 'no', aww: 'no', ls: 'authorized centres', cdpo: 'no', dpo: 'no', systemAdministrator: 'no', ruleAdministrator: 'no', supervisorNote: 'No self-approval' },
  { id: 'assign_owner', label: 'Coordinate tasks', category: 'action', description: 'Assign authorized task ownership', user: 'no', aww: 'no', ls: 'sector', cdpo: 'approved project coordination', dpo: 'no', systemAdministrator: 'no', ruleAdministrator: 'no', supervisorNote: 'Task workflow limits remain separately enforced' },
  { id: 'referrals', label: 'Referrals and follow-ups', category: 'action', description: 'Create referrals and perform permitted follow-up workflow', user: 'no', aww: 'assigned work', ls: 'sector workflow', cdpo: 'project workflow', dpo: 'read-only aggregate', systemAdministrator: 'no', ruleAdministrator: 'no', supervisorNote: 'Resolution follows approved workflow' },
  { id: 'reports', label: 'Reports and audit', category: 'screen', description: 'Scope-limited reports and audit history', user: 'public aggregates', aww: 'no', ls: 'sector', cdpo: 'project', dpo: 'district aggregates', systemAdministrator: 'authorization audit only', ruleAdministrator: 'rule-change history', supervisorNote: 'Sensitive detail remains scoped' },
  { id: 'rules', label: 'Rule changes', category: 'action', description: 'Draft, submit, and approve rule changes', user: 'no', aww: 'no', ls: 'view only', cdpo: 'view only', dpo: 'no', systemAdministrator: 'no approval', ruleAdministrator: 'draft and submit', supervisorNote: 'Approval unavailable until authority is designated' },
  { id: 'user_management', label: 'Accounts and assignments', category: 'action', description: 'Manage users, roles, and organizational assignments', user: 'no', aww: 'no', ls: 'no', cdpo: 'no', dpo: 'no', systemAdministrator: 'yes', ruleAdministrator: 'no', supervisorNote: 'No automatic beneficiary-data access' },
];

export interface PortalNavItem {
  id: string;
  name: string;
  href: string;
  scopeBadge?: string;
}

export function getNavItemsForRole(role: UserRole | null | undefined): PortalNavItem[] {
  if (!role || role === 'User') return [{ id: 'dashboard', name: 'Overview', href: '/dashboard' }];

  if (role === 'AWW') return [
    { id: 'dashboard', name: 'Dashboard', href: '/dashboard' },
    { id: 'beneficiaries', name: 'Beneficiaries', href: '/beneficiaries', scopeBadge: 'Assigned Centre' },
    { id: 'register', name: 'Register Beneficiary', href: '/beneficiaries/register' },
    { id: 'measurements', name: 'Record Measurement', href: '/measurements' },
    { id: 'queue', name: 'My Cases', href: '/queue' },
    { id: 'referrals', name: 'Referrals & Follow-ups', href: '/referrals' },
    { id: 'profile', name: 'Staff Profile', href: '/profile' },
  ];

  if (role === 'LS') return [
    { id: 'dashboard', name: 'Dashboard', href: '/dashboard' },
    { id: 'beneficiaries', name: 'Beneficiaries', href: '/beneficiaries', scopeBadge: 'Assigned Sector' },
    { id: 'measurements', name: 'Measurement Review', href: '/measurements' },
    { id: 'verification-queue', name: 'Verification Queue', href: '/queue?view=verification', scopeBadge: 'Spot-Check' },
    { id: 'queue', name: 'My Cases', href: '/queue', scopeBadge: 'Sector' },
    { id: 'referrals', name: 'Referrals & Follow-ups', href: '/referrals' },
    { id: 'reports', name: 'Reports', href: '/reports' },
    { id: 'profile', name: 'Staff Profile', href: '/profile' },
  ];

  if (role === 'CDPO') return [
    { id: 'dashboard', name: 'Dashboard', href: '/dashboard' },
    { id: 'beneficiaries', name: 'Beneficiaries', href: '/beneficiaries', scopeBadge: 'Project' },
    { id: 'all-centres', name: 'All Centres', href: '/centres', scopeBadge: '5 Centres' },
    { id: 'measurements', name: 'Measurement Monitoring', href: '/measurements' },
    { id: 'queue', name: 'Action Queue', href: '/queue' },
    { id: 'referrals', name: 'Referrals', href: '/referrals' },
    { id: 'reports', name: 'Reports', href: '/reports' },
    { id: 'profile', name: 'Staff Profile', href: '/profile' },
  ];

  if (role === 'DPO') return [
    { id: 'district-overview', name: 'District Overview', href: '/dashboard' },
    { id: 'centre-performance', name: 'Centre Performance', href: '/dashboard#centre-performance' },
    { id: 'beneficiary-stats', name: 'Beneficiary Statistics', href: '/dashboard#beneficiary-statistics' },
    { id: 'screening-trends', name: 'Screening Trends', href: '/dashboard#screening-trends' },
    { id: 'referrals-overview', name: 'Referrals Overview', href: '/dashboard#referrals-overview' },
    { id: 'reports', name: 'Reports', href: '/reports' },
    { id: 'audit-logs', name: 'Audit Logs', href: '/reports#audit-log' },
    { id: 'profile', name: 'Staff Profile', href: '/profile' },
  ];

  if (role === 'System Administrator') return [
    { id: 'dashboard', name: 'Dashboard', href: '/dashboard' },
    { id: 'audit-logs', name: 'Audit Logs', href: '/reports#audit-log' },
    { id: 'profile', name: 'Staff Profile', href: '/profile' },
  ];

  if (role === 'Rule Administrator') return [
    { id: 'dashboard', name: 'Dashboard', href: '/dashboard' },
    { id: 'rule-settings', name: 'Rule Settings', href: '/rules#rule-catalog' },
    { id: 'screening-testbench', name: 'Screening Test Bench', href: '/rules#test-bench' },
    { id: 'rule-test-results', name: 'Rule Test Results', href: '/rules#rule-test-results' },
    { id: 'audit-logs', name: 'Audit Logs', href: '/reports#audit-log' },
    { id: 'profile', name: 'Staff Profile', href: '/profile' },
  ];

  if (role === 'Parent/Family') return [
    { id: 'dashboard', name: 'My Dashboard', href: '/dashboard' },
    { id: 'child-profile', name: 'My Child', href: '/dashboard#child-profile' },
    { id: 'growth-tracking', name: 'Growth Tracking', href: '/dashboard#growth-tracking' },
    { id: 'nutrition-care', name: 'Nutrition & Care', href: '/dashboard#nutrition-care' },
    { id: 'history', name: 'History', href: '/dashboard#history' },
    { id: 'profile', name: 'Family Profile', href: '/profile' },
  ];

  return [{ id: 'dashboard', name: 'Overview', href: '/dashboard' }];
}

export function canAccessPath(role: UserRole | null | undefined, path: string): { allowed: boolean; reason?: string } {
  const cleanPath = path.split('#')[0].split('?')[0];
  const publicPath = cleanPath === '/' || cleanPath === '/signin' || cleanPath === '/dashboard';
  if (role != null && !isUserRole(role)) {
    return { allowed: false, reason: 'This session has an unknown role. Start a new demo session.' };
  }
  if (!role || role === 'User') {
    return publicPath
      ? { allowed: true }
      : { allowed: false, reason: 'Public access is limited to aggregate pages.' };
  }
  if (role === 'Parent/Family') {
    if (cleanPath === '/' || cleanPath === '/signin' || cleanPath === '/dashboard' || cleanPath === '/family' || cleanPath === '/profile') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'This route is restricted to authorized field staff. Family members can view their linked child in the Family Portal.',
    };
  }
  if (cleanPath === '/' || cleanPath === '/signin' || cleanPath === '/dashboard') return { allowed: true };
  if (cleanPath.startsWith('/profile')) {
    return role === 'AWW' || role === 'LS' || role === 'CDPO' || role === 'DPO' || role === 'System Administrator' || role === 'Rule Administrator' || role === 'Parent/Family'
      ? { allowed: true }
      : { allowed: false, reason: 'Profile access is limited to authenticated staff roles.' };
  }
  if (cleanPath.startsWith('/beneficiaries/register')) {
    return role === 'AWW'
      ? { allowed: true }
      : { allowed: false, reason: 'Registration is limited to AWWs within their assigned centre.' };
  }
  if (cleanPath.startsWith('/centres')) {
    if (role === 'CDPO' || role === 'LS' || role === 'DPO' || role === 'System Administrator') return { allowed: true };
    return { allowed: false, reason: 'Centre-level overview is restricted to supervisory and administrative roles.' };
  }
  if (cleanPath.startsWith('/beneficiaries')) {
    if (role === 'AWW' || role === 'LS' || role === 'CDPO') return { allowed: true };
    return { allowed: false, reason: 'Beneficiary-level detail is not enabled for this role by default.' };
  }
  if (cleanPath.startsWith('/measurements')) {
    return role === 'AWW' || role === 'LS' || role === 'CDPO'
      ? { allowed: true }
      : { allowed: false, reason: 'Measurement workflows are limited to operational staff roles.' };
  }
  if (cleanPath.startsWith('/queue')) {
    return role === 'AWW' || role === 'LS' || role === 'CDPO'
      ? { allowed: true }
      : { allowed: false, reason: 'Case-level work queues are not enabled for this role.' };
  }
  if (cleanPath.startsWith('/referrals')) {
    return role === 'AWW' || role === 'LS' || role === 'CDPO'
      ? { allowed: true }
      : { allowed: false, reason: 'Referral detail is not enabled for this role.' };
  }
  if (cleanPath.startsWith('/reports')) {
    return role === 'LS' || role === 'CDPO' || role === 'DPO' || role === 'System Administrator' || role === 'Rule Administrator'
      ? { allowed: true }
      : { allowed: false, reason: 'Reports are not enabled for this role.' };
  }
  if (cleanPath.startsWith('/rules')) {
    return role === 'LS' || role === 'CDPO' || role === 'Rule Administrator' || role === 'System Administrator'
      ? { allowed: true }
      : { allowed: false, reason: 'Rule settings and system parameters are not enabled for this role.' };
  }
  return { allowed: false, reason: 'This route is not assigned to your role.' };
}

export type PermissionAction =
  | 'record_measurement' | 're_measure' | 'acknowledge_case' | 'assign_owner' | 'escalate'
  | 'edit_rules' | 'draft_rule_change' | 'submit_rule_change' | 'approve_rule_change'
  | 'create_referral' | 'log_follow_up' | 'resolve_referral' | 'export_audit'
  | 'manage_users' | 'manage_org_assignments' | 'view_beneficiary_detail';

export function canPerformAction(role: UserRole | null | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  switch (action) {
    case 'record_measurement': return role === 'AWW' || role === 'LS';
    case 're_measure': return role === 'LS';
    case 'acknowledge_case': return role === 'AWW' || role === 'LS';
    case 'assign_owner': return role === 'LS' || role === 'CDPO';
    case 'escalate': return role === 'LS';
    case 'create_referral': return role === 'AWW' || role === 'LS' || role === 'CDPO';
    case 'log_follow_up': return role === 'AWW' || role === 'LS' || role === 'CDPO';
    case 'resolve_referral': return role === 'LS' || role === 'CDPO';
    case 'export_audit': return role === 'LS' || role === 'CDPO';
    case 'draft_rule_change':
    case 'submit_rule_change': return role === 'Rule Administrator';
    case 'manage_users':
    case 'manage_org_assignments': return role === 'System Administrator';
    case 'edit_rules':
    case 'approve_rule_change':
    case 'view_beneficiary_detail': return false;
    default: return false;
  }
}

export function canRenderVerificationAction(role: UserRole | null | undefined): boolean {
  return canPerformAction(role, 're_measure');
}
