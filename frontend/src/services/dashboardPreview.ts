export interface DashboardUnavailableContext {
  apiConfigured: boolean;
  providerSessionActive: boolean;
}

export interface DashboardUnavailableState {
  statusLabel: string;
  missingIntegration: string;
  message: string;
}

/** Describes why the public overview cannot show operational metrics without fabricating data. */
export function getDashboardUnavailableState(
  context: DashboardUnavailableContext,
): DashboardUnavailableState {
  if (context.providerSessionActive) {
    return {
      statusLabel: 'Trusted role and scope required',
      missingIntegration: 'A server-resolved B2 role, organization scope, and approved operational data source',
      message: 'A provider session confirms sign-in only. B2 must resolve and authorize the account’s current role and organizational scope before operational dashboard data can be shown.',
    };
  }

  if (!context.apiConfigured) {
    return {
      statusLabel: 'B2 API not configured',
      missingIntegration: 'A B2 API origin plus trusted identity, role, scope, and operational data repositories',
      message: 'This deployment has no configured B2 API origin. Prepared aggregates and operational records remain unavailable until the backend and its trusted authorization data sources are configured and reviewed.',
    };
  }

  return {
    statusLabel: 'Operational access unavailable',
    missingIntegration: 'A trusted sign-in and server-resolved role and organizational scope',
    message: 'A B2 API origin is configured, but this public overview has no authenticated operational profile. An API URL alone does not grant access to scoped beneficiary, measurement, task, or referral data.',
  };
}