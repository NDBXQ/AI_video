export type RequestStatus = "idle" | "pending" | "success" | "error"

export type RequestError = {
  code: string
  message: string
}

export type RequestState<T> = {
  status: RequestStatus
  data?: T
  error?: RequestError
  traceId?: string
  startedAt?: number
  finishedAt?: number
}

