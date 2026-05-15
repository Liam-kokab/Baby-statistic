export type TPoopDb = {
  id: number;
  created_at: string;
};

export type TPoop = {
  id: number;
  createdAt: string;
};

export type TPostPoop = Omit<TPoop, 'id' | 'createdAt'>;
