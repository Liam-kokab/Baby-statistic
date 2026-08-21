import type { TDataOrError, TRefreshResponse } from 'baby-statistic-common';
import { authStore } from './authStore';
import { getWsClientId } from './wsClientId';
import { clearResourceCache, markResourceDirty } from './resourceCache';
import { getResourceForUrl } from './resourceKeys';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let isRefreshing = false;
let refreshQueue: Array<(ok: boolean) => void> = [];

const processQueue = (ok: boolean): void => {
  refreshQueue.forEach((cb) => cb(ok));
  refreshQueue = [];
};

const tryRefresh = async (): Promise<boolean> => {
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshQueue.push(resolve);
    });
  }
  isRefreshing = true;
  const refreshToken = authStore.getRefreshToken();
  if (!refreshToken) {
    isRefreshing = false;
    processQueue(false);
    return false;
  }
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      authStore.clear();
      clearResourceCache(); // security: don't let cached data leak into the next login
      processQueue(false);
      isRefreshing = false;
      return false;
    }
    const data = (await res.json()) as TRefreshResponse;
    authStore.updateTokens(data.accessToken, data.refreshToken);
    processQueue(true);
    isRefreshing = false;
    return true;
  } catch {
    authStore.clear();
    clearResourceCache(); // security: don't let cached data leak into the next login
    processQueue(false);
    isRefreshing = false;
    return false;
  }
};

export const authFetch = async <T>(url: string, options: RequestInit = {}): Promise<TDataOrError<T>> => {
  const token = authStore.getAccessToken();
  const headers = new Headers(options.headers ?? {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
  // Lets the server skip echoing a WebSocket "update" notification back to the tab that
  // caused it (see wsClientId.ts) — safe to send on every request, the server only reads it
  // for mutating methods.
  headers.set('X-Ws-Client-Id', getWsClientId());

  // Marks this request's resource dirty in the local cache (see resourceCache.ts) right after a
  // successful mutation — needed *in addition to* the server's WebSocket broadcast, since that
  // broadcast deliberately skips this exact tab (echo suppression above). Without this, another
  // page in the *same* tab whose cached data depends on the same resource (e.g. HomePage's
  // summary and SleepPage's summary both depend on `sleep`) would keep showing stale data after
  // this tab's own action, since the tab never gets its own "something changed" notification.
  const markDirtyIfMutating = (): void => {
    if (!MUTATING_METHODS.has((options.method ?? 'GET').toUpperCase())) return;
    const resource = getResourceForUrl(url);
    if (resource) markResourceDirty(resource);
  };

  try {
    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      const refreshed = await tryRefresh();
      if (!refreshed) {
        window.location.href = '/login';
        return { ok: false, error: 'Session expired', responseCode: 401 };
      }
      // Retry with new token
      const newToken = authStore.getAccessToken();
      if (newToken) headers.set('Authorization', `Bearer ${newToken}`);
      const retryRes = await fetch(url, { ...options, headers });
      if (!retryRes.ok) {
        const errorText = await retryRes.text();
        return { ok: false, error: `HTTP error! status: ${retryRes.status}, message: ${errorText}`, responseCode: retryRes.status };
      }
      const data = retryRes.status === 204 ? (null as T) : await retryRes.json();
      markDirtyIfMutating();
      return { ok: true, data };
    }

    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: `HTTP error! status: ${res.status}, message: ${errorText}`, responseCode: res.status };
    }
    const data = res.status === 204 ? (null as T) : await res.json();
    markDirtyIfMutating();
    return { ok: true, data };
  } catch (error) {
    console.error('Fetch error:', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

