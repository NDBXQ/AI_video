import type { ApiErr, ApiOk } from "@/shared/api"

type ApiResult<T> = ApiOk<T> | ApiErr

function utf8Bytes(s: string): number {
  try {
    return new TextEncoder().encode(s).length
  } catch {
    return s.length
  }
}

function shrinkShortDramaPayload(input: {
  planningResult: any
  worldSetting: any
  characterSetting: any
}): { planning_result: unknown; world_setting: unknown; character_setting: unknown } {
  const planning = input.planningResult ?? null
  const world = input.worldSetting ?? null
  const character = input.characterSetting ?? null

  const shrinkPlanning = (() => {
    const theme = planning?.theme_module ?? null
    const params = planning?.parameter_module ?? null
    return { theme_module: theme, parameter_module: params }
  })()

  const shrinkWorld = (() => {
    const w = world?.world_setting ?? world ?? null
    if (!w || typeof w !== "object") return w
    const anyW = w as any
    return {
      world_status: anyW.world_status,
      world_rules: anyW.world_rules,
      location_setting: anyW.location_setting,
      time_setting: anyW.time_setting
    }
  })()

  const shrinkCharacter = (() => {
    const c = character?.character_settings ?? character ?? null
    const list = Array.isArray(c?.characters) ? c.characters : []
    return {
      characters: list.map((it: any) => {
        return {
          character_name: it?.character_name,
          character_type: it?.character_type,
          age: it?.age,
          occupation: it?.occupation,
          script_setting: it?.script_setting,
          personality: it?.personality,
          tone: it?.tone,
          cover_description: it?.cover_description
        }
      })
    }
  })()

  return {
    planning_result: shrinkPlanning,
    world_setting: shrinkWorld,
    character_setting: shrinkCharacter
  }
}

export function buildOutlineStoryTextFromShortDrama(input: {
  planningResult: any
  worldSetting: any
  characterSetting: any
  maxBytes?: number
}): string {
  const maxBytes = Math.max(8_000, Math.floor(input.maxBytes ?? 49_000))
  const full = {
    planning_result: input.planningResult,
    world_setting: input.worldSetting,
    character_setting: input.characterSetting
  }
  const fullText = JSON.stringify(full)
  if (utf8Bytes(fullText) <= maxBytes) return fullText

  const shrunk = shrinkShortDramaPayload({
    planningResult: input.planningResult,
    worldSetting: input.worldSetting,
    characterSetting: input.characterSetting
  })
  const shrunkText = JSON.stringify(shrunk)
  if (utf8Bytes(shrunkText) <= maxBytes) return shrunkText

  const minimal = JSON.stringify({ planning_result: shrunk.planning_result })
  if (utf8Bytes(minimal) <= maxBytes) return minimal

  throw new Error("短剧策划结果过长，无法生成大纲（story_text 超出限制）")
}

async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  return (await res.json()) as ApiResult<T>
}

export async function callShortDramaPlanning(userRequirement: string): Promise<unknown> {
  const json = await postJson<unknown>("/api/coze/short-drama-planning", { user_requirement: userRequirement })
  if (!json || (json as ApiErr).ok === false) throw new Error((json as ApiErr)?.error?.message ?? "短剧剧本策划失败")
  return (json as ApiOk<unknown>).data
}

export async function callShortDramaWorldSetting(input: {
  genres: string[]
  worldview_setting: string
  core_conflict: string
}): Promise<unknown> {
  const json = await postJson<unknown>("/api/coze/short-drama-world-setting", input)
  if (!json || (json as ApiErr).ok === false) throw new Error((json as ApiErr)?.error?.message ?? "短剧世界观设定失败")
  return (json as ApiOk<unknown>).data
}

export async function callShortDramaCharacterSettings(input: {
  genres: string[]
  core_conflict: string
  worldview_setting: string
  protagonist_setting: string
}): Promise<unknown> {
  const json = await postJson<unknown>("/api/coze/short-drama-character-settings", input)
  if (!json || (json as ApiErr).ok === false) throw new Error((json as ApiErr)?.error?.message ?? "短剧角色设定失败")
  return (json as ApiOk<unknown>).data
}

export async function patchStoryShortDramaMetadata(storyId: string, input: {
  planningResult: unknown
  worldSetting: unknown
  characterSetting: unknown
}): Promise<void> {
  const res = await fetch(`/api/library/stories/${encodeURIComponent(storyId)}/metadata`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      shortDrama: {
        planningResult: input.planningResult,
        worldSetting: input.worldSetting,
        characterSetting: input.characterSetting
      }
    })
  })
  const json = (await res.json().catch(() => null)) as ApiErr | ApiOk<unknown> | null
  if (!res.ok || !json || (json as ApiErr).ok === false) {
    const errJson = (json as ApiErr | null) ?? null
    throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
  }
}
