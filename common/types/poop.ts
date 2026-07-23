export type TPoopDb = {
  id: number;
  created_at: string;
  baby_id: number;
  created_by: number;
};

export type TPoop = {
  id: number;
  createdAt: string;
};

export type TPostPoop = Omit<TPoop, 'id' | 'createdAt'>;
