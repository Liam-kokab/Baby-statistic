import type { TDataOrError, TRefreshResponse } from 'baby-statistic-common';
import { authStore } from './authStore';

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
      return { ok: true, data };
    }

    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: `HTTP error! status: ${res.status}, message: ${errorText}`, responseCode: res.status };
    }
    const data = res.status === 204 ? (null as T) : await res.json();
    return { ok: true, data };
  } catch (error) {
    console.error('Fetch error:', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

