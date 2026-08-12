/** IDs allowed in the `app_events` table — currently just the single backup-status row. */
export type TAppEventId = 'BACKUP';

export type TAppEventDb = {
  id: TAppEventId;
  value: string;
  updated_at: string;
};

export type TAppEvent = {
  id: TAppEventId;
  value: string;
  updatedAt: string;
};

/** Response shape for `GET /api/app-events/backup`. */
export type TBackupStatus = {
  /** ISO timestamp of the last successful backup, or `null` if none has ever been reported. */
  lastBackupAt: string | null;
};

/** Request body for `POST /api/app-events/backup`. */
export type TPostBackupStatus = {
  /** Defaults to now if omitted. */
  timestamp?: string;
};

