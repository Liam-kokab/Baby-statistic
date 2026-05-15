export type TServedMilkStatus = 'FRIDGE' | 'FREEZER' | 'USED' | 'EXPIRED';

export type TServedMilkDb = {
  id: number;
  amount: number;
  original_amount: number;
  status: TServedMilkStatus;
  expiry_date: string | null;
  created_at: string;
};

export type TServedMilk = {
  id: number;
  amount: number;
  originalAmount: number;
  status: TServedMilkStatus;
  expiryDate: string | null;
  createdAt: string;
};

export type TPostServedMilk = Omit<TServedMilk, 'id' | 'createdAt'>;

/** Actual POST body shape sent by the client — `originalAmount` and `expiryDate` are auto-computed server-side. */
export type TCreateServedMilk = Pick<TServedMilk, 'amount' | 'status'>;

export type TServedMilkTotal = {
  fridge: number;
  freezer: number;
  total: number;
};
