import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { desc, eq, sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { getTraceId } from "@/shared/trace"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { telemetryEvents, iterationTasks } from "@/shared/schema"
import { ensureTelemetryTable } from "@/server/db/ensureTelemetryTable"
import { ensureIterationTasksTable } from "@/server/db/ensureIterationTasksTable"
import { getSessionFromRequest } from "@/shared/session"

export const runtime = "nodejs"

const adminAccount = (process.env.ADMIN_ACCOUNT ?? "admin").trim()
const adminPanelEnabled = process.env.ADMIN_PANEL_ENABLED === "1" || process.env.NODE_ENV !== "production"

function deny(traceId: string, code: string, message: string, status: number): Response {
  return NextResponse.json(makeApiErr(traceId, code, message), { status })
}

async function requireAdmin(req: NextRequest, traceId: string): Promise<{ userId: string; account: string } | Response> {
  if (!adminPanelEnabled) return deny(traceId, "ADMIN_PANEL_DISABLED", "管理员后台未启用", 404)
  const session = await getSessionFromRequest(req)
  if (!session?.userId) return deny(traceId, "AUTH_REQUIRED", "未登录或登录已过期", 401)
  if (session.account !== adminAccount) return deny(traceId, "ADMIN_REQUIRED", "需要管理员权限", 403)
  return { userId: session.userId, account: session.account }
}

const listQuerySchema = z.object({
  limit: z.string().trim().optional()
})

const generateBodySchema = z.object({
  hours: z.number().int().min(1).max(24 * 30).optional(),
  maxTasks: z.number().int().min(1).max(10).optional()
})

type FunnelStats = {
  windowHours: number
  counts: Record<string, number>
  rates: { generateRate: number; chatRate: number }
}

async function computeTvcFunnel(hours: number): Promise<FunnelStats> {
  await ensureTelemetryTable()
  const db = await getDb({ telemetryEvents })

  const byEvent = await db.execute(sql`
    select event as name, count(distinct trace_id) as uv
    from telemetry_events
    where page = '/tvc'
      and created_at >= now() - (${hours}::text || ' hours')::interval
    group by event
  `)

  const counts: Record<string, number> = {}
  for (const row of (byEvent.rows ?? []) as Array<{ name: string; uv: unknown }>) {
    const n = typeof row.uv === "number" ? row.uv : Number(row.uv ?? 0)
    counts[row.name] = Number.isFinite(n) ? n : 0
  }

  const opens = counts.tvc_open ?? 0
  const generates = counts.tvc_generate_shotlist_clicked ?? 0
  const chats = counts.tvc_chat_submitted ?? 0

  const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 10000) / 100 : 0)

  return {
    windowHours: hours,
    counts: { ...counts, tvc_open: opens, tvc_generate_shotlist_clicked: generates, tvc_chat_submitted: chats },
    rates: {
      generateRate: rate(generates, opens),
      chatRate: rate(chats, opens)
    }
  }
}

function buildTasks(stats: FunnelStats): Array<{ title: string; spec: Record<string, unknown> }> {
  const opens = stats.counts.tvc_open ?? 0
  const generates = stats.counts.tvc_generate_shotlist_clicked ?? 0
  const chats = stats.counts.tvc_chat_submitted ?? 0

  const baseline = {
    windowHours: stats.windowHours,
    counts: { opens, generates, chats },
    rates: stats.rates,
    topStyles: []
  }

  if (opens <= 0) {
    return [
      {
        title: "验证 /tvc 漏斗埋点可用性",
        spec: {
          goal: "确保 TVC 漏斗数据可以稳定采集，用于后续自动迭代",
          hypothesis: "当前没有采集到 tvc_open 等事件，可能是没有触发、网络/权限阻断或写库失败",
          change_scope: ["telemetry", "tvc"],
          success_metrics: [
            { metric: "tvc_open_uv", target: ">= 10 / 24h", current: opens, windowHours: stats.windowHours }
          ],
          guardrails: [{ metric: "telemetry_write_error_rate", target: "< 1%" }],
          verification: ["访问 /tvc 并操作 3 次，检查 telemetry_events 是否写入", "调用 /api/internal/telemetry/tvc-funnel 返回非 0"],
          rollback: ["无需回滚：仅观测与修复埋点链路"],
          baseline
        }
      }
    ]
  }

  const tasks: Array<{ title: string; spec: Record<string, unknown> }> = []

  if (generates / opens < 0.3) {
    tasks.push({
      title: "提升 Shotlist 生成点击率",
      spec: {
        goal: "提高用户在 /tvc 触发生成 shotlist 的比例",
        hypothesis: "生成入口的可见性与引导不足，用户停留但没有推进到生成步骤",
        change_scope: ["tvc_ui", "ux_copy", "telemetry"],
        success_metrics: [{ metric: "generateRate", target: "+10% absolute", current: stats.rates.generateRate, windowHours: stats.windowHours }],
        guardrails: [{ metric: "tvc_error_rate", target: "no increase" }],
        verification: ["调整主操作按钮层级与文案，引导用户先完善需求再生成", "检查 tvc_generate_shotlist_clicked uv 提升"],
        rollback: ["feature flag 关闭该改动"],
        baseline
      }
    })
  }

  if (chats / opens < 0.1) {
    tasks.push({
      title: "提升 Chat 引导使用率（让用户用自然语言描述）",
      spec: {
        goal: "让更多用户通过 chat 描述需求，形成可复用 brief",
        hypothesis: "用户不知道该说什么，缺少示例/快捷提示导致 chat 不被使用",
        change_scope: ["tvc_ui", "prompting", "telemetry"],
        success_metrics: [{ metric: "chatRate", target: "+5% absolute", current: stats.rates.chatRate, windowHours: stats.windowHours }],
        guardrails: [{ metric: "tvc_bounce_rate_proxy", target: "no increase" }],
        verification: ["增加 3 个一键示例 prompt chip（仅前端）并埋点点击", "检查 tvc_chat_submitted uv 提升"],
        rollback: ["feature flag 关闭该改动"],
        baseline
      }
    })
  }

  if (tasks.length === 0) {
    tasks.push({
      title: "细化 TVC 漏斗指标（为自动迭代做更强信号）",
      spec: {
        goal: "为后续自动迭代提供更明确的行为信号",
        hypothesis: "当前漏斗事件太粗，难以定位流失原因",
        change_scope: ["telemetry"],
        success_metrics: [{ metric: "new_events_added", target: ">= 3", current: 0 }],
        guardrails: [{ metric: "perf_impact", target: "negligible" }],
        verification: ["新增 brief_submit、drawer_open、need_more_styles_clicked 等细粒度事件"],
        rollback: ["可直接停止上报新事件"],
        baseline
      }
    })
  }

  return tasks
}

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const admin = await requireAdmin(req, traceId)
  if (admin instanceof Response) return admin

  const url = new URL(req.url)
  const parsedQuery = listQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsedQuery.success) return deny(traceId, "VALIDATION_FAILED", "请求参数不正确", 400)
  const limit = Math.max(1, Math.min(50, Number(parsedQuery.data.limit ?? "20") || 20))

  await ensureIterationTasksTable()
  const db = await getDb({ iterationTasks })
  const rows = await db
    .select({
      id: iterationTasks.id,
      module: iterationTasks.module,
      title: iterationTasks.title,
      status: iterationTasks.status,
      spec: iterationTasks.spec,
      createdAt: iterationTasks.createdAt,
      updatedAt: iterationTasks.updatedAt
    })
    .from(iterationTasks)
    .where(eq(iterationTasks.module, "tvc"))
    .orderBy(desc(iterationTasks.createdAt))
    .limit(limit)

  return NextResponse.json(makeApiOk(traceId, { items: rows }), { status: 200 })
}

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const admin = await requireAdmin(req, traceId)
  if (admin instanceof Response) return admin

  const parsed = generateBodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return deny(traceId, "VALIDATION_FAILED", "请求参数不正确", 400)

  const hours = parsed.data?.hours ?? 24
  const maxTasks = parsed.data?.maxTasks ?? 3

  const start = Date.now()
  try {
    const funnel = await computeTvcFunnel(hours)
    const tasks = buildTasks(funnel).slice(0, maxTasks)

    await ensureIterationTasksTable()
    const db = await getDb({ iterationTasks })

    const inserted = await db
      .insert(iterationTasks)
      .values(
        tasks.map((t) => ({
          module: "tvc",
          title: t.title,
          status: "proposed",
          spec: t.spec,
          updatedAt: new Date()
        }))
      )
      .returning({
        id: iterationTasks.id,
        module: iterationTasks.module,
        title: iterationTasks.title,
        status: iterationTasks.status,
        spec: iterationTasks.spec,
        createdAt: iterationTasks.createdAt
      })

    logger.info({
      event: "tvc_iteration_tasks_generated",
      module: "telemetry",
      traceId,
      message: "生成 TVC 迭代任务单成功",
      count: inserted.length,
      hours,
      durationMs: Date.now() - start
    })

    return NextResponse.json(makeApiOk(traceId, { items: inserted, funnel }), { status: 200 })
  } catch (err) {
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "tvc_iteration_tasks_generate_failed",
      module: "telemetry",
      traceId,
      message: "生成 TVC 迭代任务单失败",
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })
    return NextResponse.json(makeApiErr(traceId, "TASKS_GENERATE_FAILED", "生成失败"), { status: 500 })
  }
}
