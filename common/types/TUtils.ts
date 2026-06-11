export type TDataOrError<T> =
  | {
  ok: true;
  data: T;
}
  | {
  ok: false;
  error: string;
  responseCode?: number;
};

export type TPaginatedResponse<T> = {
  data: T[];
  total: number;
};

/** Returned by list endpoints when a `wished` count is requested. */
export type TWishedResult<T> = {
  items: T[];
  /** YYYY-MM-DD — the earliest Monday the server expanded back to. */
  actualFrom: string;
};

