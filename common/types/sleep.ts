export type TSleepDb = {
  id: number;
  start: string;
  end: string | null;
  created_at: string;
};

export type TSleep = {
  id: number;
  start: string;
  end: string | null;
  createdAt: string;
};

export type TPostSleep = Omit<TSleep, 'id' | 'createdAt'>;
