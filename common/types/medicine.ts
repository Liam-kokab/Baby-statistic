export type TMedicineDb = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type TMedicine = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export type TPostMedicine = {
  name: string;
};

export type TMedicineLogDb = {
  id: number;
  medicine_id: number;
  taken_at: string;
  created_at: string;
};

export type TMedicineLog = {
  id: number;
  medicineId: number;
  takenAt: string;
  createdAt: string;
};

export type TPostMedicineLog = {
  takenAt?: string;
};

export type TMedicineWithLatestLog = TMedicine & {
  latestTakenAt: string | null;
};
