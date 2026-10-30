const MOCK_BACKED_ROUTES = ['/queue', '/referrals', '/reports', '/rules', '/profile'];

/** Routes whose current page implementation reads or mutates browser-local demo records. */
export function isMockBackedRoute(pathname: string): boolean {
  return MOCK_BACKED_ROUTES.includes(pathname)
    || pathname === '/beneficiaries/register'
    || (pathname.startsWith('/beneficiaries/') && pathname !== '/beneficiaries/register');
}

/** Real provider sessions must never be presented with local demo workflows as account data. */
export function shouldBlockMockWorkflowForProviderSession(pathname: string, hasProviderSession: boolean): boolean {
  return hasProviderSession && isMockBackedRoute(pathname);
}

export function isPreparedRecordsPage(pathname: string, hasProviderSession: boolean): boolean {
  return hasProviderSession && (pathname === '/beneficiaries' || pathname === '/measurements');
}

export function shouldShowMockDataDisclosure(
  pathname: string,
  hasProviderSession: boolean,
  mockDemoEnabled: boolean,
): boolean {
  if ((!mockDemoEnabled && !hasProviderSession) || isPreparedRecordsPage(pathname, hasProviderSession)) return false;
  return isMockBackedRoute(pathname)
    || (!hasProviderSession && (pathname === '/beneficiaries' || pathname === '/measurements'));
}
