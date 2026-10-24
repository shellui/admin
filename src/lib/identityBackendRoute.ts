/**
 * Content routes whose only API is identity-service.
 * The dashboard stays mounted so storage, hosting, and email can still render.
 */
export function routeShowsIdentityBackendMissing(pathname: string): boolean {
  if (pathname === '/' || pathname === '') return false;
  if (
    pathname.startsWith('/storage') ||
    pathname.startsWith('/hosting') ||
    pathname.startsWith('/email') ||
    pathname.startsWith('/app/')
  ) {
    return false;
  }
  return (
    pathname === '/company' ||
    pathname === '/groups' ||
    pathname === '/scim' ||
    pathname === '/personal-access-tokens' ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/oauth') ||
    pathname.startsWith('/events') ||
    pathname.startsWith('/identity') ||
    pathname.startsWith('/webhooks') ||
    pathname.startsWith('/actions')
  );
}
