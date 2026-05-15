export type TPeeDb = {
  id: number;
  created_at: string;
};

export type TPee = {
  id: number;
  createdAt: string;
};

export type TPostPee = Omit<TPee, 'id' | 'createdAt'>;
