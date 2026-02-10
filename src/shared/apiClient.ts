import type { ApiErr, ApiOk } from "@/shared/api"
import type { RequestError } from "@/shared/requestStatus"

export type ApiResult<T> = ApiOk<T> | ApiErr

function toRequestError(input: unknown): RequestError {
  const anyErr = input as { code?: unknown; message?: unknown }
  const code = typeof anyErr?.code === "string" && anyErr.code.trim() ? anyErr.code.trim() : "UNKNOWN"
  const message = typeof anyErr?.message === "string" && anyErr.message.trim() ? anyErr.message.trim() : "请求失败"
  return { code, message }
}

export async function apiFetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(input, init)
  } catch (e) {
    const err = toRequestError({ code: "NETWORK_ERROR", message: (e as any)?.message ?? "网络错误" })
    return { ok: false, error: err, traceId: "n/a" }
  }

  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    const err = toRequestError({ code: "NON_JSON_RESPONSE", message: `服务端响应不是 JSON（HTTP ${res.status}）` })
    return { ok: false, error: err, traceId: "n/a" }
  }

  const json = (await res.json().catch(() => null)) as ApiResult<T> | null
  if (!json) {
    const err = toRequestError({ code: "INVALID_JSON", message: `服务端返回 JSON 解析失败（HTTP ${res.status}）` })
    return { ok: false, error: err, traceId: "n/a" }
  }

  if (!res.ok) {
    if (json.ok === false) return json
    const err = toRequestError({ code: "HTTP_ERROR", message: `HTTP ${res.status}` })
    return { ok: false, error: err, traceId: (json as any)?.traceId ?? "n/a" }
  }

  return json
}

