export type TMilestoneDb = {
  id: number;
  title: string;
  description: string | null;
  occurred_at: string;
  baby_id: number;
  created_by: number;
  created_at: string;
};

export type TMilestone = {
  id: number;
  title: string;
  description: string | null;
  occurredAt: string;
  createdAt: string;
};

export type TPostMilestone = {
  title: string;
  description?: string | null;
  occurredAt?: string;
};

export type TUpdateMilestone = {
  title?: string;
  description?: string | null;
  occurredAt?: string;
};

