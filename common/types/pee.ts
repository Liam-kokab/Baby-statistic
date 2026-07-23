export type TPeeDb = {
  id: number;
  created_at: string;
  baby_id: number;
  created_by: number;
};

export type TPee = {
  id: number;
  createdAt: string;
};

export type TPostPee = Omit<TPee, 'id' | 'createdAt'>;
