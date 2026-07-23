export type TDrankMilkSource = 'FRIDGE' | 'FREEZER' | 'BOOB';

export type TDrankMilkDb = {
  id: number;
  amount: number;
  source: TDrankMilkSource;
  created_at: string;
  baby_id: number;
  created_by: number;
};

export type TDrankMilk = {
  id: number;
  amount: number;
  source: TDrankMilkSource;
  createdAt: string;
};

export type TPostDrankMilk = Omit<TDrankMilk, 'id' | 'createdAt'> & {
  isNewBottle: boolean;
};
