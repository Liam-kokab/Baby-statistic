export type TPumpingDb = {
  id: number;
  created_at: string;
};

export type TPumping = {
  id: number;
  createdAt: string;
};

export type TPostPumping = Omit<TPumping, 'id' | 'createdAt'>;

