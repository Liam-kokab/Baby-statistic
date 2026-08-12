import { appEventsRepository } from '../repositories/appEventsRepository';
import { toOsloLocal, toOsloIso, nowOslo } from '../utils/time';
import type { TBackupStatus } from 'baby-statistic-common';

const BACKUP_EVENT_ID = 'BACKUP' as const;

export const appEventsService = {
  reportBackupSuccess: (timestamp?: string): TBackupStatus => {
    const localValue = timestamp ? toOsloLocal(timestamp) : nowOslo();
    const event = appEventsRepository.upsert(BACKUP_EVENT_ID, localValue);
    return { lastBackupAt: toOsloIso(event.value) };
  },

  getBackupStatus: (): TBackupStatus => {
    const event = appEventsRepository.findById(BACKUP_EVENT_ID);
    return { lastBackupAt: event ? toOsloIso(event.value) : null };
  },
};

