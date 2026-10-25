/**
 * Core casework logic, age calculations, plausibility validation, and escalation rules
 * Poshan Action Layer (Academic Research Prototype)
 */

export const DEMO_CURRENT_DATE = '2026-10-24'; // Saturday, 24 Oct 2026

export interface CaseRecord {
  id: string;
  beneficiaryId: string;
  ageMonths: number;
  gender: 'Female' | 'Male';
  flagTitle: string;
  flagDescription: string;
  evidence: string;
  threshold: string;
  suggestedAction: string;
  originalReading: {
    weightKg: number;
    heightCm: number;
    date: string;
    note: string;
  };
  verifiedReading: {
    weightKg: number;
    heightCm: number;
    date: string;
    note: string;
  };
  status: 'awaiting_review' | 'verified_assigned' | 'dismissed' | 'edited';
  assignedTo: string;
  dueDate: string;
}

export const SAMPLE_CASES: CaseRecord[] = [
  {
    id: 'case-1',
    beneficiaryId: 'BEN-0142',
    ageMonths: 14,
    gender: 'Male',
    flagTitle: 'Abrupt Weight Spike (+3.8 kg)',
    flagDescription: 'Recorded +3.8 kg weight gain in 28 days for 14-month-old infant, exceeding the 99th percentile WHO growth velocity threshold.',
    evidence: 'Gain exceeds 1.5 kg/month biological plausibility boundary for age cohort.',
    threshold: '> 1.5 kg / month (WHO velocity limit)',
    suggestedAction: 'Verify measurement with physical re-weighing using calibrated Salter scale or refer to Lady Supervisor.',
    originalReading: {
      weightKg: 14.2,
      heightCm: 76.5,
      date: '18 Oct 2026',
      note: 'Potential keying typo (likely 10.4 kg entered as 14.2 kg during rapid field weighing)',
    },
    verifiedReading: {
      weightKg: 10.4,
      heightCm: 76.5,
      date: '21 Oct 2026',
      note: 'Physical re-weigh confirmed true weight is 10.4 kg. Salter scale tare zeroed.',
    },
    status: 'awaiting_review',
    assignedTo: 'AWW-405',
    dueDate: '24 Oct 2026',
  },
  {
    id: 'case-2',
    beneficiaryId: 'BEN-0891',
    ageMonths: 22,
    gender: 'Female',
    flagTitle: 'Height/Weight Proportion Anomaly',
    flagDescription: 'Recorded height decreased by 2.0 cm compared to previous month, resulting in an artificial severe wasting alert.',
    evidence: 'Negative vertical height progression detected across consecutive monthly visits.',
    threshold: 'Delta < 0.0 cm / month (Stature decrease check)',
    suggestedAction: 'Re-measure standing height with infantometer/stadiometer with footwear removed.',
    originalReading: {
      weightKg: 9.8,
      heightCm: 78.0,
      date: '15 Oct 2026',
      note: 'Previous month was 80.0 cm; logged as 78.0 cm due to infant posture deflection',
    },
    verifiedReading: {
      weightKg: 9.9,
      heightCm: 80.5,
      date: '19 Oct 2026',
      note: 'Verified with stadiometer board: 80.5 cm. Child standing upright with heels aligned.',
    },
    status: 'awaiting_review',
    assignedTo: 'AWW-412',
    dueDate: '25 Oct 2026',
  },
  {
    id: 'case-3',
    beneficiaryId: 'BEN-0334',
    ageMonths: 9,
    gender: 'Male',
    flagTitle: 'Rapid Growth Faltering Flag',
    flagDescription: 'Weight flatlined for 3 consecutive months despite supplementary nutrition ration distribution.',
    evidence: 'Z-score trajectory shifted from -1 SD to -2.8 SD (approaching Severe Acute Malnutrition).',
    threshold: 'Weight stagnation > 60 days in infant < 12m',
    suggestedAction: 'Immediate Lady Supervisor clinical check and nutrition rehabilitation center (NRC) consultation.',
    originalReading: {
      weightKg: 6.8,
      heightCm: 68.2,
      date: '12 Oct 2026',
      note: 'Unchanged weight from August visit; caregiver reported recurring diarrheal episodes',
    },
    verifiedReading: {
      weightKg: 6.9,
      heightCm: 68.5,
      date: '17 Oct 2026',
      note: 'Clinical referral issued to Primary Health Centre (PHC) medical officer for therapeutic care.',
    },
    status: 'awaiting_review',
    assignedTo: 'LS-01',
    dueDate: '22 Oct 2026',
  },
];

/**
 * Format weight delta
 */
export function calculateWeightDifference(original: number, verified: number): {
  delta: number;
  formatted: string;
  isCorrection: boolean;
} {
  const diff = Number((verified - original).toFixed(2));
  return {
    delta: diff,
    formatted: diff > 0 ? `+${diff} kg` : `${diff} kg`,
    isCorrection: Math.abs(diff) > 0.05,
  };
}

/**
 * Plausibility check for growth velocity (legacy compatibility)
 */
export function evaluateGrowthPlausibility(
  prevWeight: number,
  currentWeight: number,
  daysElapsed: number
): { isPlausible: boolean; velocityPerMonth: number; reason?: string } {
  if (daysElapsed <= 0) {
    return { isPlausible: true, velocityPerMonth: 0 };
  }
  const monthlyFactor = 30 / daysElapsed;
  const velocityPerMonth = (currentWeight - prevWeight) * monthlyFactor;

  if (velocityPerMonth > 2.0) {
    return {
      isPlausible: false,
      velocityPerMonth: Number(velocityPerMonth.toFixed(2)),
      reason: 'Weight gain exceeds maximum normal biological rate (>2.0 kg/30 days)',
    };
  }

  if (velocityPerMonth < -1.5) {
    return {
      isPlausible: false,
      velocityPerMonth: Number(velocityPerMonth.toFixed(2)),
      reason: 'Weight loss exceeds emergency clinical threshold (<-1.5 kg/30 days)',
    };
  }

  return {
    isPlausible: true,
    velocityPerMonth: Number(velocityPerMonth.toFixed(2)),
  };
}

/**
 * Case state transition
 */
export function updateCaseStatus(
  cases: CaseRecord[],
  caseId: string,
  newStatus: CaseRecord['status']
): CaseRecord[] {
  return cases.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c));
}

// =========================================================================
// AGE CALCULATION & COHORT LOGIC
// =========================================================================

export type DemographicCohort =
  | 'children0to6m'
  | 'children6mTo3y'
  | 'children3to6y'
  | 'pregnantWomen'
  | 'lactatingMothers'
  | 'adolescentGirls';

export interface AgeCalculationResult {
  completedMonths: number;
  completedYears: number;
  remainingMonths: number;
  ageDisplay: string;
  cohort: DemographicCohort;
  cohortLabel: string;
  recommendedMeasurementPosture: 'recumbent' | 'standing';
}

/**
 * Parse standard ISO YYYY-MM-DD date safely
 */
function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  // Handle YYYY-MM-DD
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10) - 1,
      day: parseInt(isoMatch[3], 10),
    };
  }
  // Handle DD Mon YYYY e.g. "24 Oct 2026"
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth(),
      day: parsed.getDate(),
    };
  }
  return null;
}

/** Validate the measurement inputs before any plausibility rules run. */
export function validateMeasurementInput(
  weight: number,
  height: number,
  measurementDate: unknown
): string | null {
  if (!Number.isFinite(weight)) return 'Weight must be a finite number.';
  if (!Number.isFinite(height)) return 'Height must be a finite number.';
  if (typeof measurementDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(measurementDate)) {
    return 'Measurement date must be provided in YYYY-MM-DD format.';
  }

  const parsedDate = new Date(`${measurementDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== measurementDate) {
    return 'Measurement date must be a valid calendar date.';
  }
  if (measurementDate > DEMO_CURRENT_DATE) {
    return `Measurement date cannot be after ${DEMO_CURRENT_DATE}.`;
  }

  return null;
}

/**
 * Compute completed months and years from Date of Birth to Reference Date
 */
export function calculateAge(
  dobStr: string,
  refDateStr: string = DEMO_CURRENT_DATE,
  categoryHint?: string
): AgeCalculationResult {
  const dobParts = parseDateParts(dobStr);
  const refParts = parseDateParts(refDateStr);

  if (!dobParts || !refParts) {
    return {
      completedMonths: 12,
      completedYears: 1,
      remainingMonths: 0,
      ageDisplay: '12 months',
      cohort: 'children6mTo3y',
      cohortLabel: 'Children (6m–3y)',
      recommendedMeasurementPosture: 'recumbent',
    };
  }

  const birthDate = new Date(dobParts.year, dobParts.month, dobParts.day);
  const refDate = new Date(refParts.year, refParts.month, refParts.day);

  if (refDate < birthDate) {
    return {
      completedMonths: 0,
      completedYears: 0,
      remainingMonths: 0,
      ageDisplay: '0 months',
      cohort: 'children0to6m',
      cohortLabel: 'Children (0–6m)',
      recommendedMeasurementPosture: 'recumbent',
    };
  }

  let years = refDate.getFullYear() - birthDate.getFullYear();
  let months = refDate.getMonth() - birthDate.getMonth();
  let days = refDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalCompletedMonths = years * 12 + months;
  const completedYears = years;
  const remainingMonths = months;

  let ageDisplay = '';
  if (completedYears === 0) {
    ageDisplay = `${totalCompletedMonths} ${totalCompletedMonths === 1 ? 'month' : 'months'}`;
  } else if (remainingMonths === 0) {
    ageDisplay = `${completedYears} ${completedYears === 1 ? 'year' : 'years'}`;
  } else {
    ageDisplay = `${completedYears}y ${remainingMonths}m (${totalCompletedMonths}m)`;
  }

  // Determine Cohort
  let cohort: DemographicCohort = 'children6mTo3y';
  let cohortLabel = 'Children (6m–3y)';

  if (categoryHint === 'pregnant') {
    cohort = 'pregnantWomen';
    cohortLabel = 'Pregnant Women';
  } else if (categoryHint === 'lactating') {
    cohort = 'lactatingMothers';
    cohortLabel = 'Lactating Mothers';
  } else if (categoryHint === 'adolescent' || (completedYears >= 10 && completedYears <= 19)) {
    cohort = 'adolescentGirls';
    cohortLabel = 'Adolescent Girls';
  } else if (totalCompletedMonths <= 6) {
    cohort = 'children0to6m';
    cohortLabel = 'Children (0–6m)';
  } else if (totalCompletedMonths <= 36) {
    cohort = 'children6mTo3y';
    cohortLabel = 'Children (6m–3y)';
  } else {
    cohort = 'children3to6y';
    cohortLabel = 'Children (3–6y)';
  }

  // Recommended posture: < 24 months recumbent infantometer; >= 24 months standing stadiometer
  const recommendedMeasurementPosture = totalCompletedMonths < 24 ? 'recumbent' : 'standing';

  return {
    completedMonths: totalCompletedMonths,
    completedYears,
    remainingMonths,
    ageDisplay,
    cohort,
    cohortLabel,
    recommendedMeasurementPosture,
  };
}

// =========================================================================
// MULTI-DIMENSIONAL SCREENING & PLAUSIBILITY ENGINE
// =========================================================================

export interface PlausibilityFlag {
  code: string;
  name: string;
  type: 'data_quality' | 'clinical';
  severity: 'Urgent' | 'Needs Attention' | 'Warning';
  summary: string;
  triggerDetail: string;
  suggestedAction: string;
  isIllustrativeDemoRule: boolean;
}

export interface PlausibilityEvaluationResult {
  isValid: boolean;
  isImpossible: boolean;
  isImplausible: boolean;
  flags: PlausibilityFlag[];
  qualityFlags: PlausibilityFlag[];
  clinicalFlags: PlausibilityFlag[];
  daysElapsed: number;
  weightDeltaKg: number;
  heightDeltaCm: number;
  velocityPerMonthKg: number;
  heightVelocityPerMonthCm: number;
  primaryPriority: 'Urgent' | 'Needs Attention' | 'Referral Pending' | 'Resolved';
}

/**
 * Calculates days between two date strings
 */
export function getDaysBetween(date1: string, date2: string): number {
  const p1 = parseDateParts(date1);
  const p2 = parseDateParts(date2);
  if (!p1 || !p2) return 30; // fallback default
  const d1 = new Date(p1.year, p1.month, p1.day);
  const d2 = new Date(p2.year, p2.month, p2.day);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Evaluates anthropometric entry against biological limits and active casework heuristics
 */
export function evaluateMeasurementEntry(params: {
  currentWeight: number;
  currentHeight: number;
  measurementDate?: string;
  dob: string;
  previousRecord?: {
    weight: number;
    height: number;
    date: string;
  };
  muacCm?: number;
  hasBilateralEdema?: boolean;
  customRules?: Array<{ id: string; thresholdValue: number; isActive: boolean }>;
}): PlausibilityEvaluationResult {
  const {
    currentWeight,
    currentHeight,
    measurementDate = DEMO_CURRENT_DATE,
    dob,
    previousRecord,
    muacCm,
    hasBilateralEdema,
    customRules = [],
  } = params;

  const inputError = validateMeasurementInput(currentWeight, currentHeight, measurementDate);
  if (inputError) {
    const inputFlag: PlausibilityFlag = {
      code: 'ERR-INPUT',
      name: 'Invalid Measurement Input',
      type: 'data_quality',
      severity: 'Warning',
      summary: inputError,
      triggerDetail: inputError,
      suggestedAction: 'Correct the measurement values and date before screening.',
      isIllustrativeDemoRule: true,
    };
    return {
      isValid: false,
      isImpossible: false,
      isImplausible: true,
      flags: [inputFlag],
      qualityFlags: [inputFlag],
      clinicalFlags: [],
      daysElapsed: 0,
      weightDeltaKg: 0,
      heightDeltaCm: 0,
      velocityPerMonthKg: 0,
      heightVelocityPerMonthCm: 0,
      primaryPriority: 'Needs Attention',
    };
  }

  const age = calculateAge(dob, measurementDate);
  const flags: PlausibilityFlag[] = [];

  // Helper rule lookup
  const getRule = (id: string, defaultVal: number) => {
    const found = customRules.find((r) => r.id === id);
    if (!found) return { active: true, val: defaultVal };
    return { active: found.isActive, val: found.thresholdValue };
  };

  // 1. Biological Impossibility Checks (Hard Data Quality Errors)
  let isImpossible = false;
  if (currentWeight <= 0.8 || currentWeight > 45) {
    isImpossible = true;
    flags.push({
      code: 'ERR-W-LIMIT',
      name: 'Impossible Weight Value',
      type: 'data_quality',
      severity: 'Urgent',
      summary: `Entered weight (${currentWeight} kg) exceeds physiological plausibility limits for child cohort.`,
      triggerDetail: `Recorded ${currentWeight} kg (valid range 1.0–35.0 kg)`,
      suggestedAction: 'Check scale display and re-enter weight before dispatching.',
      isIllustrativeDemoRule: true,
    });
  }

  if (currentHeight <= 35 || currentHeight > 140) {
    isImpossible = true;
    flags.push({
      code: 'ERR-H-LIMIT',
      name: 'Impossible Stature Value',
      type: 'data_quality',
      severity: 'Urgent',
      summary: `Entered height/length (${currentHeight} cm) is outside paediatric biological limits.`,
      triggerDetail: `Recorded ${currentHeight} cm (valid range 40.0–130.0 cm)`,
      suggestedAction: 'Confirm stadiometer or infantometer board reading.',
      isIllustrativeDemoRule: true,
    });
  }

  // 2. Sequential / Velocity Checks if prior record exists
  let weightDeltaKg = 0;
  let heightDeltaCm = 0;
  let daysElapsed = 30;
  let velocityPerMonthKg = 0;
  let heightVelocityPerMonthCm = 0;

  if (previousRecord && previousRecord.weight > 0 && previousRecord.height > 0) {
    daysElapsed = getDaysBetween(previousRecord.date, measurementDate);
    weightDeltaKg = Number((currentWeight - previousRecord.weight).toFixed(2));
    heightDeltaCm = Number((currentHeight - previousRecord.height).toFixed(1));

    const monthlyFactor = 30 / daysElapsed;
    velocityPerMonthKg = Number((weightDeltaKg * monthlyFactor).toFixed(2));
    heightVelocityPerMonthCm = Number((heightDeltaCm * monthlyFactor).toFixed(1));

    // Rule 01: Positive Weight Velocity Outlier (e.g. +3.8 kg in 28d) -> Typo or scale tare slip
    const r1 = getRule('RUL-01', 2.5);
    if (r1.active && velocityPerMonthKg > r1.val) {
      flags.push({
        code: 'RUL-01',
        name: 'Weight Velocity Anomaly',
        type: 'data_quality',
        severity: 'Urgent',
        summary: `Suspiciously rapid weight gain (+${weightDeltaKg} kg in ${daysElapsed}d, velocity ~${velocityPerMonthKg} kg/mo). Likely keying transposition typo.`,
        triggerDetail: `Monthly velocity of ${velocityPerMonthKg} kg/30d exceeds threshold of ${r1.val} kg (Illustrative demo rule • Demo simulation)`,
        suggestedAction: 'Issue physical re-weigh order with calibrated scale to verify true weight.',
        isIllustrativeDemoRule: true,
      });
    }

    // Rule 02: Negative Height Step (biological stature shrinkage)
    const r2 = getRule('RUL-02', 0.5);
    if (r2.active && heightDeltaCm < -r2.val) {
      flags.push({
        code: 'RUL-02',
        name: 'Negative Length / Height Step',
        type: 'data_quality',
        severity: 'Needs Attention',
        summary: `Child recorded ${Math.abs(heightDeltaCm)} cm shorter than preceding monthly measurement (${previousRecord.height} cm -> ${currentHeight} cm).`,
        triggerDetail: `Height decrement of ${heightDeltaCm} cm exceeds negative threshold of -${r2.val} cm (Illustrative demo rule • Demo simulation)`,
        suggestedAction: 'Re-measure standing stature with heels against backboard and footwear removed.',
        isIllustrativeDemoRule: true,
      });
    }

    // Rule 03: Rapid Biomarker Depletion / Precipitous Weight Loss (Clinical Alert)
    const r3 = getRule('RUL-03', 1.5);
    if (r3.active && velocityPerMonthKg < -r3.val) {
      flags.push({
        code: 'RUL-03',
        name: 'Rapid Biomarker Depletion',
        type: 'clinical',
        severity: 'Urgent',
        summary: `Child lost ${Math.abs(weightDeltaKg)} kg in ${daysElapsed} days (velocity -${Math.abs(velocityPerMonthKg)} kg/mo). High risk of acute dehydration or recent infection.`,
        triggerDetail: `Weight loss rate exceeds clinical alert threshold of -${r3.val} kg/30d (Illustrative demo rule • Demo simulation)`,
        suggestedAction: 'Immediate home visit and assessment by Sector Lady Supervisor or ANM.',
        isIllustrativeDemoRule: true,
      });
    }

    // Rule 04: Multi-month Growth Stagnation (Clinical Alert)
    const r4 = getRule('RUL-04', 0.1);
    if (r4.active && daysElapsed >= 45 && Math.abs(weightDeltaKg) <= r4.val && age.completedMonths >= 6) {
      flags.push({
        code: 'RUL-04',
        name: 'Multi-Month Growth Stagnation',
        type: 'clinical',
        severity: 'Urgent',
        summary: `Flat weight trajectory across ${daysElapsed} days (+${weightDeltaKg} kg). Child failing to gain required developmental mass.`,
        triggerDetail: `Weight gain < ${r4.val * 1000}g across > 45 days approaching growth faltering (Illustrative demo rule • Demo simulation)`,
        suggestedAction: 'Schedule PHC consultation or NRC nutritional rehabilitation referral.',
        isIllustrativeDemoRule: true,
      });
    }

    // Rule 05: Supra-Physiological Stature Delta (e.g. +6.4 cm in 30 days)
    const r5 = getRule('RUL-05', 4.5);
    if (r5.active && heightVelocityPerMonthCm > r5.val) {
      flags.push({
        code: 'RUL-05',
        name: 'Supra-Physiological Stature Delta',
        type: 'data_quality',
        severity: 'Needs Attention',
        summary: `Height gain of +${heightDeltaCm} cm in ${daysElapsed} days exceeds physiological limits for child age cohort.`,
        triggerDetail: `Height velocity of +${heightVelocityPerMonthCm} cm/30d exceeds threshold of ${r5.val} cm (Illustrative demo rule • Demo simulation)`,
        suggestedAction: 'Inspect infantometer or stadiometer headboard alignment for parallax error.',
        isIllustrativeDemoRule: true,
      });
    }
  }

  // 3. Clinical Biomarker Checks: MUAC & Edema
  if (muacCm !== undefined && muacCm > 0) {
    if (muacCm < 11.5 && age.completedMonths >= 6) {
      flags.push({
        code: 'CLIN-MUAC-RED',
        name: 'Severe Wasting by MUAC (< 11.5 cm)',
        type: 'clinical',
        severity: 'Urgent',
        summary: `Red-band MUAC measurement (${muacCm.toFixed(1)} cm) indicates high risk of Severe Acute Malnutrition (SAM).`,
        triggerDetail: `MUAC ${muacCm.toFixed(1)} cm is below 11.5 cm international cut-off`,
        suggestedAction: 'Initiate urgent referral to Nutrition Rehabilitation Centre (NRC).',
        isIllustrativeDemoRule: false,
      });
    } else if (muacCm < 12.5 && age.completedMonths >= 6) {
      flags.push({
        code: 'CLIN-MUAC-YELLOW',
        name: 'Moderate Acute Malnutrition by MUAC',
        type: 'clinical',
        severity: 'Needs Attention',
        summary: `Yellow-band MUAC (${muacCm.toFixed(1)} cm) indicates Moderate Acute Malnutrition (MAM).`,
        triggerDetail: `MUAC ${muacCm.toFixed(1)} cm between 11.5 and 12.5 cm`,
        suggestedAction: 'Counsel caregiver on high-density supplementary nutrition rations (THR).',
        isIllustrativeDemoRule: false,
      });
    }
  }

  // Bilateral Edema Check
  if (hasBilateralEdema) {
    flags.push({
      code: 'CLIN-EDEMA',
      name: 'Bilateral Pitting Edema Detected',
      type: 'clinical',
      severity: 'Urgent',
      summary: 'Bilateral pedal edema observed upon gentle 3-second thumb pressure.',
      triggerDetail: 'Edema indicates Kwashiorkor presentation regardless of weight-for-height status',
      suggestedAction: 'Immediate emergency clinical referral to District Hospital / NRC.',
      isIllustrativeDemoRule: false,
    });
  }

  // 4. Terminal Digit Preference / Digit Clumping Check
  const isWeightRound = (currentWeight * 10) % 5 === 0;
  const isHeightRound = (currentHeight * 10) % 10 === 0;
  if (isWeightRound && isHeightRound && previousRecord) {
    const prevWeightRound = (previousRecord.weight * 10) % 5 === 0;
    if (prevWeightRound) {
      flags.push({
        code: 'RUL-08',
        name: 'Terminal Digit Preference / Clumping',
        type: 'data_quality',
        severity: 'Warning',
        summary: 'Consecutive readings show exact .00/.50 round figures, suggesting lack of decimal tare precision.',
        triggerDetail: `Current (${currentWeight.toFixed(2)} kg, ${currentHeight.toFixed(1)} cm) and prior readings exhibit round-number clustering (Illustrative demo rule • Demo simulation)`,
        suggestedAction: 'Calibrate spring balance and ensure readings are recorded to nearest 10g/0.1cm.',
        isIllustrativeDemoRule: true,
      });
    }
  }

  const qualityFlags = flags.filter((f) => f.type === 'data_quality');
  const clinicalFlags = flags.filter((f) => f.type === 'clinical');
  const isImplausible = flags.length > 0;

  // Determine overall triage priority
  let primaryPriority: 'Urgent' | 'Needs Attention' | 'Referral Pending' | 'Resolved' = 'Resolved';
  if (flags.some((f) => f.severity === 'Urgent')) {
    primaryPriority = clinicalFlags.some((f) => f.severity === 'Urgent') ? 'Referral Pending' : 'Urgent';
  } else if (flags.some((f) => f.severity === 'Needs Attention')) {
    primaryPriority = 'Needs Attention';
  }

  return {
    isValid: !isImpossible,
    isImpossible,
    isImplausible,
    flags,
    qualityFlags,
    clinicalFlags,
    daysElapsed,
    weightDeltaKg,
    heightDeltaCm,
    velocityPerMonthKg,
    heightVelocityPerMonthCm,
    primaryPriority,
  };
}

// =========================================================================
// ESCALATION MATRIX & ROLE TIERS
// =========================================================================

export interface EscalationTierInfo {
  tierLevel: 1 | 2 | 3 | 4;
  title: string;
  roleName: string;
  actorName: string;
  badgeColor: string;
  slaHours: number;
}

export const ESCALATION_TIERS: Record<number, EscalationTierInfo> = {
  1: {
    tierLevel: 1,
    title: 'Tier 1: Anganwadi Worker (AWW)',
    roleName: 'Frontline AWW',
    actorName: 'AWW-409',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    slaHours: 24,
  },
  2: {
    tierLevel: 2,
    title: 'Tier 2: Sector Lady Supervisor',
    roleName: 'Sector Supervisor',
    actorName: 'Sector Supervisor (LS-01)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    slaHours: 48,
  },
  3: {
    tierLevel: 3,
    title: 'Tier 3: ANM / Sector Medical Officer',
    roleName: 'Clinical Officer / ANM',
    actorName: 'PHC Medical Officer',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    slaHours: 72,
  },
  4: {
    tierLevel: 4,
    title: 'Tier 4: District Program Officer (DPO)',
    roleName: 'District DPO',
    actorName: 'District Programme Officer (DPO)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    slaHours: 120,
  },
};

/**
 * Validates whether a case can be escalated and returns next tier
 */
export function canEscalateCase(currentTier: number): {
  allowed: boolean;
  nextTier?: EscalationTierInfo;
  reason?: string;
} {
  if (currentTier >= 4) {
    return {
      allowed: false,
      reason: 'Case is already at maximum District Program Officer escalation level.',
    };
  }
  const nextTierLevel = (currentTier + 1) as 1 | 2 | 3 | 4;
  return {
    allowed: true,
    nextTier: ESCALATION_TIERS[nextTierLevel],
  };
}

// =========================================================================
// RFC-4180 COMPLIANT CSV EXPORTER
// =========================================================================

export function exportToCsvString(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const headerRow = headers.map(escapeCell).join(',');
  const bodyRows = rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
  return `${headerRow}\r\n${bodyRows}`;
}
