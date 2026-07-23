export type TSleepDb = {
  id: number;
  start: string;
  end: string | null;
  created_at: string;
  baby_id: number;
  created_by: number;
};

export type TSleep = {
  id: number;
  start: string;
  end: string | null;
  createdAt: string;
};

export type TPostSleep = Omit<TSleep, 'id' | 'createdAt'>;
