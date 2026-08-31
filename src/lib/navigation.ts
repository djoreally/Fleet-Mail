import { useCallback, useEffect, useState } from 'react';

export const APP_ROUTES = {
  home: '/',
  signIn: '/sign-in',
  signUp: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  app: '/app',
} as const;

export type AppPath = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];

function normalizePathname(pathname: string): string {
  if (!pathname) return APP_ROUTES.home;
  const withoutTrailingSlash = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return withoutTrailingSlash || APP_ROUTES.home;
}

export function getPathname(): string {
  return typeof window === 'undefined' ? APP_ROUTES.home : normalizePathname(window.location.pathname);
}

export function navigate(path: AppPath | string, options?: { replace?: boolean }): void {
  if (typeof window === 'undefined') return;

  const destination = normalizePathname(path);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === destination) return;

  const method = options?.replace ? 'replaceState' : 'pushState';
  window.history[method]({}, '', destination);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(getPathname);

  useEffect(() => {
    const handleNavigation = () => setPathname(getPathname());
    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

  return pathname;
}

export function useNavigate() {
  return useCallback((path: AppPath | string, options?: { replace?: boolean }) => {
    navigate(path, options);
  }, []);
}
