export type WriteResult<T> = { ok: true; value: T } | { ok: false; message: string };
