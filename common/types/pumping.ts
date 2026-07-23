export type TPumpingDb = {
  id: number;
  created_at: string;
  baby_id: number;
  created_by: number;
};

export type TPumping = {
  id: number;
  createdAt: string;
};

export type TPostPumping = Omit<TPumping, 'id' | 'createdAt'>;

