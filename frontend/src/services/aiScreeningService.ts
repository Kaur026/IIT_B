/**
 * Deterministic AI Screening & Simulation Service
 *
 * Provides record-grounded, category-specific screening analysis, case explanations,
 * longitudinal history summaries, next-action suggestions, and daily briefings.
 *
 * In accordance with Poshan Action Layer standards:
 * - Deterministic simulator: identical inputs yield identical outputs.
 * - Distinct, tailored evaluation paths for all 6 Poshan 2.0 beneficiary categories.
 * - No fabricated external AI claims: clearly indicates simulated protocol guidance.
 * - Enforces human verification for all screening anomalies.
 */

import {
  calculateAge,
  getTodayISODate,
  DEMO_CURRENT_DATE,
} from '../utils/casework.ts';
import type {
  BeneficiaryRecord,
  MeasurementRecord,
  BeneficiaryCase,
  ReferralRecord,
  DemoTaskRecord,
  DemoHomeVisitRecord,
  DemoScope,
} from '../store/mockStore.ts';

export type BeneficiaryCategory = 'child_under_6' | 'adolescent' | 'pregnant' | 'lactating';

export type ScreeningSubcategory =
  | 'child_0_6m'
  | 'child_6m_3y'
  | 'child_3_6y'
  | 'adolescent'
  | 'pregnant'
  | 'lactating';

export interface CategoryScreeningParams {
  beneficiaryId: string;
  category: BeneficiaryCategory;
  dob: string;
  gender: 'Female' | 'Male' | 'Other';
  currentWeightKg?: number;
  currentHeightCm?: number;
  muacCm?: number;
  hasBilateralEdema?: boolean;
  birthWeightKg?: number;
  gestationalWeeks?: number;
  hemoglobinGdl?: number;
  previousRecord?: {
    weightKg?: number;
    heightCm?: number;
    date: string;
  };
  measurementDate?: string;
  referenceDate?: string;
}

export interface StructuredScreeningResult {
  beneficiaryId: string;
  beneficiaryCategory: BeneficiaryCategory;
  subcategory: ScreeningSubcategory;
  screeningStatus: 'Normal' | 'Needs Attention' | 'Urgent' | 'Insufficient Data';
  triggeredRuleIds: string[];
  flags: Array<{
    ruleId: string;
    ruleName: string;
    severity: 'Urgent' | 'Needs Attention' | 'Warning' | 'Info';
    category: 'clinical' | 'data_quality' | 'maternal' | 'adolescent';
    summary: string;
    suggestedAction: string;
  }>;
  inputValues: Record<string, number | string | boolean | undefined>;
  previousValues: Record<string, number | string | boolean | undefined>;
  missingFields: string[];
  explanation: string;
  suggestedNextAction: {
    actionCode: string;
    actionText: string;
    priority: 'Urgent' | 'Needs Attention' | 'Routine';
    targetRole: 'AWW' | 'LS' | 'CDPO' | 'MO';
  };
  humanReviewRequired: boolean;
  simulationLabel: string;
  generatedAt: string;
}

export interface CaseExplanationResult {
  caseActionId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  category: BeneficiaryCategory;
  ageDisplay: string;
  centreCode: string;
  assignedAww: string;
  ruleCode: string;
  ruleName: string;
  concernSummary: string;
  measurementUnits: {
    type: 'height' | 'weight' | 'biomarker';
    unit: string;
  };
  comparison: {
    previousValue: string;
    flaggedValue: string;
    difference: string;
    previousDate: string;
    flaggedDate: string;
  };
  whyNeedsAttention: string;
  missingInformation: string[];
  humanReviewRequired: boolean;
  simulationLabel: string;
}

export interface BeneficiaryHistorySummaryResult {
  beneficiaryId: string;
  beneficiaryName: string;
  category: BeneficiaryCategory;
  ageDisplay: string;
  centreCode: string;
  totalMeasurements: number;
  firstMeasurementDate?: string;
  latestMeasurementDate?: string;
  latestReadings: {
    weightKg?: number;
    heightCm?: number;
    muacCm?: number;
    bmi?: number;
    hasEdema?: boolean;
    date?: string;
  };
  growthTrajectory: 'Steady Gain' | 'Growth Faltering' | 'Rapid Depletion' | 'Insufficient History' | 'Stable Maternal';
  activeAlerts: string[];
  resolvedAlertsCount: number;
  referralHistory: {
    total: number;
    active: number;
    completed: number;
    lastFacility?: string;
    lastOutcome?: string;
  };
  pendingVerificationsCount: number;
  missingRecords: string[];
  narrativeSummary: string;
  disclaimer: string;
}

export interface NextActionSuggestion {
  suggestionId: string;
  caseActionId: string;
  beneficiaryId: string;
  actionCode:
    | 'supervisor_verification'
    | 're_measure'
    | 'clinical_referral'
    | 'schedule_followup'
    | 'anc_review'
    | 'wifs_supplementation'
    | 'routine_monitoring';
  title: string;
  description: string;
  priority: 'Urgent' | 'Needs Attention' | 'Routine';
  targetRole: 'AWW' | 'LS' | 'CDPO' | 'MO';
  rationale: string;
  options: Array<'accept' | 'modify' | 'reject'>;
  requiresSupervisorRole: boolean;
  simulationLabel: string;
}

export interface DailyBriefingResult {
  scopeSummary: string;
  asOfDate: string;
  totalBeneficiaries: number;
  priorityCasesCount: number;
  pendingVerificationCount: number;
  overdueFollowupsCount: number;
  pendingMeasurementsCount: number;
  repeatedAlertsCount: number;
  narrative: string;
  priorityWorklist: Array<{
    id: string;
    type: 'case' | 'referral' | 'measurement';
    title: string;
    beneficiaryId: string;
    detail: string;
    priority: 'Urgent' | 'Needs Attention';
    actionLink: string;
  }>;
  simulationLabel: string;
}

/**
 * Determine the exact subcategory based on age and demographic category.
 */
export function resolveSubcategory(category: BeneficiaryCategory, completedMonths: number): ScreeningSubcategory {
  if (category === 'pregnant') return 'pregnant';
  if (category === 'lactating') return 'lactating';
  if (category === 'adolescent') return 'adolescent';
  if (completedMonths < 6) return 'child_0_6m';
  if (completedMonths < 36) return 'child_6m_3y';
  return 'child_3_6y';
}

/**
 * Core category-specific screening evaluation.
 * Evaluates inputs deterministically without external models.
 */
export function runCategorySpecificScreening(params: CategoryScreeningParams): StructuredScreeningResult {
  const {
    beneficiaryId,
    category,
    dob,
    gender,
    currentWeightKg,
    currentHeightCm,
    muacCm,
    hasBilateralEdema,
    birthWeightKg,
    gestationalWeeks,
    hemoglobinGdl,
    previousRecord,
    measurementDate = getTodayISODate(),
  } = params;

  const age = calculateAge(dob, measurementDate, category, gender);
  const subcategory = resolveSubcategory(category, age.completedMonths);

  const flags: StructuredScreeningResult['flags'] = [];
  const missingFields: string[] = [];

  const inputValues: Record<string, number | string | boolean | undefined> = {
    weightKg: currentWeightKg,
    heightCm: currentHeightCm,
    muacCm,
    hasBilateralEdema,
    birthWeightKg,
    gestationalWeeks,
    hemoglobinGdl,
    measurementDate,
  };

  const previousValues: Record<string, number | string | boolean | undefined> = {
    weightKg: previousRecord?.weightKg,
    heightCm: previousRecord?.heightCm,
    date: previousRecord?.date,
  };

  let daysElapsed = 30;
  let weightDeltaKg = 0;
  let heightDeltaCm = 0;
  let velocityPerMonthKg = 0;

  if (previousRecord?.date && measurementDate) {
    const d1 = new Date(`${previousRecord.date}T00:00:00Z`).getTime();
    const d2 = new Date(`${measurementDate}T00:00:00Z`).getTime();
    daysElapsed = Math.max(1, Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)));
    if (currentWeightKg !== undefined && previousRecord.weightKg !== undefined) {
      weightDeltaKg = Number((currentWeightKg - previousRecord.weightKg).toFixed(2));
      velocityPerMonthKg = Number(((weightDeltaKg * 30) / daysElapsed).toFixed(2));
    }
    if (currentHeightCm !== undefined && previousRecord.heightCm !== undefined) {
      heightDeltaCm = Number((currentHeightCm - previousRecord.heightCm).toFixed(1));
    }
  }

  // -------------------------------------------------------------
  // 1. CHILDREN 0â€“6 MONTHS
  // -------------------------------------------------------------
  if (subcategory === 'child_0_6m') {
    if (currentWeightKg === undefined) missingFields.push('weightKg');
    if (currentHeightCm === undefined) missingFields.push('lengthCm');

    if (currentWeightKg !== undefined && (currentWeightKg < 1.0 || currentWeightKg > 12.0)) {
      flags.push({
        ruleId: 'ERR-INF-WEIGHT-LIMIT',
        ruleName: 'Implausible Infant Weight',
        severity: 'Urgent',
        category: 'data_quality',
        summary: `Recorded weight (${currentWeightKg} kg) is outside biological boundaries (1.0â€“12.0 kg) for infants 0â€“6m.`,
        suggestedAction: 'Zero the digital infant scale and re-weigh immediately.',
      });
    }

    if (currentHeightCm !== undefined && (currentHeightCm < 40.0 || currentHeightCm > 75.0)) {
      flags.push({
        ruleId: 'ERR-INF-LENGTH-LIMIT',
        ruleName: 'Implausible Infant Recumbent Length',
        severity: 'Urgent',
        category: 'data_quality',
        summary: `Recorded length (${currentHeightCm} cm) exceeds expected infant boundaries (40.0â€“75.0 cm).`,
        suggestedAction: 'Ensure child is lying flat with feet firmly against infantometer footboard.',
      });
    }

    // Low Birth Weight screening
    if (birthWeightKg !== undefined && birthWeightKg < 2.5) {
      flags.push({
        ruleId: 'INF-01-LBW',
        ruleName: 'Low Birth Weight Intake (< 2.5 kg)',
        severity: 'Needs Attention',
        category: 'clinical',
        summary: `Recorded birth weight (${birthWeightKg} kg) is below standard 2.5 kg threshold.`,
        suggestedAction: 'Provide intensive kangaroo mother care, exclusive breastfeeding, and bi-weekly growth tracking.',
      });
    }

    // Early infancy velocity faltering
    if (previousRecord && currentWeightKg !== undefined && previousRecord.weightKg !== undefined) {
      if (daysElapsed >= 25 && weightDeltaKg <= 0) {
        flags.push({
          ruleId: 'INF-02-FALTER',
          ruleName: 'Early Infancy Weight Faltering',
          severity: 'Urgent',
          category: 'clinical',
          summary: `Zero or negative weight gain across ${daysElapsed} days in early infancy (+${weightDeltaKg} kg).`,
          suggestedAction: 'Immediate lactation assessment, check latching technique, and schedule supervisor home visit within 48h.',
        });
      } else if (weightDeltaKg < -0.3) {
        flags.push({
          ruleId: 'INF-03-DEPLETION',
          ruleName: 'Acute Infant Biomarker Depletion',
          severity: 'Urgent',
          category: 'clinical',
          summary: `Rapid infant weight loss (-${Math.abs(weightDeltaKg)} kg in ${daysElapsed} days). Risk of severe dehydration.`,
          suggestedAction: 'Urgent clinical referral to PHC Medical Officer or NRC for acute pediatric evaluation.',
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 2. CHILDREN 6 MONTHSâ€“3 YEARS
  // -------------------------------------------------------------
  else if (subcategory === 'child_6m_3y') {
    if (currentWeightKg === undefined) missingFields.push('weightKg');
    if (currentHeightCm === undefined) missingFields.push('heightCm');
    if (muacCm === undefined) missingFields.push('muacCm');

    if (currentWeightKg !== undefined && (currentWeightKg < 4.0 || currentWeightKg > 22.0)) {
      flags.push({
        ruleId: 'ERR-CHILD-W-LIMIT',
        ruleName: 'Out-of-Bounds Child Weight',
        severity: 'Urgent',
        category: 'data_quality',
        summary: `Recorded weight (${currentWeightKg} kg) is outside biological boundaries (4.0â€“22.0 kg) for toddler cohort.`,
        suggestedAction: 'Re-weigh with calibrated Salter or infant scale.',
      });
    }

    // Negative height step
    if (previousRecord && currentHeightCm !== undefined && previousRecord.heightCm !== undefined) {
      if (heightDeltaCm < -0.5) {
        flags.push({
          ruleId: 'RUL-02',
          ruleName: 'Negative Length / Height Step',
          severity: 'Needs Attention',
          category: 'data_quality',
          summary: `Child recorded ${Math.abs(heightDeltaCm)} cm shorter than previous reading (${previousRecord.heightCm} cm -> ${currentHeightCm} cm).`,
          suggestedAction: 'Physical re-measurement by Lady Supervisor using rigid infantometer / stadiometer.',
        });
      }
    }

    // Weight velocity depletion or rapid drop
    if (previousRecord && velocityPerMonthKg < -1.5) {
      flags.push({
        ruleId: 'RUL-03',
        ruleName: 'Rapid Biomarker Depletion',
        severity: 'Urgent',
        category: 'clinical',
        summary: `Child lost ${Math.abs(weightDeltaKg)} kg in ${daysElapsed} days (velocity ~${velocityPerMonthKg} kg/mo).`,
        suggestedAction: 'Urgent clinical referral to Medical Officer / NRC for acute illness and wasting assessment.',
      });
    } else if (previousRecord && daysElapsed >= 45 && Math.abs(weightDeltaKg) <= 0.1) {
      flags.push({
        ruleId: 'RUL-04',
        ruleName: 'Multi-Month Growth Stagnation',
        severity: 'Urgent',
        category: 'clinical',
        summary: `Flat weight trajectory across ${daysElapsed} days (+${weightDeltaKg} kg). Child failing to gain developmental mass.`,
        suggestedAction: 'Counsel caregiver on energy-dense supplementary feeding and THR double ration eligibility.',
      });
    }

    // MUAC Screening
    if (muacCm !== undefined && muacCm > 0) {
      if (muacCm < 11.5) {
        flags.push({
          ruleId: 'CLIN-MUAC-RED',
          ruleName: 'Severe Acute Malnutrition by MUAC (< 11.5 cm)',
          severity: 'Urgent',
          category: 'clinical',
          summary: `Red-zone MUAC reading (${muacCm.toFixed(1)} cm) indicates high clinical mortality risk from SAM.`,
          suggestedAction: 'Immediate referral to Nutrition Rehabilitation Centre (NRC) for therapeutic stabilization.',
        });
      } else if (muacCm < 12.5) {
        flags.push({
          ruleId: 'CLIN-MUAC-YELLOW',
          ruleName: 'Moderate Acute Malnutrition by MUAC (11.5â€“12.4 cm)',
          severity: 'Needs Attention',
          category: 'clinical',
          summary: `Yellow-zone MUAC reading (${muacCm.toFixed(1)} cm) indicates MAM risk.`,
          suggestedAction: 'Targeted counselling on dietary diversity, handwashing, and Take-Home Ration utilization.',
        });
      }
    }

    if (hasBilateralEdema) {
      flags.push({
        ruleId: 'CLIN-EDEMA',
        ruleName: 'Bilateral Pitting Edema Detected',
        severity: 'Urgent',
        category: 'clinical',
        summary: 'Bilateral pedal edema observed on 3-second pressure check. Kwashiorkor presentation.',
        suggestedAction: 'Emergency clinical referral to District Hospital / NRC.',
      });
    }
  }

  // -------------------------------------------------------------
  // 3. CHILDREN 3â€“6 YEARS
  // -------------------------------------------------------------
  else if (subcategory === 'child_3_6y') {
    if (currentWeightKg === undefined) missingFields.push('weightKg');
    if (currentHeightCm === undefined) missingFields.push('heightCm');

    if (currentWeightKg !== undefined && (currentWeightKg < 8.0 || currentWeightKg > 35.0)) {
      flags.push({
        ruleId: 'ERR-PRESCHOOL-W-LIMIT',
        ruleName: 'Implausible Preschooler Weight',
        severity: 'Urgent',
        category: 'data_quality',
        summary: `Recorded weight (${currentWeightKg} kg) is outside expected preschool boundaries (8.0â€“35.0 kg).`,
        suggestedAction: 'Re-measure standing weight with shoes removed.',
      });
    }

    if (previousRecord && currentHeightCm !== undefined && previousRecord.heightCm !== undefined) {
      if (heightDeltaCm < -0.5) {
        flags.push({
          ruleId: 'RUL-02',
          ruleName: 'Negative Length / Height Step',
          severity: 'Needs Attention',
          category: 'data_quality',
          summary: `Child recorded ${Math.abs(heightDeltaCm)} cm shorter than preceding monthly measurement (${previousRecord.heightCm} cm -> ${currentHeightCm} cm).`,
          suggestedAction: 'Supervisor in-person verification with calibrated vertical stadiometer.',
        });
      }

      const monthlyHeightVelocity = Number(((heightDeltaCm * 30) / daysElapsed).toFixed(1));
      if (monthlyHeightVelocity > 4.5) {
        flags.push({
          ruleId: 'RUL-05',
          ruleName: 'Supra-Physiological Stature Delta',
          severity: 'Needs Attention',
          category: 'data_quality',
          summary: `Recorded height gain (+${heightDeltaCm} cm in ${daysElapsed}d, velocity ~${monthlyHeightVelocity} cm/mo) exceeds physiological limits.`,
          suggestedAction: 'Inspect stadiometer headboard for parallax angle error and re-measure.',
        });
      }
    }

    if (previousRecord && velocityPerMonthKg < -1.5) {
      flags.push({
        ruleId: 'RUL-03',
        ruleName: 'Rapid Biomarker Depletion',
        severity: 'Urgent',
        category: 'clinical',
        summary: `Weight loss of ${Math.abs(weightDeltaKg)} kg in ${daysElapsed} days (velocity ~${velocityPerMonthKg} kg/mo).`,
        suggestedAction: 'Clinical assessment at Primary Health Centre.',
      });
    } else if (previousRecord && daysElapsed >= 60 && Math.abs(weightDeltaKg) <= 0.15) {
      flags.push({
        ruleId: 'RUL-04',
        ruleName: 'Multi-Month Growth Stagnation',
        severity: 'Needs Attention',
        category: 'clinical',
        summary: `Flat weight gain trajectory across ${daysElapsed} days (+${weightDeltaKg} kg).`,
        suggestedAction: 'Review hot cooked meal consumption at Anganwadi and supplementary nutrition.',
      });
    }
  }

  // -------------------------------------------------------------
  // 4. ADOLESCENT GIRLS (10â€“19 YEARS)
  // -------------------------------------------------------------
  else if (subcategory === 'adolescent') {
    if (currentWeightKg === undefined) missingFields.push('weightKg');
    if (currentHeightCm === undefined) missingFields.push('heightCm');

    if (currentWeightKg !== undefined && (currentWeightKg < 20.0 || currentWeightKg > 100.0)) {
      flags.push({
        ruleId: 'ERR-ADOL-W-LIMIT',
        ruleName: 'Out-of-Bounds Adolescent Weight',
        severity: 'Urgent',
        category: 'data_quality',
        summary: `Recorded weight (${currentWeightKg} kg) is outside biological boundaries for adolescent girls (20â€“100 kg).`,
        suggestedAction: 'Calibrate digital weighing scale and verify footwear removal.',
      });
    }

    // BMI Calculation
    if (currentWeightKg !== undefined && currentHeightCm !== undefined && currentHeightCm > 0) {
      const heightM = currentHeightCm / 100;
      const bmi = Number((currentWeightKg / (heightM * heightM)).toFixed(1));
      inputValues.bmi = bmi;

      if (bmi < 16.0) {
        flags.push({
          ruleId: 'ADOL-01-THIN',
          ruleName: 'Severe Adolescent Thinness (BMI < 16.0)',
          severity: 'Urgent',
          category: 'adolescent',
          summary: `Calculated BMI of ${bmi} kg/mÂ² indicates severe adolescent undernutrition.`,
          suggestedAction: 'Refer to Adolescent Friendly Health Clinic (AFHC) / PHC for clinical nutrition workup.',
        });
      } else if (bmi < 18.5) {
        flags.push({
          ruleId: 'ADOL-02-MILD-THIN',
          ruleName: 'Adolescent Mild Underweight (BMI 16.0â€“18.4)',
          severity: 'Needs Attention',
          category: 'adolescent',
          summary: `Calculated BMI of ${bmi} kg/mÂ² indicates adolescent underweight status.`,
          suggestedAction: 'Enroll in Poshan 2.0 supplementary ration program and counsel on protein-rich diets.',
        });
      }
    }

    // Anemia Screening
    if (hemoglobinGdl !== undefined) {
      if (hemoglobinGdl < 8.0) {
        flags.push({
          ruleId: 'ADOL-03-ANEMIA-SEVERE',
          ruleName: 'Severe Adolescent Anemia (Hb < 8.0 g/dL)',
          severity: 'Urgent',
          category: 'adolescent',
          summary: `Recorded hemoglobin (${hemoglobinGdl.toFixed(1)} g/dL) indicates severe microcytic anemia.`,
          suggestedAction: 'Immediate referral to PHC Medical Officer for therapeutic iron regimen and deworming.',
        });
      } else if (hemoglobinGdl < 12.0) {
        flags.push({
          ruleId: 'ADOL-04-ANEMIA-MILD',
          ruleName: 'Mild/Moderate Adolescent Anemia (Hb < 12.0 g/dL)',
          severity: 'Needs Attention',
          category: 'adolescent',
          summary: `Hemoglobin of ${hemoglobinGdl.toFixed(1)} g/dL is below normal adolescent cut-off (12.0 g/dL).`,
          suggestedAction: 'Ensure weekly supervised consumption of Weekly Iron and Folic Acid (WIFS) blue tablet.',
        });
      }
    } else {
      missingFields.push('hemoglobinGdl');
    }
  }

  // -------------------------------------------------------------
  // 5. PREGNANT WOMEN
  // -------------------------------------------------------------
  else if (subcategory === 'pregnant') {
    if (currentWeightKg === undefined) missingFields.push('weightKg');
    if (currentHeightCm === undefined) missingFields.push('heightCm');

    if (currentHeightCm !== undefined && currentHeightCm < 145.0) {
      flags.push({
        ruleId: 'MAT-01-SHORT-STATURE',
        ruleName: 'Short Maternal Stature (< 145 cm)',
        severity: 'Needs Attention',
        category: 'maternal',
        summary: `Maternal height of ${currentHeightCm.toFixed(1)} cm indicates cephalopelvic disproportion risk.`,
        suggestedAction: 'Tag as high-risk pregnancy (HRP) for institutional delivery at First Referral Unit (FRU).',
      });
    }

    // Gestational weight gain check
    if (previousRecord && currentWeightKg !== undefined && previousRecord.weightKg !== undefined) {
      if (daysElapsed >= 28 && weightDeltaKg < 1.0) {
        flags.push({
          ruleId: 'MAT-02-LOW-WEIGHT-GAIN',
          ruleName: 'Inadequate Gestational Weight Gain (< 1.0 kg/month)',
          severity: 'Needs Attention',
          category: 'maternal',
          summary: `Recorded maternal weight gain (+${weightDeltaKg} kg in ${daysElapsed} days) is below expected 1.0 kg/month in 2nd/3rd trimester.`,
          suggestedAction: 'Review Take-Home Ration intake, dietary diversity, and counsel on extra calorie intake.',
        });
      } else if (daysElapsed <= 35 && weightDeltaKg > 3.5) {
        flags.push({
          ruleId: 'MAT-03-HIGH-WEIGHT-GAIN',
          ruleName: 'Excessive Maternal Weight Gain / Pre-eclampsia Risk',
          severity: 'Urgent',
          category: 'maternal',
          summary: `Sudden weight gain (+${weightDeltaKg} kg in ${daysElapsed} days) may signify fluid retention / pre-eclampsia.`,
          suggestedAction: 'Measure blood pressure immediately and refer to PHC / ANM for urine albumin testing.',
        });
      }
    }

    // Maternal Hemoglobin
    if (hemoglobinGdl !== undefined) {
      if (hemoglobinGdl < 7.0) {
        flags.push({
          ruleId: 'MAT-04-ANEMIA-SEVERE',
          ruleName: 'Severe Maternal Anemia (Hb < 7.0 g/dL)',
          severity: 'Urgent',
          category: 'maternal',
          summary: `Hemoglobin of ${hemoglobinGdl.toFixed(1)} g/dL indicates severe anemia during pregnancy.`,
          suggestedAction: 'Immediate referral to District Hospital / FRU for parenteral iron sucrose or transfusion.',
        });
      } else if (hemoglobinGdl < 11.0) {
        flags.push({
          ruleId: 'MAT-05-ANEMIA-MODERATE',
          ruleName: 'Moderate Maternal Anemia (Hb < 11.0 g/dL)',
          severity: 'Needs Attention',
          category: 'maternal',
          summary: `Hemoglobin of ${hemoglobinGdl.toFixed(1)} g/dL is below pregnancy standard (11.0 g/dL).`,
          suggestedAction: 'Prescribe twice-daily therapeutic IFA tablets and schedule home compliance check.',
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 6. LACTATING MOTHERS
  // -------------------------------------------------------------
  else if (subcategory === 'lactating') {
    if (currentWeightKg === undefined) missingFields.push('weightKg');

    if (currentWeightKg !== undefined && currentHeightCm !== undefined && currentHeightCm > 0) {
      const heightM = currentHeightCm / 100;
      const bmi = Number((currentWeightKg / (heightM * heightM)).toFixed(1));
      inputValues.bmi = bmi;

      if (bmi < 18.5) {
        flags.push({
          ruleId: 'LAC-01-UNDERWEIGHT',
          ruleName: 'Maternal Postpartum Undernutrition (BMI < 18.5)',
          severity: 'Needs Attention',
          category: 'maternal',
          summary: `Postpartum BMI of ${bmi} kg/mÂ² indicates chronic maternal energy deficiency.`,
          suggestedAction: 'Ensure receipt of postpartum supplementary THR rations and maternal calcium tablets.',
        });
      }
    }

    if (hemoglobinGdl !== undefined) {
      if (hemoglobinGdl < 8.0) {
        flags.push({
          ruleId: 'LAC-02-ANEMIA-SEVERE',
          ruleName: 'Severe Postpartum Anemia (Hb < 8.0 g/dL)',
          severity: 'Urgent',
          category: 'maternal',
          summary: `Postpartum hemoglobin of ${hemoglobinGdl.toFixed(1)} g/dL indicates severe anemia.`,
          suggestedAction: 'Refer to PHC Medical Officer for therapeutic iron supplementation.',
        });
      } else if (hemoglobinGdl < 12.0) {
        flags.push({
          ruleId: 'LAC-03-ANEMIA-MILD',
          ruleName: 'Mild Postpartum Anemia (Hb < 12.0 g/dL)',
          severity: 'Needs Attention',
          category: 'maternal',
          summary: `Postpartum hemoglobin of ${hemoglobinGdl.toFixed(1)} g/dL is below recommended lactating threshold (12.0 g/dL).`,
          suggestedAction: 'Continue 180-day postpartum IFA supplementation and dietary counseling.',
        });
      }
    }
  }

  // -------------------------------------------------------------
  // Overall Status & Suggested Next Action Resolution
  // -------------------------------------------------------------
  let screeningStatus: StructuredScreeningResult['screeningStatus'] = 'Normal';
  if (missingFields.length > 0 && flags.length === 0) {
    screeningStatus = 'Insufficient Data';
  } else if (flags.some((f) => f.severity === 'Urgent')) {
    screeningStatus = 'Urgent';
  } else if (flags.some((f) => f.severity === 'Needs Attention')) {
    screeningStatus = 'Needs Attention';
  }

  const triggeredRuleIds = flags.map((f) => f.ruleId);

  let explanation = '';
  if (flags.length === 0) {
    explanation = missingFields.length > 0
      ? `Measurement record is incomplete. Missing fields: ${missingFields.join(', ')}. Complete intake to enable comprehensive protocol screening.`
      : `Biometric values fall within expected physiological ranges for ${subcategory.replace(/_/g, ' ')} cohort. No active anomalies flagged.`;
  } else {
    explanation = flags.map((f) => `${f.ruleName} (${f.ruleId}): ${f.summary}`).join(' ');
  }

  // Resolve Suggested Next Action
  let suggestedNextAction: StructuredScreeningResult['suggestedNextAction'] = {
    actionCode: 'routine_monitoring',
    actionText: 'Maintain standard monthly growth monitoring and nutrition tracking.',
    priority: 'Routine',
    targetRole: 'AWW',
  };

  if (flags.some((f) => f.ruleId === 'RUL-02')) {
    suggestedNextAction = {
      actionCode: 'supervisor_verification',
      actionText: 'Dispatch in-person physical verification to Lady Supervisor to re-measure stature using calibrated vertical board.',
      priority: 'Needs Attention',
      targetRole: 'LS',
    };
  } else if (flags.some((f) => f.ruleId === 'CLIN-MUAC-RED' || f.ruleId === 'CLIN-EDEMA' || f.ruleId === 'INF-03-DEPLETION')) {
    suggestedNextAction = {
      actionCode: 'clinical_referral',
      actionText: 'Initiate urgent clinical referral to Nutrition Rehabilitation Centre (NRC) or PHC Medical Officer.',
      priority: 'Urgent',
      targetRole: 'AWW',
    };
  } else if (flags.some((f) => f.ruleId === 'RUL-03' || f.ruleId === 'RUL-04' || f.ruleId === 'INF-02-FALTER')) {
    suggestedNextAction = {
      actionCode: 'schedule_followup',
      actionText: 'Schedule targeted home visit within 7 days to assess supplementary nutrition consumption and feeding practices.',
      priority: 'Urgent',
      targetRole: 'AWW',
    };
  } else if (flags.some((f) => f.category === 'maternal')) {
    suggestedNextAction = {
      actionCode: 'anc_review',
      actionText: 'Review antenatal / postnatal checkup records and confirm therapeutic IFA compliance with ANM.',
      priority: flags.some((f) => f.severity === 'Urgent') ? 'Urgent' : 'Needs Attention',
      targetRole: 'AWW',
    };
  } else if (flags.some((f) => f.category === 'adolescent')) {
    suggestedNextAction = {
      actionCode: 'wifs_supplementation',
      actionText: 'Distribute weekly iron-folic acid tablet (WIFS) and record adolescent health assessment.',
      priority: flags.some((f) => f.severity === 'Urgent') ? 'Urgent' : 'Needs Attention',
      targetRole: 'AWW',
    };
  } else if (missingFields.length > 0) {
    suggestedNextAction = {
      actionCode: 're_measure',
      actionText: `Collect missing fields (${missingFields.join(', ')}) at next centre visit.`,
      priority: 'Routine',
      targetRole: 'AWW',
    };
  }

  return {
    beneficiaryId,
    beneficiaryCategory: category,
    subcategory,
    screeningStatus,
    triggeredRuleIds,
    flags,
    inputValues,
    previousValues,
    missingFields,
    explanation,
    suggestedNextAction,
    humanReviewRequired: flags.length > 0,
    simulationLabel: 'Simulated AI Analysis â€¢ Human Verification Required',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * AI FEATURE 1: Explain Case
 * Generates an auditable, record-grounded case explanation with correct units.
 */
export function explainCase(params: {
  caseItem: BeneficiaryCase;
  beneficiary?: BeneficiaryRecord;
}): CaseExplanationResult {
  const { caseItem, beneficiary } = params;

  const category = (beneficiary?.category || 'child_under_6') as BeneficiaryCategory;
  const isHeightRule = caseItem.ruleCode === 'RUL-02' || caseItem.ruleCode === 'RUL-05';
  const isMuacRule = caseItem.ruleCode.startsWith('CLIN-MUAC');

  let measurementUnits: CaseExplanationResult['measurementUnits'] = {
    type: 'weight',
    unit: 'kg',
  };

  let previousValue = `${caseItem.prevWeight.toFixed(2)} kg`;
  let flaggedValue = `${caseItem.flaggedWeight.toFixed(2)} kg`;
  let difference = caseItem.weightDelta;

  if (isHeightRule) {
    measurementUnits = { type: 'height', unit: 'cm' };
    const prevH = typeof caseItem.prevHeight === 'number' && Number.isFinite(caseItem.prevHeight)
      ? caseItem.prevHeight.toFixed(1)
      : '0.0';
    const flagH = typeof caseItem.flaggedHeight === 'number' && Number.isFinite(caseItem.flaggedHeight)
      ? caseItem.flaggedHeight.toFixed(1)
      : '0.0';
    previousValue = `${prevH} cm`;
    flaggedValue = `${flagH} cm`;
    const diffH = Number(flagH) - Number(prevH);
    difference = `${diffH >= 0 ? '+' : ''}${diffH.toFixed(1)} cm (Height)`;
  } else if (isMuacRule) {
    measurementUnits = { type: 'biomarker', unit: 'cm' };
  }

  let whyNeedsAttention = '';
  if (caseItem.ruleCode === 'RUL-02') {
    whyNeedsAttention =
      `Biological impossibility: Stature cannot decrease over time. The recorded decrement of ${difference} ` +
      `indicates either infantometer headboard slippage, measurement technique discrepancy, or a keypad transposition error. ` +
      `Because this affects longitudinal growth velocity monitoring, in-person supervisor re-measurement is required before official consolidation.`;
  } else if (caseItem.ruleCode === 'RUL-03') {
    whyNeedsAttention =
      `Acute clinical concern: The recorded weight loss of ${difference} exceeds physiological limits for this age cohort. ` +
      `Rapid weight loss is a key indicator of acute infection, severe diarrhea, or sudden food intake disruption requiring clinical review.`;
  } else if (caseItem.ruleCode === 'RUL-04') {
    whyNeedsAttention =
      `Growth stagnation: The child's weight has remained static across consecutive monitoring intervals. ` +
      `Early growth faltering precedes clinical wasting and stunting if supplementary feeding is not intensified.`;
  } else {
    whyNeedsAttention = caseItem.concernSummary || 'Screening rule activated due to parameter deviation.';
  }

  const missingInformation: string[] = [];
  if (!caseItem.prevDate) {
    missingInformation.push('Prior historical measurement date is missing.');
  }
  if (!caseItem.acknowledgedAt) {
    missingInformation.push('Worker casework acknowledgment has not been recorded.');
  }
  if (!caseItem.isVerified) {
    missingInformation.push('Supervisory physical re-measurement verification is pending.');
  }

  const beneficiaryAge = beneficiary
    ? `${calculateAge(beneficiary.dob, caseItem.flaggedDate || DEMO_CURRENT_DATE, beneficiary.category, beneficiary.gender).ageDisplay}`
    : `${caseItem.ageMonths} months`;

  return {
    caseActionId: caseItem.actionId,
    beneficiaryId: caseItem.id,
    beneficiaryName: beneficiary?.name || caseItem.id,
    category,
    ageDisplay: beneficiaryAge,
    centreCode: caseItem.centreCode,
    assignedAww: caseItem.assignedAww,
    ruleCode: caseItem.ruleCode,
    ruleName: caseItem.ruleName,
    concernSummary: caseItem.concernSummary,
    measurementUnits,
    comparison: {
      previousValue,
      flaggedValue,
      difference,
      previousDate: caseItem.prevDate,
      flaggedDate: caseItem.flaggedDate,
    },
    whyNeedsAttention,
    missingInformation,
    humanReviewRequired: !caseItem.isVerified,
    simulationLabel: 'Simulated AI Analysis â€¢ Protocol Grounded',
  };
}

/**
 * AI FEATURE 2: Beneficiary History Summary
 * Compiles an auditable longitudinal history summary from actual store state.
 */
export function getBeneficiaryHistorySummary(params: {
  beneficiary: BeneficiaryRecord;
  measurements: MeasurementRecord[];
  cases: BeneficiaryCase[];
  referrals: ReferralRecord[];
  visits?: DemoHomeVisitRecord[];
}): BeneficiaryHistorySummaryResult {
  const { beneficiary, measurements, cases, referrals } = params;

  const sortedMeasurements = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const totalMeasurements = sortedMeasurements.length;
  const firstMeasurementDate = sortedMeasurements[0]?.date;
  const latest = sortedMeasurements[sortedMeasurements.length - 1];

  let latestBmi: number | undefined;
  if (latest?.weightKg && latest?.heightCm && latest.heightCm > 0) {
    const m = latest.heightCm / 100;
    latestBmi = Number((latest.weightKg / (m * m)).toFixed(1));
  }

  const latestReadings: BeneficiaryHistorySummaryResult['latestReadings'] = {
    weightKg: latest?.weightKg,
    heightCm: latest?.heightCm,
    muacCm: latest?.muacCm,
    bmi: latestBmi,
    hasEdema: latest?.hasEdema,
    date: latest?.date,
  };

  // Trajectory Assessment
  let growthTrajectory: BeneficiaryHistorySummaryResult['growthTrajectory'] = 'Insufficient History';
  if (beneficiary.category === 'pregnant' || beneficiary.category === 'lactating') {
    growthTrajectory = 'Stable Maternal';
  } else if (totalMeasurements >= 2) {
    const prev = sortedMeasurements[sortedMeasurements.length - 2];
    const diff = Number((latest.weightKg - prev.weightKg).toFixed(2));
    if (diff < -0.5) growthTrajectory = 'Rapid Depletion';
    else if (diff <= 0.05) growthTrajectory = 'Growth Faltering';
    else growthTrajectory = 'Steady Gain';
  }

  const activeAlerts = cases.filter((c) => !c.isVerified).map((c) => `${c.ruleCode}: ${c.ruleName}`);
  const resolvedAlertsCount = cases.filter((c) => c.isVerified).length;

  const completedReferrals = referrals.filter((r) => r.status === 'Completed').length;
  const activeReferrals = referrals.filter((r) => r.status !== 'Completed').length;
  const lastReferral = referrals[referrals.length - 1];

  const pendingVerificationsCount = cases.filter((c) => !c.isVerified).length;

  const missingRecords: string[] = [];
  if (totalMeasurements === 0) {
    missingRecords.push('No anthropometric measurements recorded to date.');
  } else if (latest?.date) {
    const daysSince = Math.round((new Date().getTime() - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 45) {
      missingRecords.push(`Routine measurement overdue (${daysSince} days since last recording on ${latest.date}).`);
    }
  }

  if (beneficiary.category === 'child_under_6' && !beneficiary.birthWeight) {
    missingRecords.push('Recorded birth weight is absent from registry.');
  }

  const beneficiaryAge = calculateAge(
    beneficiary.dob,
    latest?.date || DEMO_CURRENT_DATE,
    beneficiary.category,
    beneficiary.gender
  ).ageDisplay;

  // Narrative summary text
  let narrativeSummary = '';
  if (totalMeasurements === 0) {
    narrativeSummary = `${beneficiary.name} (${beneficiary.id}) was registered on ${beneficiary.registrationDate} into ${beneficiary.centreCode}. No historical measurements have been recorded yet. Baseline intake is required before longitudinal growth trajectory can be evaluated.`;
  } else {
    narrativeSummary =
      `${beneficiary.name} (${beneficiary.id}) has ${totalMeasurements} recorded measurement${totalMeasurements > 1 ? 's' : ''} between ${firstMeasurementDate} and ${latest?.date}. ` +
      `Current trajectory reflects ${growthTrajectory.toLowerCase()}. ` +
      `There ${activeAlerts.length === 1 ? 'is 1 active alert' : `are ${activeAlerts.length} active alerts`} requiring frontline review, and ${resolvedAlertsCount} previously verified case${resolvedAlertsCount === 1 ? '' : 's'}. ` +
      `Referral history includes ${referrals.length} record${referrals.length === 1 ? '' : 's'} (${completedReferrals} closed, ${activeReferrals} active).`;
  }

  return {
    beneficiaryId: beneficiary.id,
    beneficiaryName: beneficiary.name,
    category: beneficiary.category,
    ageDisplay: beneficiaryAge,
    centreCode: beneficiary.centreCode,
    totalMeasurements,
    firstMeasurementDate,
    latestMeasurementDate: latest?.date,
    latestReadings,
    growthTrajectory,
    activeAlerts,
    resolvedAlertsCount,
    referralHistory: {
      total: referrals.length,
      active: activeReferrals,
      completed: completedReferrals,
      lastFacility: lastReferral?.destination,
      lastOutcome: lastReferral?.finalOutcome,
    },
    pendingVerificationsCount,
    missingRecords,
    narrativeSummary,
    disclaimer: 'Summary synthesized deterministically from stored session records only. Not a medical diagnosis.',
  };
}

/**
 * AI FEATURE 3: Suggest Next Action
 * Returns context-aware operational suggestion based on beneficiary category & case trigger.
 */
export function suggestNextAction(params: {
  caseItem: BeneficiaryCase;
  beneficiary?: BeneficiaryRecord;
  measurements?: MeasurementRecord[];
  referrals?: ReferralRecord[];
}): NextActionSuggestion {
  const { caseItem, beneficiary } = params;
  const category = (beneficiary?.category || 'child_under_6') as BeneficiaryCategory;

  let actionCode: NextActionSuggestion['actionCode'] = 're_measure';
  let title = 'Frontline Re-Measurement';
  let description = 'Perform calibrated repeat measurement at Anganwadi Centre.';
  let priority: NextActionSuggestion['priority'] = 'Needs Attention';
  let targetRole: NextActionSuggestion['targetRole'] = 'AWW';
  let rationale = 'Standard verification protocol for flagged anthropometric data.';
  let requiresSupervisorRole = false;

  if (caseItem.ruleCode === 'RUL-02' || caseItem.ruleCode === 'RUL-05') {
    actionCode = 'supervisor_verification';
    title = 'Lady Supervisor Stature Re-Measurement';
    description = 'Lady Supervisor in-person physical measurement using calibrated vertical stadiometer.';
    priority = 'Needs Attention';
    targetRole = 'LS';
    rationale = 'Biological impossibility or excessive stature velocity cannot be self-verified by field worker; independent supervisory measurement is mandated.';
    requiresSupervisorRole = true;
  } else if (caseItem.ruleCode === 'CLIN-MUAC-RED' || caseItem.ruleCode === 'CLIN-EDEMA' || caseItem.ruleCode === 'INF-03-DEPLETION') {
    actionCode = 'clinical_referral';
    title = 'Urgent Clinical Referral (NRC / Hospital)';
    description = 'Issue immediate referral slip to Nutrition Rehabilitation Centre or PHC Medical Officer.';
    priority = 'Urgent';
    targetRole = 'AWW';
    rationale = 'Biomarker levels indicate acute severe malnutrition requiring medical assessment and therapeutic feeding.';
    requiresSupervisorRole = false;
  } else if (caseItem.ruleCode === 'RUL-03' || caseItem.ruleCode === 'RUL-04' || caseItem.ruleCode === 'INF-02-FALTER') {
    actionCode = 'schedule_followup';
    title = 'Home Visit & Ration Verification';
    description = 'Schedule structured Anganwadi home visit within 7 days to inspect feeding practices and THR intake.';
    priority = 'Urgent';
    targetRole = 'AWW';
    rationale = 'Multi-week growth faltering requires direct household counseling on complementary feeding density.';
    requiresSupervisorRole = false;
  } else if (category === 'pregnant' || category === 'lactating') {
    actionCode = 'anc_review';
    title = 'Antenatal / Postnatal Health Review';
    description = 'Verify IFA supplementation intake and coordinate clinical checkup at next Village Health Sanitation & Nutrition Day (VHSND).';
    priority = 'Needs Attention';
    targetRole = 'AWW';
    rationale = 'Maternal health indicators require regular monitoring in coordination with the Auxiliary Nurse Midwife (ANM).';
    requiresSupervisorRole = false;
  } else if (category === 'adolescent') {
    actionCode = 'wifs_supplementation';
    title = 'WIFS Compliance & Anemia Counseling';
    description = 'Ensure weekly iron-folic acid administration and counsel on adolescent nutrition.';
    priority = 'Needs Attention';
    targetRole = 'AWW';
    rationale = 'Adolescent nutritional status depends on weekly IFA adherence and dietary diversity.';
    requiresSupervisorRole = false;
  }

  return {
    suggestionId: `SUG-${caseItem.actionId}`,
    caseActionId: caseItem.actionId,
    beneficiaryId: caseItem.id,
    actionCode,
    title,
    description,
    priority,
    targetRole,
    rationale,
    options: ['accept', 'modify', 'reject'],
    requiresSupervisorRole,
    simulationLabel: 'Simulated AI Recommendation â€¢ Field Protocol Grounded',
  };
}

/**
 * AI FEATURE 5: Daily AI Briefing
 * Dynamically computes an auditable daily operational briefing for the active scope.
 */
export function generateDailyBriefing(params: {
  scope: DemoScope;
  beneficiaries: BeneficiaryRecord[];
  cases: BeneficiaryCase[];
  referrals: ReferralRecord[];
  tasks: DemoTaskRecord[];
  measurements: MeasurementRecord[];
}): DailyBriefingResult {
  const { scope, beneficiaries, cases, referrals } = params;

  const role = scope.role || 'AWW';
  const centre = scope.centreCode || 'AWC-702';
  const sector = scope.sectorCode || 'Sector-4';
  const project = scope.projectCode || 'Project-Central';

  let scopeSummary = `Centre ${centre} (AWW Desk)`;
  if (role === 'LS') scopeSummary = `Sector ${sector} (Supervisory Desk)`;
  else if (role === 'CDPO') scopeSummary = `Project ${project} (CDPO Office)`;
  else if (role === 'DPO') scopeSummary = `District Mission Cell (DPO Overview)`;

  const priorityCases = cases.filter((c) => !c.isVerified && (c.priority === 'Urgent' || c.priority === 'Referral Pending'));
  const pendingVerifications = cases.filter((c) => !c.isVerified);
  const overdueReferrals = referrals.filter((r) => r.status === 'Pending' || r.status === 'Follow-up In Progress');

  // Find beneficiaries missing monthly measurement (none in past 35 days)
  const now = new Date(DEMO_CURRENT_DATE).getTime();
  const measuredRecently = new Set<string>();
  params.measurements.forEach((m) => {
    const diffDays = (now - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 35) measuredRecently.add(m.beneficiaryId);
  });
  const pendingMeasurementsCount = beneficiaries.filter(
    (b) => b.category === 'child_under_6' && !measuredRecently.has(b.id)
  ).length;

  const repeatedAlertsCount = cases.filter((c) => c.ruleCode === 'RUL-04' || c.ruleCode === 'RUL-03').length;

  const priorityWorklist: DailyBriefingResult['priorityWorklist'] = [];

  // Top urgent cases
  priorityCases.slice(0, 3).forEach((c) => {
    priorityWorklist.push({
      id: c.actionId,
      type: 'case',
      title: `${c.ruleName} (${c.id})`,
      beneficiaryId: c.id,
      detail: c.concernSummary,
      priority: 'Urgent',
      actionLink: `/queue`,
    });
  });

  // Top pending referrals
  overdueReferrals.slice(0, 2).forEach((r) => {
    priorityWorklist.push({
      id: r.id,
      type: 'referral',
      title: `Referral to ${r.destination} (${r.beneficiaryId})`,
      beneficiaryId: r.beneficiaryId,
      detail: `Reason: ${r.reason}. Status: ${r.status}. Due by: ${r.dueDate}.`,
      priority: 'Needs Attention',
      actionLink: `/referrals`,
    });
  });

  const narrative =
    `Operational summary for ${scopeSummary} as of ${DEMO_CURRENT_DATE}: ` +
    `${priorityCases.length} high-priority case${priorityCases.length === 1 ? '' : 's'} require immediate casework, ` +
    `${pendingVerifications.length} case${pendingVerifications.length === 1 ? '' : 's'} await supervisory verification, and ` +
    `${pendingMeasurementsCount} child${pendingMeasurementsCount === 1 ? '' : 'ren'} are due for monthly growth monitoring. ` +
    `${overdueReferrals.length} active referral${overdueReferrals.length === 1 ? '' : 's'} in catchment.`;

  return {
    scopeSummary,
    asOfDate: DEMO_CURRENT_DATE,
    totalBeneficiaries: beneficiaries.length,
    priorityCasesCount: priorityCases.length,
    pendingVerificationCount: pendingVerifications.length,
    overdueFollowupsCount: overdueReferrals.length,
    pendingMeasurementsCount,
    repeatedAlertsCount,
    narrative,
    priorityWorklist,
    simulationLabel: 'Simulated AI Daily Briefing â€¢ Dynamic Scoped Records',
  };
}
