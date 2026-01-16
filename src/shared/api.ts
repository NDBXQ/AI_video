export type ApiOk<T> = {
  ok: true
  data: T
  traceId: string
}

export type ApiErr = {
  ok: false
  error: { code: string; message: string }
  traceId: string
}

export function makeApiOk<T>(traceId: string, data: T): ApiOk<T> {
  return { ok: true, data, traceId }
}

export function makeApiErr(traceId: string, code: string, message: string): ApiErr {
  return { ok: false, error: { code, message }, traceId }
}

