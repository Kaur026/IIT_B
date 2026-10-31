/**
 * Single Master Reactive Mock Store for Poshan Action Layer
 * 100% synthetic data consistency across all portal screens and routes.
 * Persists demo state in localStorage with confirmed reset capability.
 * Storage Key: poshan_action_layer_store_v4 (bumped for the six-cohort synthetic seed)
 */

import {
  calculateAge,
  evaluateMeasurementEntry,
  validateMeasurementInput,
  DEMO_CURRENT_DATE,
  ESCALATION_TIERS,
  getDaysBetween,
  getDaysUntilDate,
  getTodayISODate,
} from '../utils/casework.ts';
import { type UserRole, canPerformAction } from '../utils/permissions.ts';

export type DemoScope = {
  role?: UserRole | null;
  centreCode?: string;
  sectorCode?: string;
  projectCode?: string;
  actorId?: string;
  linkedBeneficiaryIds?: string[];
  familyId?: string;
};

export const DEMO_SECTOR_CENTRES: Record<string, string[]> = {
  'Sector-4': ['AWC-702', 'AWC-703', 'AWC-704'],
  'Sector-5': ['AWC-705', 'AWC-706'],
};
export const DEMO_PROJECT_CENTRES: Record<string, string[]> = {
  'Project-Central': ['AWC-702', 'AWC-703', 'AWC-704', 'AWC-705', 'AWC-706'],
};

export const DEMO_AWW_CENTRES: Record<string, string> = {
  'AWW-409': 'AWC-702', 'AWW-412': 'AWC-702', 'AWW-405': 'AWC-703',
  'AWW-410': 'AWC-704', 'AWW-417': 'AWC-705', 'AWW-421': 'AWC-706',
};

function centresForDemoScope(scope?: DemoScope): string[] | null {
  if (!scope) return null;
  if (!scope.role) return [];
  switch (scope.role) {
    case 'Parent/Family':
      return [];
    case 'AWW': {
      const assignedCentre = scope.actorId ? DEMO_AWW_CENTRES[scope.actorId] : undefined;
      if (scope.actorId && !assignedCentre) return [];
      const centre = assignedCentre || scope.centreCode || 'AWC-702';
      if (assignedCentre && scope.centreCode && scope.centreCode !== assignedCentre) return [];
      return Object.values(DEMO_AWW_CENTRES).includes(centre) ? [centre] : [];
    }
    case 'LS': {
      const sector = scope.sectorCode || 'Sector-4';
      return DEMO_SECTOR_CENTRES[sector] || [];
    }
    case 'CDPO': {
      const project = scope.projectCode || 'Project-Central';
      return DEMO_PROJECT_CENTRES[project] || [];
    }
    default:
      return [];
  }
}

function scopeAllowsCentre(scope: DemoScope | null | undefined, centreCode?: string): boolean {
  if (!scope?.role || !centreCode) return false;
  return centresForDemoScope(scope)?.includes(centreCode) === true;
}

function recordCentre(store: MockStore, beneficiaryId: string, explicitCentre?: string): string | undefined {
  return explicitCentre || store.getBeneficiaryById(beneficiaryId)?.centreCode;
}

export const DEMO_TODAY = DEMO_CURRENT_DATE; // '2026-10-24'

export interface BeneficiaryRecord {
  id: string; // BEN-xxxx
  name: string;
  dob: string; // YYYY-MM-DD
  gender: 'Male' | 'Female' | 'Other';
  category: 'child_under_6' | 'pregnant' | 'lactating' | 'adolescent';
  caregiverKinship: string; // e.g. 'Mother', 'Father', 'Grandmother'
  centreCode: string; // e.g. 'AWC-702'
  assignedAww: string; // e.g. 'AWW-409'
  birthWeight?: number;
  status: 'Active' | 'Under Monitoring' | 'Referred' | 'Discharged';
  registrationDate: string;
  lastMeasurementDate?: string;
  lastWeight?: number;
  lastHeight?: number;
  hasActiveFlag?: boolean;
}

export interface MeasurementRecord {
  id: string; // MEA-xxxx
  beneficiaryId: string;
  date: string;
  ageMonths: number;
  weightKg: number;
  heightCm: number;
  muacCm?: number;
  hasEdema: boolean;
  posture: 'recumbent' | 'standing';
  recordedBy: string; // e.g. 'AWW-409'
  qualityFlags: string[];
  clinicalFlags: string[];
  isVerified: boolean;
  notes?: string;
}

export interface ReferralFollowUp {
  id: string;
  date: string;
  actor: string; // e.g. 'AWW-409' or 'Sector Supervisor (LS-01)'
  method: 'Home Visit' | 'Phone Call' | 'AWC Consultation';
  findings: string;
  outcomeNote?: string;
}

export interface ReferralRecord {
  id: string; // REF-xxxx
  beneficiaryId: string;
  ageDisplay: string;
  reason: string;
  destination:
    | 'Primary Health Centre (PHC)'
    | 'Nutrition Rehabilitation Centre (NRC)'
    | 'Community Health Centre (CHC)'
    | 'District Hospital';
  referralDate: string;
  owner: string; // e.g. 'AWW-409'
  dueDate: string;
  status: 'Pending' | 'Follow-up In Progress' | 'Completed' | 'Escalated';
  priority: 'Urgent' | 'High' | 'Routine';
  followUpAttempts: ReferralFollowUp[];
  finalOutcome?: string;
  outcomeConfirmed?: boolean;
  outcomeDate?: string;
  nextSteps?: string;
  lifecycleStatus?: ReferralLifecycleStatus;
}

export type ReferralLifecycleStatus = 'sent' | 'acknowledged' | 'attended' | 'outcome_recorded';

export type TaskLifecycleStatus = 'assigned' | 'acknowledged' | 'in_progress' | 'closed';

export interface DemoTaskRecord {
  id: string;
  beneficiaryId: string;
  centreCode: string;
  ownerId: string;
  status: TaskLifecycleStatus;
  dueDate: string;
  caseStatus: BeneficiaryCase['status'];
}

export interface DemoCentreRecord {
  id: string;
  name: string;
  sectorCode: string;
  projectCode: string;
  districtCode: string;
}

export interface DemoWorkerRecord {
  id: string;
  role: UserRole;
  centreCode?: string;
  sectorCode?: string;
  projectCode?: string;
  districtCode?: string;
}

export interface DemoHomeVisitRecord {
  id: string;
  beneficiaryId: string;
  centreCode: string;
  workerId: string;
  visitDate: string;
  status: 'scheduled' | 'completed';
  note: string;
}

export interface DemoMaternalProfileRecord {
  id: string;
  beneficiaryId: string;
  centreCode: string;
  stage: 'pregnant' | 'lactating';
  registeredOn: string;
}

export interface DemoServiceRecord {
  id: string;
  beneficiaryId: string;
  centreCode: string;
  workerId: string;
  serviceType: 'growth_monitoring' | 'nutrition_counselling' | 'supplementary_nutrition' | 'home_visit';
  serviceDate: string;
  status: 'recorded' | 'scheduled';
}

export interface DemoReviewHistoryRecord {
  id: string;
  actionId: string;
  beneficiaryId: string;
  centreCode: string;
  reviewerId: string;
  status: 'pending' | 'reviewed';
  reviewedOn?: string;
}

export interface DemoVerificationRecord {
  id: string;
  actionId: string;
  beneficiaryId: string;
  centreCode: string;
  status: 'open' | 'resolved';
  openedOn: string;
  resolvedOn?: string;
}

export interface EscalationStep {
  timestamp: string;
  fromTier: number;
  toTier: number;
  fromActor: string;
  toActor: string;
  reason: string;
}

export interface BeneficiaryCase {
  id: string; // BEN-xxxx
  actionId: string; // ACT-xxxx
  ageMonths: number;
  gender: 'Male' | 'Female' | 'Other';
  caregiverKinship: string;
  centreCode: string; // 'AWC-702'
  assignedAww: string; // 'AWW-409'
  category: 'urgent' | 'drift' | 'sam' | 'visit';
  categoryLabel: string;
  concernSummary: string;
  ruleCode: string;
  ruleName: string;
  triggerDetail: string;
  prevWeight: number;
  prevHeight: number;
  prevDate: string;
  flaggedWeight: number;
  flaggedHeight: number;
  flaggedDate: string;
  weightDelta: string;
  priority: 'Urgent' | 'Needs Attention' | 'Referral Pending' | 'Resolved';
  priorityColor: string;
  dueDate: string;
  status: 'Pending Verification' | 'Under Review' | 'Resolved' | 'Follow-up Assigned';
  isVerified: boolean;
  verifiedWeight?: number;
  verifiedHeight?: number;
  verifiedNotes?: string;
  verificationHash?: string;
  tierLevel: 1 | 2 | 3 | 4;
  assignedRole: string;
  assignedActor: string;
  escalationHistory: EscalationStep[];
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface RuleDefinition {
  id: string; // RUL-01
  name: string;
  category: 'velocity' | 'negative' | 'stagnation' | 'clumping';
  targetGroup: string;
  condition: string;
  actionGenerated: string;
  severity: 'Urgent' | 'Needs Attention' | 'Warning';
  thresholdValue: number;
  isActive: boolean;
  triggers30d: number;
  isIllustrative: boolean;
}

export interface AuditLedgerEntry {
  id: string;
  timestamp: string;
  actionId: string;
  palId: string; // BEN-xxxx
  actor: string; // Synthetic ID e.g. 'AWW-409', 'LS-01', 'CDPO-01'
  actionType: string;
  deltaSummary: string;
  proofHash: string;
  status: 'Verified' | 'Escalated' | 'Logged';
}

export interface AIDecisionRecord {
  id: string; // DEC-xxxx
  beneficiaryId: string;
  caseActionId: string;
  suggestionId: string;
  decision: 'accept' | 'reject' | 'modify';
  actionCode: string;
  actionNotes?: string;
  rejectionReason?: string;
  actorId: string;
  actorRole: UserRole;
  centreCode: string;
  timestamp: string;
}

export const STORAGE_KEY = 'poshan_action_layer_store_v4';

export const DEMO_BENEFICIARY_COUNTS = {
  child_under_6: 322,
  adolescent: 50,
  pregnant: 137,
  lactating: 91,
} as const;

const CANONICAL_CENTRES: DemoCentreRecord[] = [
  { id: 'AWC-702', name: 'Anganwadi Centre 702', sectorCode: 'Sector-4', projectCode: 'Project-Central', districtCode: 'District-1' },
  { id: 'AWC-703', name: 'Anganwadi Centre 703', sectorCode: 'Sector-4', projectCode: 'Project-Central', districtCode: 'District-1' },
  { id: 'AWC-704', name: 'Anganwadi Centre 704', sectorCode: 'Sector-4', projectCode: 'Project-Central', districtCode: 'District-1' },
  { id: 'AWC-705', name: 'Anganwadi Centre 705', sectorCode: 'Sector-5', projectCode: 'Project-Central', districtCode: 'District-1' },
  { id: 'AWC-706', name: 'Anganwadi Centre 706', sectorCode: 'Sector-5', projectCode: 'Project-Central', districtCode: 'District-1' },
];

const CANONICAL_WORKERS: DemoWorkerRecord[] = [
  ...Object.entries(DEMO_AWW_CENTRES).map(([id, centreCode]) => ({ id, role: 'AWW' as const, centreCode })),
  { id: 'LS-01', role: 'LS', sectorCode: 'Sector-4' },
  { id: 'CDPO-01', role: 'CDPO', projectCode: 'Project-Central' },
  { id: 'DPO-01', role: 'DPO', districtCode: 'District-1' },
];

const FICTIONAL_GIVEN_NAMES: Record<'Male' | 'Female' | 'Other', string[]> = {
  Male: ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Ishaan', 'Kabir', 'Advait', 'Krish', 'Rohan', 'Anay', 'Dev', 'Nikhil', 'Kunal', 'Samar', 'Ayaan', 'Dhruv', 'Manav', 'Yash', 'Aman', 'Neel', 'Arnav', 'Shaurya', 'Mihir', 'Ritvik', 'Siddharth', 'Parth', 'Om', 'Harsh'],
  Female: ['Aadhya', 'Ananya', 'Diya', 'Ira', 'Kavya', 'Meera', 'Saanvi', 'Aarohi', 'Anika', 'Ishita', 'Myra', 'Nisha', 'Riya', 'Tara', 'Veda', 'Zoya', 'Aditi', 'Avni', 'Charvi', 'Ishani', 'Kiara', 'Mahi', 'Navya', 'Pihu', 'Radhika', 'Saira', 'Tanvi', 'Uma', 'Vaishnavi', 'Yamini'],
  Other: ['Aadi', 'Amar', 'Baani', 'Chaitanya', 'Devi', 'Geet', 'Harini', 'Jai', 'Kiran', 'Milan', 'Noor', 'Ravi', 'Sahil', 'Samar', 'Tej', 'Aman', 'Anmol', 'Darshan', 'Indu', 'Jeevan', 'Kavi', 'Madhav', 'Nirav', 'Rohan', 'Shanti', 'Tarun', 'Uday', 'Vijay', 'Yuvan', 'Zain'],
};

const FICTIONAL_SURNAMES = [
  'Bansal', 'Chauhan', 'Desai', 'Dwivedi', 'Ghosh', 'Gupta', 'Jaiswal', 'Joshi',
  'Khan', 'Kulkarni', 'Malik', 'Mehta', 'Mishra', 'Nair', 'Pandey', 'Patel',
  'Pillai', 'Rao', 'Saxena', 'Shah', 'Sharma', 'Singh', 'Tiwari', 'Verma', 'Yadav',
];

function fictionalBeneficiaryName(index: number, gender: BeneficiaryRecord['gender']): string {
  const firstNames = FICTIONAL_GIVEN_NAMES[gender];
  return `${firstNames[index % firstNames.length]} ${FICTIONAL_SURNAMES[Math.floor(index / firstNames.length) % FICTIONAL_SURNAMES.length]}`;
}

function dateDaysBeforeDemo(days: number): string {
  const date = new Date(`${DEMO_CURRENT_DATE}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function childDatesForDemo(ageMonths: number, registrationOffset: number): { dob: string; registrationDate: string } {
  const dob = new Date(`${DEMO_CURRENT_DATE}T00:00:00Z`);
  dob.setUTCMonth(dob.getUTCMonth() - ageMonths);
  const registration = new Date(dob);
  registration.setUTCDate(registration.getUTCDate() + registrationOffset);
  return {
    dob: dob.toISOString().slice(0, 10),
    registrationDate: registration.toISOString().slice(0, 10),
  };
}

function adolescentDateOfBirthForDemo(ageYears: number, index: number): string {
  const [referenceYear, referenceMonth, referenceDay] = DEMO_CURRENT_DATE.split('-').map(Number);
  const birthMonth = (index * 5) % 12;
  const birthDay = 1 + ((index * 11) % 28);
  const birthdayHasPassed = birthMonth < referenceMonth - 1
    || (birthMonth === referenceMonth - 1 && birthDay <= referenceDay);
  const birthYear = referenceYear - ageYears - (birthdayHasPassed ? 0 : 1);
  return `${birthYear}-${String(birthMonth + 1).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
}

function placementForIndex(index: number): { centreCode: string; assignedAww: string } {
  const bucket = (index * 37 + Math.floor(index / 5) * 11) % 100;
  const centreCode = bucket < 30 ? 'AWC-702'
    : bucket < 54 ? 'AWC-703'
      : bucket < 74 ? 'AWC-704'
        : bucket < 90 ? 'AWC-705' : 'AWC-706';
  const centreWorkers = Object.entries(DEMO_AWW_CENTRES)
    .filter(([, workerCentre]) => workerCentre === centreCode)
    .map(([workerId]) => workerId);
  return {
    centreCode,
    assignedAww: centreWorkers[index % centreWorkers.length],
  };
}

// Canonical Baseline Seed Data
function generateCanonicalSeed() {
  const beneficiaries: BeneficiaryRecord[] = [
    {
      id: 'BEN-0142',
      name: 'Aarav Sharma',
      dob: '2025-08-10', // ~14 months on 2026-10-24
      gender: 'Male',
      category: 'child_under_6',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-409',
      birthWeight: 2.85,
      status: 'Under Monitoring',
      registrationDate: '2025-08-15',
      lastMeasurementDate: '2026-10-24',
      lastWeight: 12.3,
      lastHeight: 77.5,
      hasActiveFlag: true,
    },
    {
      id: 'BEN-0891',
      name: 'Ananya Verma',
      dob: '2024-12-04', // ~22 months on 2026-10-24
      gender: 'Female',
      category: 'child_under_6',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-412',
      birthWeight: 2.9,
      status: 'Under Monitoring',
      registrationDate: '2024-12-10',
      lastMeasurementDate: '2026-10-10',
      lastWeight: 10.9,
      lastHeight: 82.5,
      hasActiveFlag: true,
    },
    {
      id: 'BEN-0334',
      name: 'Vivaan Singh',
      dob: '2026-01-14', // ~9 months on 2026-10-24
      gender: 'Male',
      category: 'child_under_6',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-409',
      birthWeight: 2.7,
      status: 'Referred',
      registrationDate: '2026-01-20',
      lastMeasurementDate: '2026-10-14',
      lastWeight: 6.85,
      lastHeight: 67.0,
      hasActiveFlag: true,
    },
    {
      id: 'BEN-0512',
      name: 'Kavya Mishra',
      dob: '2024-02-18', // ~32 months
      gender: 'Male',
      category: 'child_under_6',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-409',
      birthWeight: 3.1,
      status: 'Under Monitoring',
      registrationDate: '2024-02-22',
      lastMeasurementDate: '2026-10-09',
      lastWeight: 12.3,
      lastHeight: 95.4,
      hasActiveFlag: true,
    },
    {
      id: 'BEN-0773',
      name: 'Ishaan Yadav',
      dob: '2025-11-05', // ~11 months
      gender: 'Female',
      category: 'child_under_6',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-412',
      birthWeight: 2.65,
      status: 'Under Monitoring',
      registrationDate: '2025-11-10',
      lastMeasurementDate: '2026-10-09',
      lastWeight: 6.8,
      lastHeight: 71.8,
      hasActiveFlag: true,
    },
    {
      id: 'BEN-0922',
      name: 'Meera Gupta',
      dob: '2025-07-20', // ~15 months
      gender: 'Male',
      category: 'child_under_6',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-412',
      birthWeight: 3.0,
      status: 'Under Monitoring',
      registrationDate: '2025-07-25',
      lastMeasurementDate: '2026-10-11',
      lastWeight: 10.0,
      lastHeight: 76.2,
      hasActiveFlag: true,
    },
  ];

  // Keep the original synthetic child records stable and add enough records to
  // reach the configured child cohort size.
  for (let i = 0; i < 127; i++) {
    const idNum = 1000 + i * 19;
    const isGirl = i % 2 === 0;
    const gender = isGirl ? 'Female' : 'Male';
    const ageMonths = 1 + ((i * 3) % 68);

    const { dob: dobStr, registrationDate } = childDatesForDemo(ageMonths, 2 + (i % 13));

    const isStale = i % 7 === 0;
    const lastDate = dateDaysBeforeDemo(isStale ? 42 + (i % 12) : 1 + (i % 22));
    const weight = Number((4.5 + ageMonths * 0.28 + (i % 3) * 0.2).toFixed(1));
    const height = Number((55.0 + ageMonths * 0.8 + (i % 4) * 0.5).toFixed(1));

    const centreCode = i % 17 === 0 ? 'AWC-705' : i % 19 === 0 ? 'AWC-706' : i % 5 === 0 ? 'AWC-703' : i % 8 === 0 ? 'AWC-704' : 'AWC-702';
    const assignedAww = centreCode === 'AWC-702' ? (i % 2 === 0 ? 'AWW-409' : 'AWW-412')
      : centreCode === 'AWC-703' ? 'AWW-405'
        : centreCode === 'AWC-704' ? 'AWW-410'
          : centreCode === 'AWC-705' ? 'AWW-417' : 'AWW-421';

    beneficiaries.push({
      id: `BEN-${idNum}`,
      name: fictionalBeneficiaryName(i + 6, gender),
      dob: dobStr,
      gender,
      category: 'child_under_6',
      caregiverKinship: 'Mother',
      centreCode,
      assignedAww,
      birthWeight: Number((2.6 + (i % 5) * 0.15).toFixed(2)),
      status: isStale ? 'Under Monitoring' : 'Active',
      registrationDate,
      lastMeasurementDate: lastDate,
      lastWeight: weight,
      lastHeight: height,
      hasActiveFlag: isStale,
    });
  }

  const additionalChildren = DEMO_BENEFICIARY_COUNTS.child_under_6 - beneficiaries.length;
  for (let i = 0; i < additionalChildren; i++) {
    const index = beneficiaries.length;
    const ageMonths = 1 + ((i * 17) % 71);
    const gender = i % 2 === 0 ? 'Female' : 'Male';
    const { dob, registrationDate } = childDatesForDemo(ageMonths, 2 + (i % 13));
    const placement = placementForIndex(index);
    const isStale = i % 9 === 0;
    const lastMeasurementDate = dateDaysBeforeDemo(isStale ? 42 + (i % 12) : 1 + (i % 24));
    const weight = Number((3.2 + ageMonths * 0.19 + (i % 7) * 0.11).toFixed(1));
    const height = Number((49.5 + ageMonths * 0.72 + (i % 5) * 0.4).toFixed(1));
    beneficiaries.push({
      id: `BEN-${10000 + i}`,
      name: fictionalBeneficiaryName(index, gender),
      dob,
      gender,
      category: 'child_under_6',
      caregiverKinship: i % 19 === 0 ? 'Grandmother' : i % 13 === 0 ? 'Father' : 'Mother',
      ...placement,
      birthWeight: Number((2.5 + (i % 8) * 0.12).toFixed(2)),
      status: isStale ? 'Under Monitoring' : 'Active',
      registrationDate,
      lastMeasurementDate,
      lastWeight: weight,
      lastHeight: height,
      hasActiveFlag: isStale,
    });
  }

  for (let i = 0; i < DEMO_BENEFICIARY_COUNTS.adolescent; i++) {
    const index = beneficiaries.length;
    const placement = placementForIndex(index);
    const ageYears = 10 + ((i * 7) % 10);
    const isMonitored = i % 8 === 0;
    beneficiaries.push({
      id: `BEN-${12000 + i}`,
      name: fictionalBeneficiaryName(index, 'Female'),
      dob: adolescentDateOfBirthForDemo(ageYears, i),
      gender: 'Female',
      category: 'adolescent',
      caregiverKinship: i % 5 === 0 ? 'Grandmother' : 'Mother',
      ...placement,
      status: isMonitored ? 'Under Monitoring' : 'Active',
      registrationDate: dateDaysBeforeDemo(2 + (i % 180)),
      hasActiveFlag: isMonitored,
    });
  }

  let nameSequence = beneficiaries.length;
  const addMaternalBeneficiaries = (category: 'pregnant' | 'lactating', count: number, firstId: number, extraIdStart: number) => {
    for (let i = 0; i < count; i++) {
      const idNumber = i < 8 ? firstId + i : extraIdStart + i - 8;
      const placement = placementForIndex(nameSequence);
      const ageYears = category === 'pregnant' ? 20 + (i % 13) : 19 + (i % 15);
      const birthMonth = 1 + ((i * 7 + (category === 'lactating' ? 4 : 0)) % 12);
      const dob = new Date(Date.UTC(2026 - ageYears, birthMonth - 1, 15)).toISOString().slice(0, 10);
      const registrationDate = dateDaysBeforeDemo(2 + (i % 180));
      beneficiaries.push({
        id: `BEN-${idNumber}`,
        name: fictionalBeneficiaryName(nameSequence++, 'Female'),
        dob,
        gender: 'Female',
        category,
        caregiverKinship: 'Self',
        ...placement,
        status: i % 6 === 0 ? 'Under Monitoring' : 'Active',
        registrationDate,
        hasActiveFlag: false,
      });
    }
  };
  addMaternalBeneficiaries('pregnant', DEMO_BENEFICIARY_COUNTS.pregnant, 4001, 11000);
  addMaternalBeneficiaries('lactating', DEMO_BENEFICIARY_COUNTS.lactating, 4009, 11129);

  beneficiaries.forEach((beneficiary, index) => {
    if (DEMO_AWW_CENTRES[beneficiary.assignedAww] !== beneficiary.centreCode) {
      throw new Error(`Synthetic beneficiary ${beneficiary.id} has a worker from another centre.`);
    }
    if (!beneficiary.name) beneficiary.name = fictionalBeneficiaryName(index, beneficiary.gender);
  });

  if (
    beneficiaries.length !== Object.values(DEMO_BENEFICIARY_COUNTS).reduce((total, count) => total + count, 0)
    || beneficiaries.filter((beneficiary) => beneficiary.category === 'child_under_6').length !== DEMO_BENEFICIARY_COUNTS.child_under_6
    || beneficiaries.filter((beneficiary) => beneficiary.category === 'adolescent').length !== DEMO_BENEFICIARY_COUNTS.adolescent
    || beneficiaries.filter((beneficiary) => beneficiary.category === 'pregnant').length !== DEMO_BENEFICIARY_COUNTS.pregnant
    || beneficiaries.filter((beneficiary) => beneficiary.category === 'lactating').length !== DEMO_BENEFICIARY_COUNTS.lactating
    || new Set(beneficiaries.map((beneficiary) => beneficiary.id)).size !== beneficiaries.length
    || beneficiaries.some((beneficiary) => beneficiary.category === 'adolescent'
      && (beneficiary.gender !== 'Female'
        || calculateAge(beneficiary.dob, DEMO_CURRENT_DATE, beneficiary.category, beneficiary.gender).cohort !== 'adolescentGirls'))
  ) {
    throw new Error('Synthetic beneficiary seed does not match the configured cohort distribution.');
  }

  // 35 Action Cases
  const cases: BeneficiaryCase[] = [
    {
      id: 'BEN-0142',
      actionId: 'ACT-2041',
      ageMonths: 14,
      gender: 'Male',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-409',
      category: 'urgent',
      categoryLabel: 'Urgent Anomaly',
      concernSummary: 'Measurement needs verification • Abrupt +3.8 kg weight gain in 28 days',
      ruleCode: 'RUL-01',
      ruleName: 'Weight Velocity Outlier',
      triggerDetail: '+3.8 kg in 28 days (8.5 kg on 26 Sep -> 12.3 kg on 24 Oct) exceeds velocity threshold',
      prevWeight: 8.5,
      prevHeight: 77.2,
      prevDate: '26 Sep 2026',
      flaggedWeight: 12.3,
      flaggedHeight: 77.5,
      flaggedDate: '24 Oct 2026',
      weightDelta: '+3.8 kg in 28d',
      priority: 'Urgent',
      priorityColor: 'bg-rose-100 text-rose-800 border-rose-200',
      dueDate: 'Today, 2:00 PM',
      status: 'Pending Verification',
      isVerified: false,
      tierLevel: 1,
      assignedRole: 'Frontline AWW',
      assignedActor: 'AWW-409',
      escalationHistory: [
        {
          timestamp: '24 Oct 2026, 09:15 AM',
          fromTier: 1,
          toTier: 1,
          fromActor: 'System Engine',
          toActor: 'AWW-409',
          reason: 'Initial anthropometric velocity alert flagged upon field entry.',
        },
      ],
    },
    {
      id: 'BEN-0891',
      actionId: 'ACT-2038',
      ageMonths: 22,
      gender: 'Female',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-412',
      category: 'drift',
      categoryLabel: 'Measurement Drift',
      concernSummary: 'Physical shrinkage warning • Height dropped -2.0 cm compared to preceding month',
      ruleCode: 'RUL-02',
      ruleName: 'Negative Length / Height Step',
      triggerDetail: '-2.0 cm decrement from 84.5 cm to 82.5 cm over 30 days',
      prevWeight: 10.8,
      prevHeight: 84.5,
      prevDate: '10 Sep 2026',
      flaggedWeight: 10.9,
      flaggedHeight: 82.5,
      flaggedDate: '10 Oct 2026',
      weightDelta: '-2.0 cm (Height)',
      priority: 'Needs Attention',
      priorityColor: 'bg-amber-100 text-amber-800 border-amber-200',
      dueDate: 'Yesterday (Overdue)',
      status: 'Pending Verification',
      isVerified: false,
      tierLevel: 1,
      assignedRole: 'Frontline AWW',
      assignedActor: 'AWW-412',
      escalationHistory: [
        {
          timestamp: '10 Oct 2026, 11:30 AM',
          fromTier: 1,
          toTier: 1,
          fromActor: 'System Engine',
          toActor: 'AWW-412',
          reason: 'Negative length alert triggered.',
        },
      ],
    },
    {
      id: 'BEN-0334',
      actionId: 'ACT-2035',
      ageMonths: 9,
      gender: 'Male',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-405',
      category: 'sam',
      categoryLabel: 'SAM / MAM Flag',
      concernSummary: 'Severe Acute Malnutrition risk • Weight flatlined for 62 days + Red MUAC band (11.4 cm)',
      ruleCode: 'RUL-04',
      ruleName: 'Growth Stagnation & Red MUAC',
      triggerDetail: '+50g weight change across 62 days with MUAC 11.4 cm (< 11.5 cm WHO cut-off)',
      prevWeight: 6.8,
      prevHeight: 66.2,
      prevDate: '12 Aug 2026',
      flaggedWeight: 6.85,
      flaggedHeight: 67.0,
      flaggedDate: '14 Oct 2026',
      weightDelta: '+0.05 kg in 62d',
      priority: 'Urgent',
      priorityColor: 'bg-rose-100 text-rose-800 border-rose-200',
      dueDate: '22 Oct 2026',
      status: 'Under Review',
      isVerified: false,
      tierLevel: 2,
      assignedRole: 'Sector Supervisor',
      assignedActor: 'Sector Supervisor (LS-01)',
      escalationHistory: [
        {
          timestamp: '14 Oct 2026, 02:00 PM',
          fromTier: 1,
          toTier: 1,
          fromActor: 'System Engine',
          toActor: 'AWW-405',
          reason: 'Severe growth stagnation detected.',
        },
        {
          timestamp: '15 Oct 2026, 10:15 AM',
          fromTier: 1,
          toTier: 2,
          fromActor: 'AWW-405',
          toActor: 'Sector Supervisor (LS-01)',
          reason: 'Escalated to Lady Supervisor for Nutrition Rehabilitation Centre referral slip.',
        },
      ],
    },
    {
      id: 'BEN-0512',
      actionId: 'ACT-1994',
      ageMonths: 32,
      gender: 'Male',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-409',
      category: 'drift',
      categoryLabel: 'Digit Preference',
      concernSummary: 'Repeated round integer readings • 12.00 kg and 95.0 cm recorded consecutively',
      ruleCode: 'RUL-08',
      ruleName: 'Terminal Digit Clumping',
      triggerDetail: 'Consecutive .00 / .50 decimal clustering suggests lack of fine graduation measurement',
      prevWeight: 12.0,
      prevHeight: 95.0,
      prevDate: '09 Sep 2026',
      flaggedWeight: 12.3,
      flaggedHeight: 95.4,
      flaggedDate: '09 Oct 2026',
      weightDelta: '+0.3 kg / +0.4 cm',
      priority: 'Needs Attention',
      priorityColor: 'bg-amber-100 text-amber-800 border-amber-200',
      dueDate: 'In 2 days',
      status: 'Pending Verification',
      isVerified: false,
      tierLevel: 1,
      assignedRole: 'Frontline AWW',
      assignedActor: 'AWW-409',
      escalationHistory: [],
    },
    {
      id: 'BEN-0773',
      actionId: 'ACT-1988',
      ageMonths: 11,
      gender: 'Female',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-410',
      category: 'urgent',
      categoryLabel: 'Acute Drop',
      concernSummary: 'Acute weight depletion • Loss of -850g following gastrointestinal illness',
      ruleCode: 'RUL-03',
      ruleName: 'Negative Weight Progression',
      triggerDetail: 'Drop from 7.65 kg to 6.80 kg in 25 days exceeds 5% physiological limit',
      prevWeight: 7.65,
      prevHeight: 71.0,
      prevDate: '14 Sep 2026',
      flaggedWeight: 6.8,
      flaggedHeight: 71.8,
      flaggedDate: '09 Oct 2026',
      weightDelta: '-0.85 kg in 25d',
      priority: 'Urgent',
      priorityColor: 'bg-rose-100 text-rose-800 border-rose-200',
      dueDate: 'In 3 days',
      status: 'Follow-up Assigned',
      isVerified: false,
      tierLevel: 1,
      assignedRole: 'Frontline AWW',
      assignedActor: 'AWW-410',
      escalationHistory: [],
    },
    {
      id: 'BEN-0922',
      actionId: 'ACT-1972',
      ageMonths: 15,
      gender: 'Male',
      caregiverKinship: 'Mother',
      centreCode: 'AWC-702',
      assignedAww: 'AWW-412',
      category: 'visit',
      categoryLabel: 'Overdue Visit',
      concernSummary: 'Missing monthly growth check • 45 days since last AWC attendance',
      ruleCode: 'RUL-06',
      ruleName: 'Overdue Measurement Check',
      triggerDetail: 'Last recorded measurement was 45 days ago; exceeded 35-day routine surveillance threshold',
      prevWeight: 9.8,
      prevHeight: 75.8,
      prevDate: '27 Aug 2026',
      flaggedWeight: 10.0,
      flaggedHeight: 76.2,
      flaggedDate: '11 Oct 2026',
      weightDelta: '+0.2 kg in 45d',
      priority: 'Needs Attention',
      priorityColor: 'bg-amber-100 text-amber-800 border-amber-200',
      dueDate: 'Today',
      status: 'Pending Verification',
      isVerified: false,
      tierLevel: 1,
      assignedRole: 'Frontline AWW',
      assignedActor: 'AWW-412',
      escalationHistory: [],
    },
  ];
  const acknowledgedExample = cases.find((caseItem) => caseItem.status === 'Pending Verification');
  if (acknowledgedExample) {
    acknowledgedExample.acknowledgedAt = '2026-10-24T10:00:00.000Z';
    acknowledgedExample.acknowledgedBy = acknowledgedExample.assignedAww;
  }

  // Synthesize remaining 29 cases to complete 35 active cases
  const RULES_LIST = [
    { code: 'RUL-01', name: 'Weight Velocity Outlier', cat: 'urgent' as const, label: 'Urgent Anomaly' },
    { code: 'RUL-02', name: 'Negative Height Step', cat: 'drift' as const, label: 'Measurement Drift' },
    { code: 'RUL-03', name: 'Negative Weight Progression', cat: 'urgent' as const, label: 'Acute Drop' },
    { code: 'RUL-04', name: 'Growth Stagnation Alert', cat: 'sam' as const, label: 'SAM / MAM Flag' },
    { code: 'RUL-08', name: 'Digit Clumping Pattern', cat: 'drift' as const, label: 'Digit Clumping' },
  ];

  for (let i = 0; i < 29; i++) {
    const ben = beneficiaries[6 + i];
    const rule = RULES_LIST[i % RULES_LIST.length];
    const isUrgent = rule.cat === 'urgent' || rule.cat === 'sam';
    const flaggedWeight = ben.lastWeight ?? 8.4;
    const flaggedHeight = ben.lastHeight ?? 71.2;
    const prevWeight = rule.code === 'RUL-01'
      ? Number((flaggedWeight - 1.9).toFixed(2))
      : rule.code === 'RUL-03'
        ? Number((flaggedWeight + 0.85).toFixed(2))
        : rule.code === 'RUL-04'
          ? Number((flaggedWeight - 0.3).toFixed(2))
          : rule.code === 'RUL-02'
            ? flaggedWeight
            : Number((flaggedWeight - 0.2).toFixed(2));
    const prevHeight = rule.code === 'RUL-02'
      ? Number((flaggedHeight + 1.5).toFixed(1))
      : Number((flaggedHeight - 0.4).toFixed(1));
    const prevDate = '12 Sep 2026';
    const flaggedDate = ben.lastMeasurementDate || '20 Oct 2026';
    const deltaText = rule.code === 'RUL-02'
      ? `${(flaggedHeight - prevHeight).toFixed(1)} cm (Height)`
      : `${flaggedWeight - prevWeight > 0 ? '+' : ''}${(flaggedWeight - prevWeight).toFixed(2)} kg in ${getDaysBetween(prevDate, flaggedDate)}d`;

    cases.push({
      id: ben.id,
      actionId: `ACT-${2050 + i}`,
      ageMonths: calculateAge(ben.dob, flaggedDate, ben.category, ben.gender).completedMonths,
      gender: ben.gender,
      caregiverKinship: ben.caregiverKinship,
      centreCode: ben.centreCode,
      assignedAww: ben.assignedAww,
      category: rule.cat,
      categoryLabel: rule.label,
      concernSummary: `${rule.name} • Triage flag generated for supervisory verification`,
      ruleCode: rule.code,
      ruleName: rule.name,
      triggerDetail: `Variance detected against ${rule.name} standard thresholds (Illustrative demo rule • Demo simulation)`,
      prevWeight,
      prevHeight,
      prevDate,
      flaggedWeight,
      flaggedHeight,
      flaggedDate,
      weightDelta: deltaText,
      priority: isUrgent ? 'Urgent' : 'Needs Attention',
      priorityColor: isUrgent ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-amber-100 text-amber-800 border-amber-200',
      dueDate: i % 3 === 0 ? 'Today' : i % 3 === 1 ? 'Tomorrow' : 'In 3 days',
      status: i % 5 === 0 ? 'Resolved' : i % 4 === 0 ? 'Under Review' : 'Pending Verification',
      isVerified: i % 5 === 0,
      tierLevel: (1 + (i % 3)) as 1 | 2 | 3 | 4,
      assignedRole: i % 3 === 0 ? 'Frontline AWW' : i % 3 === 1 ? 'Sector Supervisor' : 'Clinical Officer / ANM',
      assignedActor: i % 3 === 0 ? ben.assignedAww : i % 3 === 1 ? 'Sector Supervisor (LS-01)' : 'PHC Medical Officer',
      escalationHistory: [],
    });
  }

  // 8 Configurable Screening Rules
  const rules: RuleDefinition[] = [
    {
      id: 'RUL-01',
      name: 'Weight Velocity Outlier',
      category: 'velocity',
      targetGroup: 'Children 0-59 months',
      condition: 'Monthly weight delta exceeds upper biological threshold (> +1.5 kg / 30 days)',
      actionGenerated: 'Generates Tier-1 physical re-weighing task for frontline AWW.',
      severity: 'Urgent',
      thresholdValue: 1.5,
      isActive: true,
      triggers30d: 14,
      isIllustrative: false,
    },
    {
      id: 'RUL-02',
      name: 'Negative Length / Height Step',
      category: 'negative',
      targetGroup: 'Children 0-59 months',
      condition: 'Child recorded height decreases by > 1.5 cm compared to previous month',
      actionGenerated: 'Flags posture alignment check and stadiometer re-measure task.',
      severity: 'Needs Attention',
      thresholdValue: 1.5,
      isActive: true,
      triggers30d: 9,
      isIllustrative: false,
    },
    {
      id: 'RUL-03',
      name: 'Acute Weight Depletion',
      category: 'negative',
      targetGroup: 'Children 6-59 months',
      condition: 'Rapid drop of > 0.8 kg in under 30 days without recorded illness note',
      actionGenerated: 'Initiates immediate home visit and clinical triage review.',
      severity: 'Urgent',
      thresholdValue: 0.8,
      isActive: true,
      triggers30d: 6,
      isIllustrative: false,
    },
    {
      id: 'RUL-04',
      name: 'Growth Stagnation (> 45 Days)',
      category: 'stagnation',
      targetGroup: 'Infants 6-23 months',
      condition: 'Total weight gain <= 0.1 kg across 45 consecutive calendar days',
      actionGenerated: 'Escalates to Sector Lady Supervisor for NRC referral consideration.',
      severity: 'Urgent',
      thresholdValue: 0.1,
      isActive: true,
      triggers30d: 11,
      isIllustrative: false,
    },
    {
      id: 'RUL-05',
      name: 'Supra-Physiological Stature Delta',
      category: 'velocity',
      targetGroup: 'Children 0-59 months',
      condition: 'Height velocity exceeds +4.5 cm / month',
      actionGenerated: 'Prompts inspection of infantometer headboard alignment.',
      severity: 'Needs Attention',
      thresholdValue: 4.5,
      isActive: true,
      triggers30d: 4,
      isIllustrative: true,
    },
    {
      id: 'RUL-06',
      name: 'Overdue Surveillance Check',
      category: 'stagnation',
      targetGroup: 'All registered cohorts',
      condition: 'No physical measurement logged for > 35 calendar days',
      actionGenerated: 'Generates home visit reminder on AWW mobile roster.',
      severity: 'Needs Attention',
      thresholdValue: 35.0,
      isActive: true,
      triggers30d: 18,
      isIllustrative: true,
    },
    {
      id: 'RUL-07',
      name: 'Extreme Biological Implausibility',
      category: 'velocity',
      targetGroup: 'All beneficiaries',
      condition: 'Weight outside absolute human limits (0.5 kg - 45 kg for children < 5y)',
      actionGenerated: 'Hard blocks submission; requires supervisor confirmation override.',
      severity: 'Urgent',
      thresholdValue: 45.0,
      isActive: true,
      triggers30d: 2,
      isIllustrative: false,
    },
    {
      id: 'RUL-08',
      name: 'Terminal Digit Clumping',
      category: 'clumping',
      targetGroup: 'All entries',
      condition: 'Consecutive .00 or .50 terminal digit clustering on digital scale',
      actionGenerated: 'Flags potential scale tare miscalibration or keying heuristic.',
      severity: 'Warning',
      thresholdValue: 3.0,
      isActive: true,
      triggers30d: 22,
      isIllustrative: true,
    },
  ];

  // Referrals
  const referrals: ReferralRecord[] = [
    {
      id: 'REF-501',
      beneficiaryId: 'BEN-0334',
      ageDisplay: '9 months',
      reason: 'Severe Acute Malnutrition (SAM) • WAZ < -3 SD & Stagnation > 60d',
      destination: 'Nutrition Rehabilitation Centre (NRC)',
      referralDate: '15 Oct 2026',
      owner: 'AWW-405',
      dueDate: '22 Oct 2026',
      status: 'Follow-up In Progress',
      priority: 'Urgent',
      followUpAttempts: [
        {
          id: 'FU-1',
          date: '17 Oct 2026',
          actor: 'AWW-405',
          method: 'Home Visit',
          findings: 'Caregiver informed of NRC admission protocol. Prepared initial referral slip.',
        },
        {
          id: 'FU-2',
          date: '20 Oct 2026',
          actor: 'Sector Supervisor (LS-01)',
          method: 'Home Visit',
          findings: 'Family agreed to transport child to District Hospital NRC on Monday morning.',
        },
      ],
    },
    {
      id: 'REF-502',
      beneficiaryId: 'BEN-0773',
      ageDisplay: '11 months',
      reason: 'Post-measles acute weight depletion (> 20% loss in 21 days)',
      destination: 'Primary Health Centre (PHC)',
      referralDate: '10 Oct 2026',
      owner: 'AWW-410',
      dueDate: '16 Oct 2026',
      status: 'Completed',
      priority: 'High',
      followUpAttempts: [
        {
          id: 'FU-3',
          date: '12 Oct 2026',
          actor: 'AWW-410',
          method: 'AWC Consultation',
          findings: 'Caregiver brought infant to PHC outpatient department.',
        },
      ],
      finalOutcome: 'Therapeutic antibiotic course completed; oral rehydration therapy stabilized weight.',
      outcomeDate: '18 Oct 2026',
      nextSteps: 'Weekly weight spot-checks at AWC-702; double ration THR provided.',
    },
    {
      id: 'REF-503',
      beneficiaryId: 'BEN-1019',
      ageDisplay: '18 months',
      reason: 'Bilateral pedal edema (Kwashiorkor presentation)',
      destination: 'District Hospital',
      referralDate: '21 Oct 2026',
      owner: 'AWW-409',
      dueDate: '25 Oct 2026',
      status: 'Pending',
      priority: 'Urgent',
      followUpAttempts: [],
    },
  ];
  referrals.push(...generateExpandedReferrals(beneficiaries));
  referrals.forEach((referral) => {
    if (referral.lifecycleStatus) return;
    if (referral.status === 'Completed') referral.lifecycleStatus = 'outcome_recorded';
    else if (referral.followUpAttempts.some((attempt) => attempt.method === 'AWC Consultation')) referral.lifecycleStatus = 'attended';
    else if (referral.followUpAttempts.length > 0) referral.lifecycleStatus = 'acknowledged';
    else referral.lifecycleStatus = 'sent';
  });

  // Audit Log (Synthetic IDs and role actors only)
  const auditLog: AuditLedgerEntry[] = [
    {
      id: 'LED-8921',
      timestamp: '24 Oct 2026, 11:30 AM',
      actionId: 'ACT-2041',
      palId: 'BEN-0142',
      actor: 'AWW-409',
      actionType: 'Supervisory Physical Re-weigh',
      deltaSummary: 'Identified typo: 12.30 kg keyed -> 8.90 kg verified',
      proofHash: '0x8f2a...c419',
      status: 'Verified',
    },
    {
      id: 'LED-8920',
      timestamp: '23 Oct 2026, 04:15 PM',
      actionId: 'ACT-2038',
      palId: 'BEN-0891',
      actor: 'AWW-412',
      actionType: 'Infant Stadiometer Alignment Check',
      deltaSummary: 'Adjusted length headboard to 84.8 cm',
      proofHash: '0x3b1c...e892',
      status: 'Verified',
    },
    {
      id: 'LED-8919',
      timestamp: '22 Oct 2026, 02:40 PM',
      actionId: 'ACT-2035',
      palId: 'BEN-0334',
      actor: 'Sector Supervisor (LS-01)',
      actionType: 'NRC Escalation & Referral Slip',
      deltaSummary: 'Dispatched to Sector PHC for SAM evaluation',
      proofHash: '0x7a4d...1102',
      status: 'Escalated',
    },
    {
      id: 'LED-8918',
      timestamp: '21 Oct 2026, 10:05 AM',
      actionId: 'ACT-1994',
      palId: 'BEN-0512',
      actor: 'AWW-409',
      actionType: 'Height Parallax Rectification',
      deltaSummary: 'Confirmed true standing height: 90.2 cm',
      proofHash: '0x99e1...77b3',
      status: 'Verified',
    },
    {
      id: 'LED-8917',
      timestamp: '20 Oct 2026, 01:20 PM',
      actionId: 'ACT-1988',
      palId: 'BEN-0773',
      actor: 'AWW-410',
      actionType: 'Post-Illness Weight Recovery Check',
      deltaSummary: 'Weight stabilized at 7.10 kg (+300g)',
      proofHash: '0x44f0...aa29',
      status: 'Verified',
    },
  ];

  const measurements: MeasurementRecord[] = generateExpandedMeasurements(beneficiaries, generateCanonicalMeasurements());
  measurements.forEach((measurement) => {
    const beneficiary = beneficiaries.find((item) => item.id === measurement.beneficiaryId);
    if (beneficiary) measurement.recordedBy = beneficiary.assignedAww;
  });
  cases.forEach((caseItem) => {
    const beneficiary = beneficiaries.find((item) => item.id === caseItem.id);
    if (beneficiary) {
      caseItem.centreCode = beneficiary.centreCode;
      caseItem.assignedAww = beneficiary.assignedAww;
      if (caseItem.assignedActor.startsWith('AWW-')) caseItem.assignedActor = beneficiary.assignedAww;
    }
  });
  referrals.forEach((referral) => {
    const beneficiary = beneficiaries.find((item) => item.id === referral.beneficiaryId);
    if (beneficiary) {
      referral.owner = beneficiary.assignedAww;
      referral.followUpAttempts.forEach((attempt) => {
        if (attempt.actor.startsWith('AWW-')) attempt.actor = beneficiary.assignedAww;
      });
    }
  });
  const support = generateSupportRecords(beneficiaries, cases, referrals);

  return { beneficiaries, measurements, cases, rules, referrals, auditLog, ...support };
}

function generateExpandedReferrals(beneficiaries: BeneficiaryRecord[]): ReferralRecord[] {
  const children = beneficiaries.filter((beneficiary) => beneficiary.category === 'child_under_6');
  const referralSpecs: Array<{ status: ReferralRecord['status']; lifecycleStatus: ReferralLifecycleStatus; method?: ReferralFollowUp['method'] }> = [
    { status: 'Pending', lifecycleStatus: 'sent' },
    { status: 'Follow-up In Progress', lifecycleStatus: 'acknowledged', method: 'Phone Call' },
    { status: 'Follow-up In Progress', lifecycleStatus: 'attended', method: 'AWC Consultation' },
    { status: 'Completed', lifecycleStatus: 'outcome_recorded', method: 'AWC Consultation' },
  ];
  return referralSpecs.map((spec, index) => {
    const beneficiary = children[10 + index];
    const age = calculateAge(beneficiary.dob, DEMO_CURRENT_DATE).completedMonths;
    const followUpAttempts: ReferralFollowUp[] = spec.method ? [{
      id: `FU-DEMO-${index + 1}`,
      date: `2026-10-${String(16 + index).padStart(2, '0')}`,
      actor: beneficiary.assignedAww,
      method: spec.method,
      findings: spec.lifecycleStatus === 'attended'
        ? 'Attendance recorded; no clinical outcome is included in this synthetic record.'
        : 'Follow-up contact recorded in the synthetic workflow.',
    }] : [];
    return {
      id: `REF-60${index + 1}`,
      beneficiaryId: beneficiary.id,
      ageDisplay: `${age} months`,
      reason: 'Routine programme follow-up (synthetic demonstration)',
      destination: 'Community Health Centre (CHC)' as const,
      referralDate: `2026-10-${String(14 + index).padStart(2, '0')}`,
      owner: beneficiary.assignedAww,
      dueDate: `2026-10-${String(25 + index).padStart(2, '0')}`,
      status: spec.status,
      lifecycleStatus: spec.lifecycleStatus,
      priority: 'Routine' as const,
      followUpAttempts,
      ...(spec.lifecycleStatus === 'outcome_recorded' ? {
        finalOutcome: 'Administrative follow-up completion recorded; no clinical outcome was supplied.',
        outcomeConfirmed: true,
        outcomeDate: '2026-10-20',
      } : {}),
    };
  });
}

// Canonical Measurements Seed
function generateCanonicalMeasurements(): MeasurementRecord[] {
  return [
    // BEN-0142 - Longitudinal History leading to outlier
    {
      id: 'MEA-101',
      beneficiaryId: 'BEN-0142',
      date: '2026-06-14',
      ageMonths: 10,
      weightKg: 7.2,
      heightCm: 72.0,
      muacCm: 13.5,
      hasEdema: false,
      posture: 'recumbent',
      recordedBy: 'AWW-409',
      qualityFlags: [],
      clinicalFlags: [],
      isVerified: true,
      notes: 'Initial monthly growth monitoring entry.',
    },
    {
      id: 'MEA-102',
      beneficiaryId: 'BEN-0142',
      date: '2026-07-16',
      ageMonths: 11,
      weightKg: 7.7,
      heightCm: 73.8,
      muacCm: 13.7,
      hasEdema: false,
      posture: 'recumbent',
      recordedBy: 'AWW-409',
      qualityFlags: [],
      clinicalFlags: [],
      isVerified: true,
      notes: 'Normal growth velocity; THR ration provided.',
    },
    {
      id: 'MEA-103',
      beneficiaryId: 'BEN-0142',
      date: '2026-08-18',
      ageMonths: 12,
      weightKg: 8.1,
      heightCm: 75.5,
      muacCm: 13.9,
      hasEdema: false,
      posture: 'recumbent',
      recordedBy: 'AWW-409',
      qualityFlags: [],
      clinicalFlags: [],
      isVerified: true,
      notes: '1-Year milestone check; Vitamin A dose administered.',
    },
    {
      id: 'MEA-104',
      beneficiaryId: 'BEN-0142',
      date: '2026-09-26',
      ageMonths: 13,
      weightKg: 8.5,
      heightCm: 77.2,
      muacCm: 14.1,
      hasEdema: false,
      posture: 'recumbent',
      recordedBy: 'AWW-409',
      qualityFlags: [],
      clinicalFlags: [],
      isVerified: true,
      notes: 'Consistent positive velocity trajectory.',
    },
    {
      id: 'MEA-105',
      beneficiaryId: 'BEN-0142',
      date: '2026-10-24',
      ageMonths: 14,
      weightKg: 12.3,
      heightCm: 77.5,
      muacCm: 14.2,
      hasEdema: false,
      posture: 'recumbent',
      recordedBy: 'AWW-409',
      qualityFlags: ['Weight Velocity Outlier (+3.8 kg / 28d)'],
      clinicalFlags: [],
      isVerified: false,
      notes: 'Flagged for supervisory physical re-weigh.',
    },

    // BEN-0891 - Negative height step anomaly
    {
      id: 'MEA-106',
      beneficiaryId: 'BEN-0891',
      date: '2026-09-10',
      ageMonths: 21,
      weightKg: 10.8,
      heightCm: 84.5,
      muacCm: 14.5,
      hasEdema: false,
      posture: 'recumbent',
      recordedBy: 'AWW-412',
      qualityFlags: [],
      clinicalFlags: [],
      isVerified: true,
    },
    {
      id: 'MEA-107',
      beneficiaryId: 'BEN-0891',
      date: '2026-10-10',
      ageMonths: 22,
      weightKg: 10.9,
      heightCm: 82.5,
      muacCm: 14.5,
      hasEdema: false,
      posture: 'recumbent',
      recordedBy: 'AWW-412',
      qualityFlags: ['Negative Length / Height Step (-2.0 cm)'],
      clinicalFlags: [],
      isVerified: false,
      notes: 'Decreased stature indicates stadiometer positioning misalignment.',
    },

    // BEN-0334 - Growth stagnation & SAM evaluation
    {
      id: 'MEA-108',
      beneficiaryId: 'BEN-0334',
      date: '2026-08-12',
      ageMonths: 7,
      weightKg: 6.8,
      heightCm: 66.2,
      muacCm: 12.2,
      hasEdema: false,
      posture: 'recumbent',
      recordedBy: 'AWW-405',
      qualityFlags: [],
      clinicalFlags: ['Moderate Acute Malnutrition (MAM)'],
      isVerified: true,
    },
    {
      id: 'MEA-109',
      beneficiaryId: 'BEN-0334',
      date: '2026-10-14',
      ageMonths: 9,
      weightKg: 6.85,
      heightCm: 67.0,
      muacCm: 11.4,
      hasEdema: false,
      posture: 'recumbent',
      recordedBy: 'AWW-405',
      qualityFlags: [],
      clinicalFlags: ['Multi-Month Growth Stagnation', 'Red MUAC (< 11.5 cm)'],
      isVerified: false,
      notes: 'Flat 62-day trajectory and red MUAC; referred to NRC.',
    },
  ];
}

function generateExpandedMeasurements(
  beneficiaries: BeneficiaryRecord[],
  existing: MeasurementRecord[],
): MeasurementRecord[] {
  const measurements = [...existing];
  const withHistory = new Set(existing.map((measurement) => measurement.beneficiaryId));
  let sequence = 5001;
  beneficiaries.filter((beneficiary) => beneficiary.category === 'child_under_6' && !withHistory.has(beneficiary.id)).forEach((beneficiary) => {
    const latestDate = beneficiary.lastMeasurementDate || DEMO_CURRENT_DATE;
    const latest = new Date(`${latestDate}T00:00:00Z`);
    const registration = new Date(`${beneficiary.registrationDate}T00:00:00Z`);
    const earlier = new Date(latest.getTime() - 45 * 24 * 60 * 60 * 1000);
    const firstDate = earlier < registration ? registration : earlier;
    const latestWeight = beneficiary.lastWeight ?? beneficiary.birthWeight ?? 2.9;
    const latestHeight = beneficiary.lastHeight ?? 50;
    const addRecord = (date: Date, weightKg: number, heightCm: number) => {
      const dateValue = date.toISOString().slice(0, 10);
      const age = calculateAge(beneficiary.dob, dateValue);
      measurements.push({
        id: `MEA-${sequence++}`,
        beneficiaryId: beneficiary.id,
        date: dateValue,
        ageMonths: age.completedMonths,
        weightKg,
        heightCm,
        hasEdema: false,
        posture: age.recommendedMeasurementPosture,
        recordedBy: beneficiary.assignedAww,
        qualityFlags: [],
        clinicalFlags: [],
        isVerified: false,
        notes: 'Synthetic demonstration reading; no clinical interpretation recorded.',
      });
    };
    if (firstDate < latest) {
      addRecord(firstDate, Number(Math.max(0.5, latestWeight - 0.25).toFixed(2)), Number(Math.max(45, latestHeight - 0.4).toFixed(1)));
    }
    addRecord(latest, latestWeight, latestHeight);
  });
  return measurements;
}

function generateSupportRecords(beneficiaries: BeneficiaryRecord[], cases: BeneficiaryCase[], referrals: ReferralRecord[]) {
  const maternalProfiles: DemoMaternalProfileRecord[] = beneficiaries
    .filter((beneficiary) => beneficiary.category === 'pregnant' || beneficiary.category === 'lactating')
    .map((beneficiary) => ({
      id: `MAT-${beneficiary.id.slice(4)}`,
      beneficiaryId: beneficiary.id,
      centreCode: beneficiary.centreCode,
      stage: beneficiary.category as 'pregnant' | 'lactating',
      registeredOn: beneficiary.registrationDate,
    }));

  const homeVisitBeneficiaries = beneficiaries.filter((_, index) => index % 5 === 0);
  const homeVisits: DemoHomeVisitRecord[] = homeVisitBeneficiaries.map((beneficiary, index) => ({
    id: `HVIS-${String(index + 1).padStart(4, '0')}`,
    beneficiaryId: beneficiary.id,
    centreCode: beneficiary.centreCode,
    workerId: beneficiary.assignedAww,
    visitDate: dateDaysBeforeDemo(1 + ((index * 3) % 22)),
    status: index % 4 === 0 ? 'scheduled' : 'completed',
    note: 'Synthetic programme follow-up; no clinical outcome recorded.',
  }));

  const serviceRecords: DemoServiceRecord[] = beneficiaries.map((beneficiary, index) => ({
    id: `SERV-${String(index + 1).padStart(4, '0')}`,
    beneficiaryId: beneficiary.id,
    centreCode: beneficiary.centreCode,
    workerId: beneficiary.assignedAww,
    serviceType: beneficiary.category === 'child_under_6'
      ? (index % 3 === 0 ? 'supplementary_nutrition' : 'growth_monitoring')
      : 'nutrition_counselling',
    serviceDate: beneficiary.lastMeasurementDate || beneficiary.registrationDate,
    status: index % 9 === 0 ? 'scheduled' : 'recorded',
  }));

  const reviewHistory: DemoReviewHistoryRecord[] = cases.map((caseItem) => ({
    id: `REV-${caseItem.actionId}`,
    actionId: caseItem.actionId,
    beneficiaryId: caseItem.id,
    centreCode: caseItem.centreCode,
    reviewerId: caseItem.status === 'Pending Verification' ? caseItem.assignedAww : 'LS-01',
    status: caseItem.status === 'Under Review' || caseItem.isVerified ? 'reviewed' : 'pending',
    ...(caseItem.status === 'Under Review' || caseItem.isVerified ? { reviewedOn: DEMO_TODAY } : {}),
  }));

  const verificationRecords: DemoVerificationRecord[] = cases.map((caseItem) => ({
    id: `VER-${caseItem.actionId}`,
    actionId: caseItem.actionId,
    beneficiaryId: caseItem.id,
    centreCode: caseItem.centreCode,
    status: caseItem.isVerified ? 'resolved' : 'open',
    openedOn: DEMO_TODAY,
    ...(caseItem.isVerified ? { resolvedOn: DEMO_TODAY } : {}),
  }));

  // Keep the stable referral collection as the owner of lifecycle state. These
  // records are returned here for persistence and scoped read-only views.
  void referrals;
  return {
    centres: CANONICAL_CENTRES.map((centre) => ({ ...centre })),
    workers: CANONICAL_WORKERS.map((worker) => ({ ...worker })),
    homeVisits,
    maternalProfiles,
    serviceRecords,
    reviewHistory,
    verificationRecords,
  };
}

// Deterministic proof hash generator (no Math.random)
function generateDeterministicProofHash(counter: number, prefixCode: number = 4829): string {
  const p1 = ((counter * prefixCode + 1357) % 65536).toString(16).padStart(4, '0');
  const p2 = ((counter * 1031 + 8421) % 65536).toString(16).padStart(4, '0');
  return `0x${p1}...${p2}`;
}

// Initial In-Memory Reactive Store with Persistence
class MockStore {
  private beneficiaries: BeneficiaryRecord[] = [];
  private measurements: MeasurementRecord[] = [];
  private cases: BeneficiaryCase[] = [];
  private rules: RuleDefinition[] = [];
  private referrals: ReferralRecord[] = [];
  private auditLog: AuditLedgerEntry[] = [];
  private aiDecisions: AIDecisionRecord[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const saved = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          typeof parsed === 'object' &&
          Array.isArray(parsed.beneficiaries) &&
          parsed.beneficiaries.length > 0 &&
          Array.isArray(parsed.cases) &&
          Array.isArray(parsed.rules)
        ) {
          this.beneficiaries = parsed.beneficiaries;
          this.measurements =
            Array.isArray(parsed.measurements) && parsed.measurements.length > 0
              ? parsed.measurements
              : generateCanonicalMeasurements();
          this.cases = parsed.cases;
          this.rules = parsed.rules;
          this.referrals = Array.isArray(parsed.referrals) ? parsed.referrals : [];
          this.auditLog = Array.isArray(parsed.auditLog) ? parsed.auditLog : [];
          this.aiDecisions = Array.isArray(parsed.aiDecisions) ? parsed.aiDecisions : [];
          return;
        }
      }
    } catch (err) {
      console.warn('Poshan Action Layer: Failed to restore state from localStorage, falling back to seed.', err);
    }

    // Default to Canonical Seed
    const seed = generateCanonicalSeed();
    this.beneficiaries = seed.beneficiaries;
    this.measurements = seed.measurements;
    this.cases = seed.cases;
    this.rules = seed.rules;
    this.referrals = seed.referrals;
    this.auditLog = seed.auditLog;
    this.aiDecisions = [];
  }

  private saveState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = {
          beneficiaries: this.beneficiaries,
          measurements: this.measurements,
          cases: this.cases,
          rules: this.rules,
          referrals: this.referrals,
          auditLog: this.auditLog,
          aiDecisions: this.aiDecisions,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {
      // Storage quota or policy exception
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.saveState();
    this.listeners.forEach((l) => l());
  }

  // =========================================================================
  // RESET DEMO DATA
  // =========================================================================
  public resetToDemoSeed() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    const seed = generateCanonicalSeed();
    this.beneficiaries = seed.beneficiaries;
    this.measurements = seed.measurements;
    this.cases = seed.cases;
    this.rules = seed.rules;
    this.referrals = seed.referrals;
    this.auditLog = seed.auditLog;

    this.notify();
  }

  // =========================================================================
  // BENEFICIARY OPERATIONS WITH ROLE SCOPING
  // =========================================================================
  public getBeneficiaries(scope?: DemoScope): BeneficiaryRecord[] {
    if (scope?.role === 'Parent/Family') {
      const allowedIds = scope.linkedBeneficiaryIds || [];
      return this.beneficiaries.filter((b) => allowedIds.includes(b.id));
    }
    const centres = centresForDemoScope(scope);
    if (centres) return this.beneficiaries.filter((beneficiary) => centres.includes(beneficiary.centreCode));
    return [...this.beneficiaries];
  }

  public getBeneficiaryById(id: string, scope?: DemoScope): BeneficiaryRecord | undefined {
    const beneficiary = this.beneficiaries.find((b) => b.id === id);
    if (!beneficiary) return undefined;
    if (scope?.role === 'Parent/Family') {
      const allowedIds = scope.linkedBeneficiaryIds || [];
      return allowedIds.includes(id) ? beneficiary : undefined;
    }
    if (scope && !scopeAllowsCentre(scope, beneficiary.centreCode)) return undefined;
    return beneficiary;
  }

  public getCentres(scope?: DemoScope): DemoCentreRecord[] {
    if (scope?.role === 'Parent/Family') {
      const allowedIds = scope.linkedBeneficiaryIds || [];
      const linkedCentres = new Set(
        this.beneficiaries.filter((b) => allowedIds.includes(b.id)).map((b) => b.centreCode)
      );
      return CANONICAL_CENTRES.filter((c) => linkedCentres.has(c.id)).map((c) => ({ ...c }));
    }
    const centres = centresForDemoScope(scope);
    return CANONICAL_CENTRES
      .filter((centre) => !centres || centres.includes(centre.id))
      .map((centre) => ({ ...centre }));
  }

  public getWorkers(scope?: DemoScope): DemoWorkerRecord[] {
    if (scope?.role === 'Parent/Family') {
      const allowedIds = scope.linkedBeneficiaryIds || [];
      const linkedAwws = new Set(
        this.beneficiaries.filter((b) => allowedIds.includes(b.id)).map((b) => b.assignedAww)
      );
      return CANONICAL_WORKERS.filter((w) => linkedAwws.has(w.id)).map((w) => ({ ...w }));
    }
    const centres = centresForDemoScope(scope);
    return CANONICAL_WORKERS
      .filter((worker) => !centres || (worker.centreCode && centres.includes(worker.centreCode)))
      .map((worker) => ({ ...worker }));
  }

  public getTasks(scope?: DemoScope): DemoTaskRecord[] {
    return this.getCases(scope).map((caseItem) => ({
      id: `TASK-${caseItem.actionId}`,
      beneficiaryId: caseItem.id,
      centreCode: caseItem.centreCode,
      ownerId: caseItem.assignedAww,
      status: caseItem.isVerified || caseItem.status === 'Resolved'
        ? 'closed'
        : caseItem.acknowledgedAt
          ? 'acknowledged'
          : caseItem.status === 'Under Review'
            ? 'in_progress'
            : 'assigned',
      dueDate: caseItem.dueDate,
      caseStatus: caseItem.status,
    }));
  }

  public getHomeVisits(scope?: DemoScope): DemoHomeVisitRecord[] {
    const { homeVisits } = generateSupportRecords(this.beneficiaries, this.cases, this.referrals);
    if (scope?.role === 'Parent/Family') {
      const allowedIds = scope.linkedBeneficiaryIds || [];
      return homeVisits.filter((visit) => allowedIds.includes(visit.beneficiaryId));
    }
    const centres = centresForDemoScope(scope);
    return homeVisits.filter((visit) => !centres || centres.includes(visit.centreCode));
  }

  public getMaternalProfiles(scope?: DemoScope): DemoMaternalProfileRecord[] {
    const { maternalProfiles } = generateSupportRecords(this.beneficiaries, this.cases, this.referrals);
    if (scope?.role === 'Parent/Family') {
      const allowedIds = scope.linkedBeneficiaryIds || [];
      return maternalProfiles.filter((profile) => allowedIds.includes(profile.beneficiaryId));
    }
    const centres = centresForDemoScope(scope);
    return maternalProfiles.filter((profile) => !centres || centres.includes(profile.centreCode));
  }

  public getServiceRecords(scope?: DemoScope): DemoServiceRecord[] {
    const { serviceRecords } = generateSupportRecords(this.beneficiaries, this.cases, this.referrals);
    if (scope?.role === 'Parent/Family') {
      const allowedIds = scope.linkedBeneficiaryIds || [];
      return serviceRecords.filter((record) => allowedIds.includes(record.beneficiaryId));
    }
    const centres = centresForDemoScope(scope);
    return serviceRecords.filter((record) => !centres || centres.includes(record.centreCode));
  }

  public addBeneficiary(
    ben: {
      dob: string;
      gender: 'Male' | 'Female' | 'Other';
      category: 'child_under_6' | 'pregnant' | 'lactating' | 'adolescent';
      caregiverKinship?: string;
      centreCode?: string;
      assignedAww?: string;
      birthWeight?: number;
      customId?: string;
    },
    actorContext?: DemoScope
  ): { id: string; error?: string } {
    // Validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ben.dob) || Number.isNaN(Date.parse(`${ben.dob}T00:00:00Z`)) || new Date(`${ben.dob}T00:00:00Z`).toISOString().slice(0, 10) !== ben.dob || ben.dob > getTodayISODate()) {
      return { id: '', error: 'Enter a valid date of birth that is not in the future.' };
    }
    if (!['Male', 'Female', 'Other'].includes(ben.gender) || !['child_under_6', 'pregnant', 'lactating', 'adolescent'].includes(ben.category)) {
      return { id: '', error: 'Select a supported category and gender value.' };
    }
    if (ben.birthWeight !== undefined && (!Number.isFinite(ben.birthWeight) || ben.birthWeight < 0.5 || ben.birthWeight > 10)) {
      return { id: '', error: 'Birth weight must be between 0.5 and 10 kg.' };
    }
    if (ben.category === 'child_under_6' && ben.birthWeight === undefined) {
      return { id: '', error: 'Enter the child’s recorded birth weight before registration.' };
    }

    // Enforce role permission check
    if (actorContext?.role !== 'AWW') {
      return { id: '', error: `Role ${actorContext?.role || 'unknown'} cannot register beneficiaries directly.` };
    }

    const categoryAge = calculateAge(ben.dob, getTodayISODate(), ben.category, ben.gender);
    if (ben.category === 'child_under_6' && categoryAge.completedMonths >= 72) {
      return { id: '', error: 'A child registration must be under 6 years old.' };
    }
    if (ben.category === 'adolescent' && (ben.gender !== 'Female' || categoryAge.completedMonths < 120 || categoryAge.completedMonths >= 240)) {
      return { id: '', error: 'Adolescent girls must be female and between 10 and 19 years old.' };
    }
    if ((ben.category === 'pregnant' || ben.category === 'lactating') && ben.gender !== 'Female') {
      return { id: '', error: 'Pregnant women and lactating mothers must be recorded as female.' };
    }

    let nextBenNum = 2000 + this.beneficiaries.length;
    while (this.beneficiaries.some((beneficiary) => beneficiary.id === `BEN-${nextBenNum}`)) nextBenNum++;
    let candidateId = ben.customId || `BEN-${nextBenNum}`;

    // Prevent duplicate IDs
    if (this.beneficiaries.some((b) => b.id === candidateId)) {
      if (ben.customId) {
        return { id: '', error: `Beneficiary ID ${candidateId} already exists in records.` };
      }
      candidateId = `BEN-${nextBenNum + 7}`;
    }

    const birthWeight = ben.birthWeight;
    const actorId = actorContext?.actorId || 'AWW-409';
    const centreCode = actorContext?.centreCode || (actorContext?.actorId && DEMO_AWW_CENTRES[actorContext.actorId]) || 'AWC-702';
    if (!centresForDemoScope(actorContext)?.includes(centreCode) || (ben.centreCode && ben.centreCode !== centreCode)) {
      return { id: '', error: 'AWW registration is limited to the assigned demo centre.' };
    }

    const newRecord: BeneficiaryRecord = {
      id: candidateId,
      name: fictionalBeneficiaryName(this.beneficiaries.length, ben.gender),
      dob: ben.dob,
      gender: ben.gender,
      category: ben.category,
      caregiverKinship: ben.caregiverKinship || 'Mother',
      centreCode,
      assignedAww: actorId,
      status: 'Active',
      registrationDate: getTodayISODate(),
      hasActiveFlag: false,
    };
    if (ben.category === 'child_under_6' && birthWeight !== undefined) {
      newRecord.birthWeight = birthWeight;
    }

    this.beneficiaries.unshift(newRecord);

    // Create baseline casework log
    this.auditLog.unshift({
      id: `LED-${String(8922 + this.auditLog.length)}`,
      timestamp: new Date().toISOString(),
      actionId: `REG-${candidateId.replace('BEN-', '')}`,
      palId: candidateId,
      actor: actorId,
      actionType: 'Beneficiary Registration',
      deltaSummary: `New ${ben.category} registered at ${centreCode}.${birthWeight === undefined ? '' : ` Birth weight ${birthWeight} kg recorded.`}`,
      proofHash: generateDeterministicProofHash(this.auditLog.length + 1, 3571),
      status: 'Logged',
    });

    this.notify();
    return { id: candidateId };
  }

  // =========================================================================
  // MEASUREMENT & SCREENING INTAKE
  // =========================================================================
  public getMeasurements(beneficiaryId?: string, scope?: DemoScope): MeasurementRecord[] {
    if (scope?.role === 'Parent/Family') {
      const allowedIds = scope.linkedBeneficiaryIds || [];
      return this.measurements.filter((m) => {
        if (!allowedIds.includes(m.beneficiaryId)) return false;
        if (beneficiaryId && m.beneficiaryId !== beneficiaryId) return false;
        return true;
      });
    }
    if (scope) {
      const centres = centresForDemoScope(scope) || [];
      return this.measurements.filter((measurement) => {
        if (beneficiaryId && measurement.beneficiaryId !== beneficiaryId) return false;
        const beneficiary = this.getBeneficiaryById(measurement.beneficiaryId);
        return Boolean(beneficiary && centres.includes(beneficiary.centreCode));
      });
    }
    if (!beneficiaryId) return [...this.measurements];
    return this.measurements.filter((m) => m.beneficiaryId === beneficiaryId);
  }

  public recordMeasurement(
    params: {
      beneficiaryId: string;
      weightKg: number;
      heightCm: number;
      measurementDate?: string;
      posture?: 'recumbent' | 'standing';
      muacCm?: number;
      hasEdema?: boolean;
      notes?: string;
      actor?: string;
    },
    actorContext?: DemoScope
  ): { success: boolean; measurementId?: string; flags: string[]; caseCreated?: string; error?: string } {
    // Check permission: CDPO and DPO cannot record measurements
    if (!actorContext?.role || !canPerformAction(actorContext.role, 'record_measurement')) {
      return {
        success: false,
        flags: [],
        error: `Role ${actorContext?.role || 'unknown'} cannot record field measurements. Restricted to AWW and Lady Supervisor.`,
      };
    }

    const ben = this.getBeneficiaryById(params.beneficiaryId);
    if (!ben) return { success: false, flags: [], error: 'Beneficiary not found.' };
    const permittedCentres = centresForDemoScope(actorContext);
    if (permittedCentres && !permittedCentres.includes(ben.centreCode)) {
      return { success: false, flags: [], error: 'Measurement is outside the assigned demo organization scope.' };
    }
    if (ben.category !== 'child_under_6') {
      return { success: false, flags: [], error: 'Anthropometric measurement entry is currently available for children only.' };
    }

    const measurementDate = params.measurementDate === undefined ? getTodayISODate() : params.measurementDate;
    const inputError = validateMeasurementInput(params.weightKg, params.heightCm, measurementDate, getTodayISODate());
    if (inputError) return { success: false, flags: [], error: inputError };

    if (this.measurements.some((m) => m.beneficiaryId === ben.id && m.date === measurementDate)) {
      return {
        success: false,
        flags: [],
        error: 'A measurement already exists for this beneficiary on that date.',
      };
    }

    const actor = actorContext?.actorId || params.actor || ben.assignedAww || 'AWW-409';

    // Retrieve previous measurement
    const previous = this.measurements
      .filter((m) => m.beneficiaryId === params.beneficiaryId)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    // Run screening heuristic engine with active custom rules
    const evaluation = evaluateMeasurementEntry({
      currentWeight: params.weightKg,
      currentHeight: params.heightCm,
      measurementDate,
      referenceDate: getTodayISODate(),
      dob: ben.dob,
      previousRecord: previous ? {
          weight: previous.weightKg,
          height: previous.heightCm,
          date: previous.date,
        } : undefined,
      muacCm: params.muacCm,
      hasBilateralEdema: params.hasEdema,
      customRules: this.rules,
    });

    if (evaluation.isImpossible) {
      return {
        success: false,
        flags: evaluation.flags.map((f) => f.name),
        error: evaluation.flags[0]?.summary || 'Biologically impossible measurement parameters.',
      };
    }

    const age = calculateAge(ben.dob, measurementDate);
    const measurementId = `MEA-${1200 + this.measurements.length}`;
    const actionableFlags = [
      ...evaluation.qualityFlags.filter((flag) => flag.code !== 'INFO-NO-HISTORY'),
      ...evaluation.clinicalFlags,
    ];

    const newMeasurement: MeasurementRecord = {
      id: measurementId,
      beneficiaryId: ben.id,
      date: measurementDate,
      ageMonths: age.completedMonths,
      weightKg: params.weightKg,
      heightCm: params.heightCm,
      muacCm: params.muacCm,
      hasEdema: !!params.hasEdema,
      posture: params.posture || age.recommendedMeasurementPosture,
      recordedBy: actor,
      qualityFlags: evaluation.qualityFlags.map((f) => f.name),
      clinicalFlags: evaluation.clinicalFlags.map((f) => f.name),
      isVerified: actionableFlags.length === 0,
      notes: params.notes,
    };

    this.measurements.unshift(newMeasurement);

    // Update Beneficiary Record
    ben.lastMeasurementDate = measurementDate;
    ben.lastWeight = params.weightKg;
    ben.lastHeight = params.heightCm;
    ben.hasActiveFlag = actionableFlags.length > 0;

    let caseCreatedId: string | undefined;

    // If anomalous or clinical flags present, generate or update Action Queue Case
    if (actionableFlags.length > 0) {
      const actionId = `ACT-${2100 + this.cases.length}`;
      const primaryFlag = evaluation.flags[0];
      const isUrgent = evaluation.primaryPriority === 'Urgent';

      const newCase: BeneficiaryCase = {
        id: ben.id,
        actionId,
        ageMonths: age.completedMonths,
        gender: ben.gender,
        caregiverKinship: ben.caregiverKinship,
        centreCode: ben.centreCode,
        assignedAww: ben.assignedAww,
        category: primaryFlag.type === 'clinical' ? 'sam' : isUrgent ? 'urgent' : 'drift',
        categoryLabel: primaryFlag.type === 'clinical' ? 'SAM / MAM Flag' : isUrgent ? 'Urgent Anomaly' : 'Measurement Drift',
        concernSummary: `${primaryFlag.name} • ${primaryFlag.summary}`,
        ruleCode: primaryFlag.code,
        ruleName: primaryFlag.name,
        triggerDetail: primaryFlag.triggerDetail,
        prevWeight: previous?.weightKg ?? 0,
        prevHeight: previous?.heightCm ?? 0,
        prevDate: previous?.date ?? '',
        flaggedWeight: params.weightKg,
        flaggedHeight: params.heightCm,
        flaggedDate: measurementDate,
        weightDelta: primaryFlag.code === 'RUL-02'
          ? `${evaluation.heightDeltaCm > 0 ? '+' : ''}${evaluation.heightDeltaCm.toFixed(1)} cm (Height) in ${evaluation.daysElapsed}d`
          : `${evaluation.weightDeltaKg > 0 ? '+' : ''}${evaluation.weightDeltaKg.toFixed(2)} kg in ${evaluation.daysElapsed}d`,
        priority: evaluation.primaryPriority,
        priorityColor:
          evaluation.primaryPriority === 'Urgent'
            ? 'bg-rose-100 text-rose-800 border-rose-200'
            : 'bg-amber-100 text-amber-800 border-amber-200',
        dueDate: 'Within 24 Hours',
        status: 'Pending Verification',
        isVerified: false,
        tierLevel: 1,
        assignedRole: 'Frontline AWW',
        assignedActor: ben.assignedAww,
        escalationHistory: [
          {
            timestamp: new Date().toISOString(),
            fromTier: 1,
            toTier: 1,
            fromActor: 'Rule Engine',
            toActor: ben.assignedAww,
            reason: `Heuristic flag triggered: ${primaryFlag.name}`,
          },
        ],
      };

      this.cases.unshift(newCase);
      caseCreatedId = actionId;

      // Add to audit trail
      this.auditLog.unshift({
        id: `LED-${String(8922 + this.auditLog.length)}`,
        timestamp: new Date().toISOString(),
        actionId,
        palId: ben.id,
        actor,
        actionType: 'Anomaly Flag Triggered',
        deltaSummary: `Screening generated ${primaryFlag.name}: ${primaryFlag.summary}`,
        proofHash: generateDeterministicProofHash(this.auditLog.length + 1, 1024),
        status: 'Logged',
      });
    }

    this.notify();
    return {
      success: true,
      measurementId,
      flags: evaluation.flags.map((f) => f.name),
      caseCreated: caseCreatedId,
    };
  }

  // =========================================================================
  // ACTION CASES & MULTI-TIER ESCALATION WITH ROLE SCOPING
  // =========================================================================
  public getCases(scope?: DemoScope): BeneficiaryCase[] {
    if (scope?.role === 'Parent/Family') return [];
    const centres = centresForDemoScope(scope);
    const scopedCases = centres
      ? this.cases.filter((item) => centres.includes(item.centreCode || this.getBeneficiaryById(item.id)?.centreCode || ''))
      : [...this.cases];
    if (scope?.role === 'AWW') return scope.actorId ? scopedCases.filter((item) => item.assignedAww === scope.actorId) : [];
    return scopedCases;
  }

  public getCaseById(id: string, scope?: DemoScope): BeneficiaryCase | undefined {
    const caseItem = this.cases.find((c) => c.id === id || c.actionId === id);
    if (!caseItem || (scope && !scopeAllowsCentre(scope, caseItem.centreCode))
      || (scope?.role === 'AWW' && (!scope.actorId || caseItem.assignedAww !== scope.actorId))) return undefined;
    return caseItem;
  }

  public acknowledgeCase(actionId: string, actorContext?: string | DemoScope): boolean {
    const role = typeof actorContext === 'object' ? actorContext?.role : undefined;
    if (!role || !canPerformAction(role, 'acknowledge_case')) return false;
    const idx = this.cases.findIndex((c) => c.actionId === actionId || c.id === actionId);
    if (idx === -1) return false;
    const targetCase = this.cases[idx];
    if (!scopeAllowsCentre(typeof actorContext === 'object' ? actorContext : undefined, targetCase.centreCode || this.getBeneficiaryById(targetCase.id)?.centreCode)) return false;
    if (role === 'AWW' && (typeof actorContext !== 'object' || !actorContext.actorId || targetCase.assignedAww !== actorContext.actorId)) return false;

    const actor = typeof actorContext === 'string' ? actorContext : actorContext?.actorId || 'AWW-409';

    this.cases[idx].status = 'Under Review';
    this.cases[idx].acknowledgedAt = new Date().toISOString();
    this.cases[idx].acknowledgedBy = actor;

    this.auditLog.unshift({
      id: `LED-${String(8922 + this.auditLog.length)}`,
      timestamp: new Date().toISOString(),
      actionId,
      palId: this.cases[idx].id,
      actor,
      actionType: 'Case Acknowledgement',
      deltaSummary: `Frontline worker acknowledged case and scheduled physical review visit.`,
      proofHash: generateDeterministicProofHash(this.auditLog.length + 1, 7129),
      status: 'Logged',
    });

    this.notify();
    return true;
  }

  public assignCase(
    actionId: string,
    assignedActor: string,
    dueDate: string,
    actorContext?: DemoScope
  ): { success: boolean; error?: string } {
    if (!actorContext?.role || !canPerformAction(actorContext.role, 'assign_owner')) {
      return { success: false, error: `Role ${actorContext?.role || 'unknown'} cannot assign owners. Restricted to Supervisor and CDPO.` };
    }

    const idx = this.cases.findIndex((c) => c.actionId === actionId || c.id === actionId);
    if (idx === -1) return { success: false, error: 'Case not found.' };

    const target = this.cases[idx];
    if (!scopeAllowsCentre(actorContext, target.centreCode || this.getBeneficiaryById(target.id)?.centreCode)) {
      return { success: false, error: 'Case is outside the assigned demo organization scope.' };
    }
    target.assignedActor = assignedActor;
    target.dueDate = dueDate;

    const actor = actorContext?.actorId || 'Sector Supervisor (LS-01)';

    this.auditLog.unshift({
      id: `LED-${String(8922 + this.auditLog.length)}`,
      timestamp: new Date().toISOString(),
      actionId,
      palId: target.id,
      actor,
      actionType: 'Case Owner Reassigned',
      deltaSummary: `Assigned to ${assignedActor}. Target due date set to ${dueDate}.`,
      proofHash: generateDeterministicProofHash(this.auditLog.length + 1, 6311),
      status: 'Logged',
    });

    this.notify();
    return { success: true };
  }

  public escalateCase(
    actionId: string,
    targetTier: 1 | 2 | 3 | 4,
    reason: string,
    actorContext?: string | DemoScope
  ): boolean {
    const role = typeof actorContext === 'object' ? actorContext?.role : undefined;
    if (!role || !canPerformAction(role, 'escalate')) return false;
    const idx = this.cases.findIndex((c) => c.actionId === actionId || c.id === actionId);
    if (idx === -1) return false;

    const targetCase = this.cases[idx];
    if (!scopeAllowsCentre(typeof actorContext === 'object' ? actorContext : undefined, targetCase.centreCode || this.getBeneficiaryById(targetCase.id)?.centreCode)) return false;
    const tierInfo = ESCALATION_TIERS[targetTier];
    if (!tierInfo) return false;

    const actor = typeof actorContext === 'string' ? actorContext : actorContext?.actorId || 'Sector Supervisor (LS-01)';

    const fromTier = targetCase.tierLevel;
    targetCase.tierLevel = targetTier;
    targetCase.assignedRole = tierInfo.roleName;
    targetCase.assignedActor = tierInfo.actorName;
    targetCase.status = 'Under Review';

    if (targetTier >= 3) {
      targetCase.priority = 'Urgent';
      targetCase.priorityColor = 'bg-rose-100 text-rose-800 border-rose-200';
    }

    targetCase.escalationHistory.unshift({
      timestamp: new Date().toISOString(),
      fromTier,
      toTier: targetTier,
      fromActor: actor,
      toActor: tierInfo.actorName,
      reason: reason.trim() || 'Escalated following supervisory protocol triage.',
    });

    this.auditLog.unshift({
      id: `LED-${String(8922 + this.auditLog.length)}`,
      timestamp: new Date().toISOString(),
      actionId,
      palId: targetCase.id,
      actor,
      actionType: `Escalated to Tier ${targetTier}`,
      deltaSummary: `Transferred to ${tierInfo.roleName} (${tierInfo.actorName}). Reason: ${reason}`,
      proofHash: generateDeterministicProofHash(this.auditLog.length + 1, 9157),
      status: 'Escalated',
    });

    this.notify();
    return true;
  }

  public verifyCase(
    actionId: string,
    verifiedWeight: number,
    verifiedHeight: number,
    notes: string,
    actorContext?: string | DemoScope
  ): boolean {
    if (!Number.isFinite(verifiedWeight) || verifiedWeight <= 0 || !Number.isFinite(verifiedHeight) || verifiedHeight <= 0) {
      return false;
    }
    const caseIndex = this.cases.findIndex((c) => c.actionId === actionId || c.id === actionId);
    if (caseIndex === -1) return false;

    const role = typeof actorContext === 'object' ? actorContext?.role : undefined;
    if (!role || !canPerformAction(role, 're_measure')) {
      return false;
    }

    const actor = typeof actorContext === 'string' ? actorContext : actorContext?.actorId || 'AWW-409';

    const target = this.cases[caseIndex];
    if (!scopeAllowsCentre(typeof actorContext === 'object' ? actorContext : undefined, target.centreCode || this.getBeneficiaryById(target.id)?.centreCode)) return false;
    const hashPart1 = ((actionId.length * 3721 + Math.round(verifiedWeight * 100)) % 65536).toString(16).padStart(4, '0');
    const hashPart2 = ((Math.round(verifiedHeight * 10) + 1234) % 65536).toString(16).padStart(4, '0');
    const verificationHash = `0x${hashPart1}...${hashPart2}`;

    const updated: BeneficiaryCase = {
      ...target,
      isVerified: true,
      status: 'Resolved',
      priority: 'Resolved',
      priorityColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      verifiedWeight,
      verifiedHeight,
      verifiedNotes: notes,
      verificationHash,
    };

    this.cases[caseIndex] = updated;

    // Update child profile last known weight if verified
    const ben = this.getBeneficiaryById(target.id);
    if (ben) {
      ben.lastWeight = verifiedWeight;
      ben.lastHeight = verifiedHeight;
      ben.hasActiveFlag = false;
    }

    const newAudit: AuditLedgerEntry = {
      id: `LED-${String(8922 + this.auditLog.length)}`,
      timestamp: new Date().toISOString(),
      actionId: target.actionId,
      palId: target.id,
      actor,
      actionType: 'Supervisory Physical Re-weigh',
      deltaSummary: `Physical spot-check: ${verifiedWeight.toFixed(2)} kg / ${verifiedHeight.toFixed(1)} cm verified`,
      proofHash: verificationHash,
      status: 'Verified',
    };

    this.auditLog.unshift(newAudit);
    this.notify();
    return true;
  }

  // =========================================================================
  // REFERRALS & FOLLOW-UP WORKFLOW WITH ROLE SCOPING
  // =========================================================================
  public getReferrals(scope?: DemoScope): ReferralRecord[] {
    if (scope?.role === 'Parent/Family') {
      const allowedIds = scope.linkedBeneficiaryIds || [];
      return this.referrals.filter((referral) => allowedIds.includes(referral.beneficiaryId));
    }
    const centres = centresForDemoScope(scope);
    if (centres) return this.referrals.filter((referral) => centres.includes(this.getBeneficiaryById(referral.beneficiaryId)?.centreCode || ''));
    return [...this.referrals];
  }

  public getReferralById(id: string, scope?: DemoScope): ReferralRecord | undefined {
    const referral = this.referrals.find((r) => r.id === id);
    if (!referral) return undefined;
    if (scope?.role === 'Parent/Family') {
      const allowedIds = scope.linkedBeneficiaryIds || [];
      return allowedIds.includes(referral.beneficiaryId) ? referral : undefined;
    }
    return referral;
  }

  public createReferral(
    data: {
      beneficiaryId: string;
      reason: string;
      destination: ReferralRecord['destination'];
      dueDate: string;
      priority?: 'Urgent' | 'High' | 'Routine';
      owner?: string;
    },
    actorContext?: DemoScope
  ): { success: boolean; referralId?: string; error?: string } {
    if (!actorContext?.role || !canPerformAction(actorContext.role, 'create_referral')) {
      return { success: false, error: `Role ${actorContext?.role || 'unknown'} cannot initiate clinical referrals.` };
    }
    if (actorContext.role === 'AWW' && !actorContext.actorId) {
      return { success: false, error: 'AWW referral creation requires an authenticated worker identity.' };
    }

    const ben = this.getBeneficiaryById(data.beneficiaryId);
    if (!ben) return { success: false, error: 'Beneficiary not found.' };
    if (!scopeAllowsCentre(actorContext, ben.centreCode)) {
      return { success: false, error: 'Referral target is outside the assigned demo organization scope.' };
    }
    if (!data.reason.trim() || !data.dueDate.trim()) {
      return { success: false, error: 'A referral reason and due date are required.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)
      || Number.isNaN(Date.parse(`${data.dueDate}T00:00:00Z`))
      || new Date(`${data.dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== data.dueDate
      || data.dueDate < getTodayISODate()) {
      return { success: false, error: 'Enter a valid referral due date that is today or later.' };
    }
    if (actorContext.role === 'AWW' && ben.centreCode !== (actorContext.centreCode || 'AWC-702')) {
      return { success: false, error: 'AWW referral creation is limited to the worker\'s centre.' };
    }
    if (actorContext.role === 'AWW' && data.owner && actorContext.actorId && data.owner !== actorContext.actorId) {
      return { success: false, error: 'AWW referrals must remain assigned to the creating worker.' };
    }

    let nextReferralNumber = 504 + this.referrals.length;
    while (this.referrals.some((referral) => referral.id === `REF-${nextReferralNumber}`)) nextReferralNumber++;
    const refId = `REF-${nextReferralNumber}`;
    const age = calculateAge(ben.dob, getTodayISODate());
    const owner = actorContext.role === 'AWW'
      ? actorContext.actorId || ben.assignedAww || 'AWW-409'
      : data.owner || actorContext.actorId || ben.assignedAww || 'AWW-409';

    const newReferral: ReferralRecord = {
      id: refId,
      beneficiaryId: ben.id,
      ageDisplay: age.ageDisplay,
      reason: data.reason.trim(),
      destination: data.destination,
      referralDate: getTodayISODate(),
      owner,
      dueDate: data.dueDate,
      status: 'Pending',
      priority: data.priority || 'Urgent',
      followUpAttempts: [],
    };

    this.referrals.unshift(newReferral);
    ben.status = 'Referred';

    this.auditLog.unshift({
      id: `LED-${String(8922 + this.auditLog.length)}`,
      timestamp: new Date().toISOString(),
      actionId: refId,
      palId: ben.id,
      actor: owner,
      actionType: 'Clinical Referral Dispatched',
      deltaSummary: `Referred to ${data.destination}. Reason: ${data.reason}`,
      proofHash: generateDeterministicProofHash(this.auditLog.length + 1, 2381),
      status: 'Escalated',
    });

    this.notify();
    return { success: true, referralId: refId };
  }

  public addFollowUpAttempt(
    refId: string,
    attempt: {
      method: 'Home Visit' | 'Phone Call' | 'AWC Consultation';
      findings: string;
      actor?: string;
    },
    actorContext?: DemoScope
  ): boolean {
    if (!actorContext?.role || !canPerformAction(actorContext.role, 'log_follow_up')) return false;
    if (actorContext.role === 'AWW' && !actorContext.actorId) return false;
    if (!attempt.findings.trim() || !['Home Visit', 'Phone Call', 'AWC Consultation'].includes(attempt.method)) return false;
    const rIdx = this.referrals.findIndex((r) => r.id === refId);
    if (rIdx === -1) return false;

    const target = this.referrals[rIdx];
    const beneficiary = this.getBeneficiaryById(target.beneficiaryId);
    if (!scopeAllowsCentre(actorContext, beneficiary?.centreCode)) return false;
    const actor = actorContext.actorId || attempt.actor || 'AWW-409';
    const newAttempt: ReferralFollowUp = {
      id: `FU-${target.followUpAttempts.length + 1}`,
      date: getTodayISODate(),
      actor,
      method: attempt.method,
      findings: attempt.findings.trim(),
    };

    target.followUpAttempts.unshift(newAttempt);
    if (target.status === 'Pending') {
      target.status = 'Follow-up In Progress';
    }

    this.auditLog.unshift({
      id: `LED-${String(8922 + this.auditLog.length)}`,
      timestamp: new Date().toISOString(),
      actionId: refId,
      palId: target.beneficiaryId,
      actor,
      actionType: 'Referral Follow-up Logged',
      deltaSummary: `${attempt.method}: ${attempt.findings}`,
      proofHash: generateDeterministicProofHash(this.auditLog.length + 1, 4423),
      status: 'Logged',
    });

    this.notify();
    return true;
  }

  public resolveReferral(
    refId: string,
    outcome: string,
    nextSteps: string,
    actorContext?: string | (DemoScope & { outcomeConfirmed?: boolean })
  ): { success: boolean; error?: string } {
    const role = typeof actorContext === 'object' ? actorContext?.role : undefined;
    if (!role || !canPerformAction(role, 'resolve_referral')) {
      return { success: false, error: `Role ${role} cannot close referrals. Restricted to Supervisor and CDPO.` };
    }
    if (!outcome.trim()) {
      return { success: false, error: 'Select a clinical outcome before closing the referral.' };
    }
    if (!actorContext || typeof actorContext !== 'object' || actorContext.outcomeConfirmed !== true) {
      return { success: false, error: 'Confirm that the selected clinical outcome is supported by a verified record.' };
    }
    if (nextSteps.trim().length < 10) {
      return { success: false, error: 'Enter meaningful next steps (at least 10 characters) before closing the referral.' };
    }

    const rIdx = this.referrals.findIndex((r) => r.id === refId);
    if (rIdx === -1) return { success: false, error: 'Referral not found.' };

    const target = this.referrals[rIdx];
    if (!scopeAllowsCentre(typeof actorContext === 'object' ? actorContext : undefined, this.getBeneficiaryById(target.beneficiaryId)?.centreCode)) {
      return { success: false, error: 'Referral is outside the assigned demo organization scope.' };
    }

    if (this.referrals[rIdx].status === 'Completed') {
      return { success: false, error: 'Referral is already completed.' };
    }

    const actor = typeof actorContext === 'string' ? actorContext : actorContext?.actorId || 'Sector Supervisor (LS-01)';

    target.status = 'Completed';
    target.finalOutcome = outcome.trim();
    target.outcomeConfirmed = true;
    target.outcomeDate = getTodayISODate();
    target.nextSteps = nextSteps.trim();

    const ben = this.getBeneficiaryById(target.beneficiaryId);
    if (ben) {
      ben.status = 'Active';
    }

    this.auditLog.unshift({
      id: `LED-${String(8922 + this.auditLog.length)}`,
      timestamp: new Date().toISOString(),
      actionId: refId,
      palId: target.beneficiaryId,
      actor,
      actionType: 'Referral Case Resolved',
      deltaSummary: `Closed with outcome: ${outcome}. Next: ${nextSteps}`,
      proofHash: generateDeterministicProofHash(this.auditLog.length + 1, 5521),
      status: 'Verified',
    });

    this.notify();
    return { success: true };
  }

  // =========================================================================
  // RULE DEFINITIONS & SETTINGS WITH ROLE RESTRICTION
  // =========================================================================
  public getRules(): RuleDefinition[] {
    return [...this.rules];
  }

  public toggleRule(ruleId: string, actorContext?: { actorId?: string; role?: UserRole | null }): { success: boolean; error?: string } {
    if (!actorContext?.role || !canPerformAction(actorContext.role, 'edit_rules')) {
      return { success: false, error: 'Only CDPO role can modify demo rule settings.' };
    }

    const rIndex = this.rules.findIndex((r) => r.id === ruleId);
    if (rIndex === -1) return { success: false, error: 'Rule not found' };

    this.rules[rIndex].isActive = !this.rules[rIndex].isActive;
    this.notify();
    return { success: true };
  }

  public updateRuleThreshold(
    ruleId: string,
    newThreshold: number,
    actorContext?: { actorId?: string; role?: UserRole | null }
  ): { success: boolean; error?: string } {
    if (!actorContext?.role || !canPerformAction(actorContext.role, 'edit_rules')) {
      return { success: false, error: 'Only CDPO role can modify demo rule settings.' };
    }

    const rIndex = this.rules.findIndex((r) => r.id === ruleId);
    if (rIndex === -1) return { success: false, error: 'Rule not found' };

    this.rules[rIndex].thresholdValue = newThreshold;
    this.rules[rIndex].condition = `${this.rules[rIndex].name} threshold set to ${newThreshold.toFixed(1)} (Illustrative demo rule • Demo simulation)`;
    this.notify();
    return { success: true };
  }

  public createRule(
    rule: Omit<RuleDefinition, 'id' | 'triggers30d' | 'isIllustrative'> & { triggers30d?: number; isIllustrative?: boolean },
    actorContext?: { actorId?: string; role?: UserRole | null }
  ): string {
    if (!actorContext?.role || !canPerformAction(actorContext.role, 'edit_rules')) {
      return '';
    }
    const id = `RUL-${String(this.rules.length + 1).padStart(2, '0')}`;
    const newRule: RuleDefinition = {
      id,
      name: rule.name,
      category: rule.category,
      targetGroup: rule.targetGroup,
      condition: rule.condition,
      actionGenerated: rule.actionGenerated,
      severity: rule.severity,
      thresholdValue: rule.thresholdValue,
      isActive: rule.isActive ?? true,
      triggers30d: rule.triggers30d ?? 0,
      isIllustrative: rule.isIllustrative ?? true,
    };
    this.rules.push(newRule);
    this.notify();
    return id;
  }

  public getAuditLog(scope?: DemoScope): AuditLedgerEntry[] {
    if (scope?.role === 'AWW' || scope?.role === 'DPO' || scope?.role === 'User' || scope?.role === 'System Administrator' || scope?.role === 'Rule Administrator' || scope?.role === 'Parent/Family') return [];
    const centres = centresForDemoScope(scope);
    if (centres) return this.auditLog.filter((entry) => {
      const caseItem = this.cases.find((item) => item.actionId === entry.actionId || item.id === entry.palId);
      const beneficiary = this.getBeneficiaryById(entry.palId);
      return centres.includes(caseItem?.centreCode || beneficiary?.centreCode || '');
    });
    return [...this.auditLog];
  }


  // =========================================================================
  // AI DECISIONS & AUDIT OPERATIONS
  // =========================================================================
  public getAIDecisions(scope?: DemoScope): AIDecisionRecord[] {
    if (scope?.role === 'Parent/Family') return [];
    const centres = centresForDemoScope(scope);
    if (!centres) return [...this.aiDecisions];
    return this.aiDecisions.filter((dec) => centres.includes(dec.centreCode));
  }

  public recordAIDecision(
    payload: {
      beneficiaryId: string;
      caseActionId: string;
      suggestionId: string;
      decision: 'accept' | 'reject' | 'modify';
      actionCode: string;
      actionNotes?: string;
      rejectionReason?: string;
      centreCode?: string;
    },
    actorContext?: DemoScope
  ): { success: boolean; id?: string; error?: string } {
    const role = actorContext?.role || 'AWW';
    const actorId = actorContext?.actorId || 'AWW-409';

    if (role === 'DPO') {
      return { success: false, error: 'DPO persona is view-only and cannot record casework decisions.' };
    }

    if (!['accept', 'reject', 'modify'].includes(payload.decision)) {
      return { success: false, error: 'Decision must be one of: accept, reject, modify.' };
    }

    if (payload.decision === 'reject' && !payload.rejectionReason?.trim()) {
      return { success: false, error: 'A justification reason is required when rejecting a suggestion.' };
    }

    if (payload.decision === 'modify' && !payload.actionNotes?.trim()) {
      return { success: false, error: 'Modified action notes are required when choosing modify.' };
    }

    // Role-based authority checks
    if (payload.actionCode === 'supervisor_verification' && role === 'AWW') {
      return { success: false, error: 'Lady Supervisor (LS) or CDPO role is required to authorize supervisory verifications.' };
    }

    const effectiveCentre = payload.centreCode || actorContext?.centreCode || 'AWC-702';
    const allowedCentres = centresForDemoScope(actorContext);
    if (allowedCentres && !allowedCentres.includes(effectiveCentre)) {
      return { success: false, error: 'Cannot record decision outside assigned administrative centre jurisdiction.' };
    }

    const decisionId = `DEC-${2000 + this.aiDecisions.length + 1}`;
    const newDecision: AIDecisionRecord = {
      id: decisionId,
      beneficiaryId: payload.beneficiaryId,
      caseActionId: payload.caseActionId,
      suggestionId: payload.suggestionId,
      decision: payload.decision,
      actionCode: payload.actionCode,
      actionNotes: payload.actionNotes?.trim(),
      rejectionReason: payload.rejectionReason?.trim(),
      actorId,
      actorRole: role,
      centreCode: effectiveCentre,
      timestamp: getTodayISODate(),
    };

    this.aiDecisions.push(newDecision);

    // Append to audit log
    this.auditLog.push({
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: getTodayISODate(),
      actionId: payload.caseActionId,
      palId: payload.beneficiaryId,
      actor: actorId,
      actionType: `AI Decision: ${payload.decision.toUpperCase()}`,
      deltaSummary: `${payload.actionCode}: ${payload.decision === 'reject' ? payload.rejectionReason : payload.actionNotes || 'Accepted recommendation'}`,
      proofHash: `SHA-DEC-${payload.caseActionId.slice(4)}`,
      status: 'Logged',
    });

    // If accepted, update matching case notes / acknowledgment
    const targetCase = this.cases.find((c) => c.actionId === payload.caseActionId);
    if (targetCase && payload.decision === 'accept') {
      if (!targetCase.acknowledgedAt) {
        targetCase.acknowledgedAt = getTodayISODate();
      }
    }

    this.saveState();
    this.notify();
    return { success: true, id: decisionId };
  }

  // =========================================================================
  // DYNAMIC POPULATION & REPORTING METRICS WITH SCOPE
  // =========================================================================
  public getMetrics(scope?: DemoScope) {
    const districtAggregate = !scope?.role || scope.role === 'User' || scope.role === 'DPO';
    const bens = districtAggregate ? [...this.beneficiaries] : this.getBeneficiaries(scope);
    const cases = districtAggregate ? [...this.cases] : this.getCases(scope);
    const referrals = districtAggregate ? [...this.referrals] : this.getReferrals(scope);
    const measurements = districtAggregate ? this.getMeasurements() : this.getMeasurements(undefined, scope);
    const tasks = districtAggregate ? this.getTasks() : this.getTasks(scope);
    const homeVisits = districtAggregate ? this.getHomeVisits() : this.getHomeVisits(scope);
    const serviceRecords = districtAggregate ? this.getServiceRecords() : this.getServiceRecords(scope);
    const maternalProfiles = districtAggregate ? this.getMaternalProfiles() : this.getMaternalProfiles(scope);

    const total = bens.length;

    let pregnantWomen = 0;
    let lactatingMothers = 0;
    let children0to6m = 0;
    let children6mTo3y = 0;
    let children3to6y = 0;
    let adolescentGirls = 0;
    let staleCount = 0;
    let pendingMeasurements = 0;

    bens.forEach((b) => {
      const age = calculateAge(b.dob, DEMO_CURRENT_DATE, b.category, b.gender);
      if (b.category === 'pregnant') pregnantWomen++;
      else if (b.category === 'lactating') lactatingMothers++;
      else if (age.cohort === 'adolescentGirls') adolescentGirls++;
      else if (age.cohort === 'children0to6m') children0to6m++;
      else if (age.cohort === 'children6mTo3y') children6mTo3y++;
      else children3to6y++;

      if (b.category === 'child_under_6') {
        const daysSinceMeasurement = b.lastMeasurementDate
          ? getDaysUntilDate(b.lastMeasurementDate, getTodayISODate())
          : undefined;
        if (daysSinceMeasurement === undefined || daysSinceMeasurement > 35 || daysSinceMeasurement < 0) {
          staleCount++;
          pendingMeasurements++;
        }
      }
    });

    const totalChildren = children0to6m + children6mTo3y + children3to6y;
    const totalMothers = pregnantWomen + lactatingMothers;

    const urgentCases = cases.filter((c) => c.priority === 'Urgent' && !c.isVerified).length;
    const attentionCases = cases.filter((c) => c.priority === 'Needs Attention' && !c.isVerified).length;
    const pendingCases = cases.filter((c) => !c.isVerified).length;
    const resolvedCases = cases.filter((c) => c.isVerified).length;

    const openReferrals = referrals.filter((r) => r.status !== 'Completed').length;
    const completedReferrals = referrals.filter((r) => r.status === 'Completed').length;

    return {
      total,
      pregnantWomen,
      lactatingMothers,
      children0to6m,
      children6mTo3y,
      children3to6y,
      adolescentGirls,
      totalChildren,
      totalMothers,
      staleCount,
      pendingMeasurements,
      urgentCases,
      attentionCases,
      pendingCases,
      resolvedCases,
      openReferrals,
      upcomingFollowUps: referrals.filter((referral) => referral.status !== 'Completed'
        && (getDaysUntilDate(referral.dueDate) ?? -1) >= 0
        && (getDaysUntilDate(referral.dueDate) ?? 99) <= 7).length,
      overdueFollowUps: referrals.filter((referral) => referral.status !== 'Completed'
        && (getDaysUntilDate(referral.dueDate) ?? 0) < 0).length,
      completedReferrals,
      measurementCount: measurements.length,
      verifiedMeasurementCount: measurements.filter((measurement) => measurement.isVerified).length,
      taskCount: tasks.length,
      openTasks: tasks.filter((task) => task.status !== 'closed').length,
      overdueTasks: tasks.filter((task) => task.status !== 'closed' && (getDaysUntilDate(task.dueDate) ?? 1) < 0).length,
      assignedTasks: tasks.filter((task) => task.status === 'assigned').length,
      inProgressTasks: tasks.filter((task) => task.status === 'acknowledged' || task.status === 'in_progress').length,
      closedTasks: tasks.filter((task) => task.status === 'closed').length,
      homeVisitCount: homeVisits.length,
      scheduledHomeVisits: homeVisits.filter((visit) => visit.status === 'scheduled').length,
      serviceRecordCount: serviceRecords.length,
      maternalProfileCount: maternalProfiles.length,
      centreCount: districtAggregate ? CANONICAL_CENTRES.length : this.getCentres(scope).length,
      subtext: `${totalChildren} children (0–6 years) • ${adolescentGirls} adolescent girls • ${pregnantWomen} pregnant women • ${lactatingMothers} lactating mothers`,
    };
  }

  public getCohortSummaries(scope?: DemoScope) {
    const districtAggregate = !scope?.role || scope.role === 'User' || scope.role === 'DPO';
    const beneficiaries = districtAggregate ? [...this.beneficiaries] : this.getBeneficiaries(scope);
    const beneficiaryIds = new Set(beneficiaries.map((beneficiary) => beneficiary.id));
    const cases = (districtAggregate ? this.cases : this.getCases(scope))
      .filter((caseItem) => beneficiaryIds.has(caseItem.id));
    const referrals = (districtAggregate ? this.referrals : this.getReferrals(scope))
      .filter((referral) => beneficiaryIds.has(referral.beneficiaryId));
    const measurements = (districtAggregate ? this.getMeasurements() : this.getMeasurements(undefined, scope))
      .filter((measurement) => beneficiaryIds.has(measurement.beneficiaryId));
    const cohorts = [
      'children0to6m',
      'children6mTo3y',
      'children3to6y',
      'adolescentGirls',
      'pregnant',
      'lactating',
    ] as const;

    return cohorts.map((id) => {
      const members = beneficiaries.filter((beneficiary) => {
        if (id === 'pregnant' || id === 'lactating') return beneficiary.category === id;
        return calculateAge(beneficiary.dob, DEMO_CURRENT_DATE, beneficiary.category, beneficiary.gender).cohort === id;
      });
      const memberIds = new Set(members.map((beneficiary) => beneficiary.id));
      const cohortCases = cases.filter((caseItem) => memberIds.has(caseItem.id));
      const cohortReferrals = referrals.filter((referral) => memberIds.has(referral.beneficiaryId));
      return {
        id,
        count: members.length,
        females: members.filter((beneficiary) => beneficiary.gender === 'Female').length,
        males: members.filter((beneficiary) => beneficiary.gender === 'Male').length,
        active: members.filter((beneficiary) => beneficiary.status === 'Active').length,
        underMonitoring: members.filter((beneficiary) => beneficiary.status === 'Under Monitoring').length,
        referred: members.filter((beneficiary) => beneficiary.status === 'Referred').length,
        stale: members.filter((beneficiary) => beneficiary.lastMeasurementDate
          && (Date.parse(`${DEMO_CURRENT_DATE}T00:00:00Z`) - Date.parse(`${beneficiary.lastMeasurementDate}T00:00:00Z`)) / 86400000 > 35).length,
        caseCount: cohortCases.length,
        openCaseCount: cohortCases.filter((caseItem) => !caseItem.isVerified).length,
        measurementCount: measurements.filter((measurement) => memberIds.has(measurement.beneficiaryId)).length,
        referralCount: cohortReferrals.length,
        openReferralCount: cohortReferrals.filter((referral) => referral.status !== 'Completed').length,
      };
    });
  }
}

export const mockStore = new MockStore();

// Export legacy static POPULATION_METRICS compatibility helper
export const POPULATION_METRICS = {
  get total() {
    return mockStore.getMetrics().total;
  },
  get pregnantWomen() {
    return mockStore.getMetrics().pregnantWomen;
  },
  get lactatingMothers() {
    return mockStore.getMetrics().lactatingMothers;
  },
  get children0to6m() {
    return mockStore.getMetrics().children0to6m;
  },
  get children6mTo3y() {
    return mockStore.getMetrics().children6mTo3y;
  },
  get children3to6y() {
    return mockStore.getMetrics().children3to6y;
  },
  get adolescentGirls() {
    return mockStore.getMetrics().adolescentGirls;
  },
  get totalChildren() {
    return mockStore.getMetrics().totalChildren;
  },
  get totalMothers() {
    return mockStore.getMetrics().totalMothers;
  },
  get subtext() {
    return mockStore.getMetrics().subtext;
  },
};
