/**
 * Poshan Action Layer — Role-Based Access Control & ICDS Hierarchy Scoping
 *
 * Enforces role permissions across navigation, route guards, button states, and store queries.
 * Roles:
 * - AWW: Anganwadi Worker (Centre scope, e.g. AWC-702)
 * - LS: Lady Supervisor (Sector scope, e.g. Sector-4)
 * - CDPO: Child Development Project Officer (Project/Block scope, e.g. Project-Central)
 * - DPO: District Programme Officer (District scope, e.g. Varanasi District)
 *
 * Access rule assumptions are flagged: "to confirm with supervisor".
 */

export type UserRole = 'AWW' | 'LS' | 'CDPO' | 'DPO';

export interface RoleConfig {
  role: UserRole;
  label: string;
  fullTitle: string;
  scopeLevel: 'Centre' | 'Sector' | 'Project' | 'District';
  defaultId: string;
  defaultScope: string;
  description: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  AWW: {
    role: 'AWW',
    label: 'Anganwadi Worker',
    fullTitle: 'Anganwadi Worker (Frontline)',
    scopeLevel: 'Centre',
    defaultId: 'AWW-409',
    defaultScope: 'AWC-702',
    description: 'Frontline child growth intake, physical re-weighing, and own-centre casework.',
  },
  LS: {
    role: 'LS',
    label: 'Supervisor',
    fullTitle: 'Lady Supervisor (Sector)',
    scopeLevel: 'Sector',
    defaultId: 'LS-01',
    defaultScope: 'Sector-4',
    description: 'Supervisory spot-checks, case re-measurement, triage assignment, and sector audits.',
  },
  CDPO: {
    role: 'CDPO',
    label: 'CDPO',
    fullTitle: 'Child Development Project Officer (Block)',
    scopeLevel: 'Project',
    defaultId: 'CDPO-01',
    defaultScope: 'Project-Central',
    description: 'Project oversight, case assignments, audit inspection, and demo rule configuration.',
  },
  DPO: {
    role: 'DPO',
    label: 'District Programme Officer',
    fullTitle: 'District Programme Officer (District)',
    scopeLevel: 'District',
    defaultId: 'DPO-01',
    defaultScope: 'Varanasi District',
    description: 'District-wide executive monitoring, read-only audit inspection, and policy evaluation.',
  },
};

export interface PermissionMatrixItem {
  id: string;
  label: string;
  category: 'screen' | 'action';
  description: string;
  aww: string;
  ls: string;
  cdpo: string;
  dpo: string;
  supervisorNote: string; // "to confirm with supervisor"
}

/**
 * Access control matrix per project guidelines.
 * All entries flagged "to confirm with supervisor" in code comments as requested.
 */
export const PERMISSION_MATRIX: PermissionMatrixItem[] = [
  {
    id: 'briefing',
    label: 'Today and briefing',
    category: 'screen',
    description: 'Daily triage briefing and prioritized case queue overview',
    aww: 'yes',
    ls: 'yes',
    cdpo: 'yes',
    dpo: 'yes',
    supervisorNote: 'to confirm with supervisor',
  },
  {
    id: 'beneficiaries',
    label: 'Beneficiaries',
    category: 'screen',
    description: 'Beneficiary register and longitudinal growth curves',
    aww: 'own centre',
    ls: 'sector',
    cdpo: 'project',
    dpo: 'view',
    supervisorNote: 'to confirm with supervisor',
  },
  {
    id: 'queue',
    label: 'Case queue',
    category: 'screen',
    description: 'Anthropometric plausibility alerts & verification workflows',
    aww: 'own',
    ls: 'all',
    cdpo: 'all',
    dpo: 'view',
    supervisorNote: 'to confirm with supervisor',
  },
  {
    id: 'record_measurement',
    label: 'Record measurement / re-measure',
    category: 'action',
    description: 'Screening entry, Salter scale physical re-weigh verification',
    aww: 'yes',
    ls: 'yes',
    cdpo: 'no',
    dpo: 'no',
    supervisorNote: 'to confirm with supervisor',
  },
  {
    id: 'assign_owner',
    label: 'Assign owner, due date',
    category: 'action',
    description: 'Reallocate case responsibility and modify SLA target dates',
    aww: 'no',
    ls: 'yes',
    cdpo: 'yes',
    dpo: 'no',
    supervisorNote: 'to confirm with supervisor',
  },
  {
    id: 'referrals',
    label: 'Referrals',
    category: 'screen',
    description: 'NRC/PHC clinical escalations and caregiver follow-up log',
    aww: 'create, update own',
    ls: 'all',
    cdpo: 'all',
    dpo: 'view',
    supervisorNote: 'to confirm with supervisor',
  },
  {
    id: 'reports',
    label: 'Audit trail / reports',
    category: 'screen',
    description: 'Immutable casework ledger, triage turnaround, and sector metrics',
    aww: 'no',
    ls: 'yes',
    cdpo: 'yes',
    dpo: 'view',
    supervisorNote: 'to confirm with supervisor',
  },
  {
    id: 'rules',
    label: 'Rule settings',
    category: 'screen',
    description: 'Growth velocity thresholds, digit clumping, and clinical parameters',
    aww: 'no',
    ls: 'view',
    cdpo: 'edit (demo rules)',
    dpo: 'view',
    supervisorNote: 'to confirm with supervisor',
  },
  {
    id: 'evaluation',
    label: 'Evaluation',
    category: 'screen',
    description: 'Synthetic algorithm recall, precision, and planted error detection',
    aww: 'no',
    ls: 'view',
    cdpo: 'view',
    dpo: 'view',
    supervisorNote: 'to confirm with supervisor',
  },
];

export interface PortalNavItem {
  id: string;
  name: string;
  href: string;
  scopeBadge?: string;
}

/**
 * Generates navigation tabs driven by role permissions.
 * Replaces hardcoded pills with role-authorized screens.
 */
export function getNavItemsForRole(role: UserRole | null | undefined): PortalNavItem[] {
  if (!role) {
    // Public demo visitor: aggregate-only dashboard
    return [
      { id: 'dashboard', name: 'Overview', href: '/dashboard' },
    ];
  }

  const items: PortalNavItem[] = [
    { id: 'dashboard', name: 'Briefing', href: '/dashboard' },
    {
      id: 'beneficiaries',
      name: 'Beneficiaries',
      href: '/beneficiaries',
      scopeBadge: role === 'AWW' ? 'Own Centre' : role === 'LS' ? 'Sector' : role === 'CDPO' ? 'Project' : 'District View',
    },
    {
      id: 'queue',
      name: 'Case Queue',
      href: '/queue',
      scopeBadge: role === 'AWW' ? 'Own Centre' : role === 'DPO' ? 'View Only' : 'All Cases',
    },
  ];

  // Measurement intake & spot check: AWW and LS only
  if (role === 'AWW' || role === 'LS') {
    items.push({
      id: 'measurements',
      name: 'Screening Intake',
      href: '/measurements',
    });
  }

  // Clinical Referrals: All staff roles have access
  items.push({
    id: 'referrals',
    name: 'Referrals',
    href: '/referrals',
    scopeBadge: role === 'AWW' ? 'Own Cases' : role === 'DPO' ? 'View Only' : 'All',
  });

  // Audit trail / Reports: LS, CDPO, DPO only (AWW forbidden to protect audit ledger)
  if (role === 'LS' || role === 'CDPO' || role === 'DPO') {
    items.push({
      id: 'reports',
      name: 'Audit Reports',
      href: '/reports',
      scopeBadge: role === 'DPO' ? 'View Only' : undefined,
    });
  }

  // Rule settings: LS (view), CDPO (edit demo), DPO (view). Forbidden for AWW.
  if (role === 'LS' || role === 'CDPO' || role === 'DPO') {
    items.push({
      id: 'rules',
      name: 'Rule Settings',
      href: '/rules',
      scopeBadge: role === 'CDPO' ? 'Edit Rules' : 'View Only',
    });
  }

  return items;
}

/**
 * Route authorization checker
 */
export function canAccessPath(
  role: UserRole | null | undefined,
  path: string
): { allowed: boolean; reason?: string } {
  // Public visitors: only / and /signin and /dashboard are allowed
  if (!role) {
    if (path === '/' || path === '/signin' || path === '/dashboard') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Sign-in required. Public visitors have aggregate-only demo access.',
    };
  }

  // Beneficiary registration: AWW and LS
  if (path.startsWith('/beneficiaries/register')) {
    if (role === 'AWW' || role === 'LS') return { allowed: true };
    return {
      allowed: false,
      reason: 'Only frontline Anganwadi Workers and Supervisors can register beneficiaries.',
    };
  }

  // Beneficiaries list and child profiles: all staff roles allowed
  if (path.startsWith('/beneficiaries')) {
    return { allowed: true };
  }

  // Measurements / re-measure screen: AWW and LS only
  if (path.startsWith('/measurements')) {
    if (role === 'AWW' || role === 'LS') return { allowed: true };
    return {
      allowed: false,
      reason: 'Measurement intake and physical re-weighing are restricted to AWW and Lady Supervisor roles.',
    };
  }

  // Action Queue: all staff roles
  if (path.startsWith('/queue')) {
    return { allowed: true };
  }

  // Referrals: all staff roles
  if (path.startsWith('/referrals')) {
    return { allowed: true };
  }

  // Audit trail / Reports: LS, CDPO, DPO only. AWW forbidden.
  if (path.startsWith('/reports')) {
    if (role === 'LS' || role === 'CDPO' || role === 'DPO') return { allowed: true };
    return {
      allowed: false,
      reason: 'Audit ledger and supervisory reports require Lady Supervisor, CDPO, or DPO access.',
    };
  }

  // Rule settings: LS, CDPO, DPO only. AWW forbidden.
  if (path.startsWith('/rules')) {
    if (role === 'LS' || role === 'CDPO' || role === 'DPO') return { allowed: true };
    return {
      allowed: false,
      reason: 'Heuristic plausibility rule settings require Lady Supervisor, CDPO, or DPO access.',
    };
  }

  // Profile: allowed for any staff
  if (path.startsWith('/profile')) {
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Action permission checker
 */
export function canPerformAction(
  role: UserRole | null | undefined,
  action:
    | 'record_measurement'
    | 're_measure'
    | 'acknowledge_case'
    | 'assign_owner'
    | 'escalate'
    | 'edit_rules'
    | 'create_referral'
    | 'log_follow_up'
    | 'resolve_referral'
    | 'export_audit'
): boolean {
  if (!role) return false;

  switch (action) {
    case 'record_measurement':
    case 're_measure':
      return role === 'AWW' || role === 'LS';
    case 'acknowledge_case':
      return role === 'AWW' || role === 'LS' || role === 'CDPO';
    case 'assign_owner':
      return role === 'LS' || role === 'CDPO';
    case 'escalate':
      return role === 'AWW' || role === 'LS' || role === 'CDPO';
    case 'edit_rules':
      return role === 'CDPO';
    case 'create_referral':
      return role === 'AWW' || role === 'LS' || role === 'CDPO';
    case 'log_follow_up':
      return role === 'AWW' || role === 'LS' || role === 'CDPO';
    case 'resolve_referral':
      return role === 'LS' || role === 'CDPO';
    case 'export_audit':
      return role === 'LS' || role === 'CDPO' || role === 'DPO';
    default:
      return false;
  }
}

/** Whether the Action Queue may render its physical verification submit action. */
export function canRenderVerificationAction(role: UserRole | null | undefined): boolean {
  return canPerformAction(role, 're_measure');
}
