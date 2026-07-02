export type Result<T, E> = Success<T> | Failure<E>;

export type Success<T> = {
  ok: true;
  value: T;
};

export type Failure<E> = {
  ok: false;
  error: E;
};

export const success = <T>(value: T): Success<T> => ({ ok: true, value });

export const failure = <E>(error: E): Failure<E> => ({ ok: false, error });
