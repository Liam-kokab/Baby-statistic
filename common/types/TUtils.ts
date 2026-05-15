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

