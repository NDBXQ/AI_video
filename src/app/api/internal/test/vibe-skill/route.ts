import { NextResponse } from "next/server"
import { z } from "zod"
import { getTraceId } from "@/shared/trace"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { loadSkillInstructions } from "@/server/domains/tvc/vibeCreating/tools/vibeCreatingSkills"

const inputSchema = z.object({
  skill: z.string().trim().min(1).max(200)
})

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const json = await req.json().catch(() => null)
  const parsed = inputSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "入参格式不正确"), { status: 400 })

  try {
    const content = await loadSkillInstructions(parsed.data.skill)
    const preview = content.slice(0, 5000)
    return NextResponse.json(makeApiOk(traceId, { skill: parsed.data.skill, bytes: content.length, preview }), { status: 200 })
  } catch (err) {
    const msg = String((err as any)?.message ?? "内部错误")
    const code = String((err as any)?.code ?? "INTERNAL_ERROR")
    return NextResponse.json(makeApiErr(traceId, code, msg), { status: 500 })
  }
}
