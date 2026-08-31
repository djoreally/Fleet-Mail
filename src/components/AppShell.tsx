import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { neon } from '../lib/neon';
import { APP_ROUTES, navigate, usePathname } from '../lib/navigation';
import { setActiveNeonAuthSession } from '../lib/neonAuthClient';

export interface FleetAuthUser {
  id?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export interface FleetAuthSession {
  user?: FleetAuthUser | null;
  [key: string]: unknown;
}

export interface AppShellContext {
  session: FleetAuthSession | null;
  user: FleetAuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  refreshSession: () => Promise<FleetAuthSession | null>;
  signOut: () => Promise<void>;
  navigate: typeof navigate;
}

type Screen = ReactNode | ((context: AppShellContext) => ReactNode);

export interface AppShellProps {
  home: Screen;
  signIn: Screen;
  signUp: Screen;
  forgotPassword: Screen;
  resetPassword: Screen;
  app: Screen;
  loading?: ReactNode;
  notFound?: Screen;
}

function extractSession(response: unknown): FleetAuthSession | null {
  if (!response || typeof response !== 'object') return null;

  const value = response as Record<string, unknown>;
  if ('data' in value) {
    const data = value.data;
    if (!data || typeof data !== 'object') return null;
    const nested = data as Record<string, unknown>;
    if ('session' in nested && nested.session && typeof nested.session === 'object') {
      const session = nested.session as FleetAuthSession;
      return { ...session, user: (nested.user as FleetAuthUser | null | undefined) ?? session.user };
    }
    return data as FleetAuthSession;
  }

  if ('session' in value && value.session && typeof value.session === 'object') {
    const session = value.session as FleetAuthSession;
    return { ...session, user: (value.user as FleetAuthUser | null | undefined) ?? session.user };
  }

  return value as FleetAuthSession;
}

function sessionUser(session: FleetAuthSession | null): FleetAuthUser | null {
  return session?.user && typeof session.user === 'object' ? session.user : null;
}

function sessionToken(session: FleetAuthSession | null): string | null {
  if (!session) return null;
  const value = session as Record<string, unknown>;
  for (const key of ['token', 'accessToken', 'access_token', 'jwt']) {
    if (typeof value[key] === 'string' && value[key]) return value[key] as string;
  }
  if (value.session && typeof value.session === 'object') return sessionToken(value.session as FleetAuthSession);
  return null;
}

function renderScreen(screen: Screen, context: AppShellContext): ReactNode {
  return typeof screen === 'function' ? screen(context) : screen;
}

export function AppShell({
  home,
  signIn,
  signUp,
  forgotPassword,
  resetPassword,
  app,
  loading,
  notFound,
}: AppShellProps) {
  const pathname = usePathname();
  const [session, setSession] = useState<FleetAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setAuthError(null);
    try {
      const response = await neon.auth.getSession();
      const nextSession = extractSession(response);
      setSession(nextSession);
      setActiveNeonAuthSession(sessionToken(nextSession), sessionUser(nextSession));
      return nextSession;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restore your session.';
      setAuthError(message);
      setSession(null);
      setActiveNeonAuthSession(null, null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await neon.auth.signOut();
    } finally {
      setSession(null);
      navigate(APP_ROUTES.signIn, { replace: true });
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const user = sessionUser(session);
  const isAuthenticated = Boolean(session && (user || 'token' in session || 'session' in session));
  const context = useMemo<AppShellContext>(() => ({
    session,
    user,
    isAuthenticated,
    isLoading,
    authError,
    refreshSession,
    signOut,
    navigate,
  }), [session, user, isAuthenticated, isLoading, authError, refreshSession, signOut]);

  useEffect(() => {
    if (isLoading) return;

    if (pathname === APP_ROUTES.app && !isAuthenticated) {
      navigate(APP_ROUTES.signIn, { replace: true });
    }

    if (
      isAuthenticated &&
      [APP_ROUTES.signIn, APP_ROUTES.signUp, APP_ROUTES.forgotPassword, APP_ROUTES.resetPassword].includes(pathname as never)
    ) {
      navigate(APP_ROUTES.app, { replace: true });
    }
  }, [isAuthenticated, isLoading, pathname]);

  if (isLoading && pathname === APP_ROUTES.app) {
    return <>{loading ?? null}</>;
  }

  switch (pathname) {
    case APP_ROUTES.home:
      return <>{renderScreen(home, context)}</>;
    case APP_ROUTES.signIn:
      return <>{renderScreen(signIn, context)}</>;
    case APP_ROUTES.signUp:
      return <>{renderScreen(signUp, context)}</>;
    case APP_ROUTES.forgotPassword:
      return <>{renderScreen(forgotPassword, context)}</>;
    case APP_ROUTES.resetPassword:
      return <>{renderScreen(resetPassword, context)}</>;
    case APP_ROUTES.app:
      return isAuthenticated ? <>{renderScreen(app, context)}</> : <>{loading ?? null}</>;
    default:
      return <>{renderScreen(notFound ?? home, context)}</>;
  }
}
