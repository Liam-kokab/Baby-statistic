import { useCallback, useEffect, useState } from 'react';
import type { TBackupStatus } from 'baby-statistic-common';
import { authFetch } from './authFetch';

/** How often to re-poll the backup status from the API. */
const POLL_MS = 5 * 60_000;

export type TUseBackupStatusResult = {
  /** `Date.now()`-comparable epoch ms of the last successful backup, or `null` if unknown/none yet. */
  lastBackupAt: number | null;
  isError: boolean;
};

/**
 * Fetches the global "last successful backup" status (`GET /api/app-events/backup`) once on
 * mount and on a polling interval, for the `BackupStatusDot`. This is app-wide (not per-baby
 * or per-page) data, unlike `useDataFreshness`.
 */
const useBackupStatus = (): TUseBackupStatusResult => {
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [isError, setIsError] = useState<boolean>(false);

  const load = useCallback(async (): Promise<void> => {
    const result = await authFetch<TBackupStatus>('/api/app-events/backup');
    if (result.ok) {
      setLastBackupAt(result.data.lastBackupAt !== null ? new Date(result.data.lastBackupAt).getTime() : null);
      setIsError(false);
    } else {
      setIsError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return { lastBackupAt, isError };
};

export default useBackupStatus;



