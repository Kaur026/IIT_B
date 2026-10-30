import { calculateAge, DEMO_CURRENT_DATE } from './casework.ts';
import type { BeneficiaryRecord } from '../store/mockStore.ts';

export interface BeneficiaryDirectoryFilters {
  search: string;
  cohort: string;
  status: string;
  monitoring: 'all' | 'flagged' | 'stale';
}

export function filterBeneficiaries(
  beneficiaries: BeneficiaryRecord[],
  filters: BeneficiaryDirectoryFilters,
  today = DEMO_CURRENT_DATE,
): BeneficiaryRecord[] {
  const query = filters.search.trim().toLowerCase();
  return beneficiaries.filter((beneficiary) => {
    const age = calculateAge(beneficiary.dob, today, beneficiary.category, beneficiary.gender);
    if (filters.cohort === 'children0to6m' && age.cohort !== 'children0to6m') return false;
    if (filters.cohort === 'children6mTo3y' && age.cohort !== 'children6mTo3y') return false;
    if (filters.cohort === 'children3to6y' && age.cohort !== 'children3to6y') return false;
    if (filters.cohort === 'adolescentGirls' && age.cohort !== 'adolescentGirls') return false;
    if (filters.cohort === 'pregnant' && beneficiary.category !== 'pregnant') return false;
    if (filters.cohort === 'lactating' && beneficiary.category !== 'lactating') return false;
    if (filters.status !== 'all' && beneficiary.status !== filters.status) return false;
    if (filters.monitoring === 'flagged' && !beneficiary.hasActiveFlag) return false;
    if (filters.monitoring === 'stale') {
      if (beneficiary.category !== 'child_under_6') return false;
      if (beneficiary.lastMeasurementDate) {
        const daysSinceMeasurement = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${beneficiary.lastMeasurementDate}T00:00:00Z`)) / 86400000;
        if (daysSinceMeasurement <= 35) return false;
      }
    }
    if (query && ![
      beneficiary.name,
      beneficiary.id,
      beneficiary.centreCode,
      beneficiary.assignedAww,
      beneficiary.caregiverKinship,
      beneficiary.category,
      age.cohortLabel,
    ].some((value) => value.toLowerCase().includes(query))) return false;
    return true;
  });
}

export function paginateBeneficiaries<T>(records: T[], page: number, pageSize: number): T[] {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const start = (safePage - 1) * safePageSize;
  return records.slice(start, start + safePageSize);
}
