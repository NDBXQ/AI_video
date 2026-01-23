import type { ApiOutline, ApiShot, StoryboardItem } from "../types"

export const getEmptyShotContent = () => {
  return {
    background: { background_name: "", status: "" },
    roles: [],
    role_items: [],
    other_items: [],
    shoot: {
      shot_angle: "",
      angle: "",
      camera_movement: "",
      composition: "",
    },
    bgm: ""
  }
}

export const normalizeShotsToItems = (shots: ApiShot[]): StoryboardItem[] => {
  return shots.map((row) => {
    const base: StoryboardItem = {
      id: row.id,
      scene_no: row.sequence,
      storyboard_text: row.storyboardText,
      shot_info: { shot_duration: 0, cut_to: row.shotCut, shot_style: "" },
      shot_content: getEmptyShotContent(),
      scriptContent: row.scriptContent,
      frames: row.frames ?? {},
      videoInfo: row.videoInfo ?? {}
    }

    const content = row.scriptContent
    if (!content || typeof content !== "object") return base

    const videoScript = extractVideoScript(content)
    if (!videoScript) return base

    const safeString = (value: unknown) => (typeof value === "string" ? value : "")
    const safeNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0)
    const safeStringArray = (value: unknown) => (Array.isArray(value) ? (value.filter((v) => typeof v === "string") as string[]) : [])

    const shot = videoScript["shot"]
    const anyShot = shot && typeof shot === "object" ? (shot as Record<string, unknown>) : {}

    const rawShotContent = videoScript["shot_content"]
    const anyShotContent = rawShotContent && typeof rawShotContent === "object" ? (rawShotContent as Record<string, unknown>) : {}

    const rawBackground = anyShotContent["background"]
    const anyBackground = rawBackground && typeof rawBackground === "object" ? (rawBackground as Record<string, unknown>) : {}

    const rawShoot = anyShotContent["shoot"]
    const anyShoot = rawShoot && typeof rawShoot === "object" ? (rawShoot as Record<string, unknown>) : {}

    const rawRoles = anyShotContent["roles"]
    const roles =
      Array.isArray(rawRoles)
        ? rawRoles
            .filter((r) => r && typeof r === "object")
            .map((r) => {
              const anyRole = r as Record<string, unknown>
              const rawSpeak = anyRole["speak"]
              const anySpeak = rawSpeak && typeof rawSpeak === "object" ? (rawSpeak as Record<string, unknown>) : null
              const speak =
                anySpeak
                  ? {
                      time_point: safeNumber(anySpeak["time_point"]),
                      tone: safeString(anySpeak["tone"]),
                      content: safeString(anySpeak["content"]),
                      speed: safeNumber(anySpeak["speed"]),
                      emotion: safeString(anySpeak["emotion"])
                    }
                  : null
              return {
                role_name: safeString(anyRole["role_name"]),
                appearance_time_point: safeNumber(anyRole["appearance_time_point"]),
                location_info: safeString(anyRole["location_info"]),
                action: safeString(anyRole["action"]),
                expression: safeString(anyRole["expression"]),
                speak
              }
            })
        : []

    const merged: StoryboardItem = { ...base }
    merged.shot_info = {
      shot_duration: safeNumber(anyShot["shot_duration"]),
      cut_to: base.shot_info.cut_to,
      shot_style: safeString(anyShot["shot_style"])
    }
    merged.shot_content = {
      background: {
        background_name: safeString(anyBackground["background_name"]),
        status: safeString(anyBackground["status"])
      },
      roles,
      role_items: safeStringArray(anyShotContent["role_items"]),
      other_items: safeStringArray(anyShotContent["other_items"]),
      shoot: {
        shot_angle: safeString(anyShoot["shot_angle"]),
        angle: safeString(anyShoot["angle"]),
        camera_movement: safeString(anyShoot["camera_movement"]),
        composition: safeString(anyShoot["composition"])
      },
      bgm: safeString(anyShotContent["bgm"])
    }
    return merged
  })
}

export const buildOutlineTooltipText = (outline: ApiOutline | undefined): string => {
  if (!outline) return ""
  const outlineText = outline.outlineText?.trim() ?? ""
  return `${outlineText}`
}

export const extractVideoScript = (data: unknown): Record<string, unknown> | null => {
  if (!data || typeof data !== "object") return null
  const anyData = data as Record<string, unknown>
  const directVideoScriptLike = anyData["shot_content"]
  if (directVideoScriptLike && typeof directVideoScriptLike === "object") return anyData
  const direct = anyData["video_script"]
  if (direct && typeof direct === "object") return direct as Record<string, unknown>
  const nested = anyData["data"]
  if (nested && typeof nested === "object") {
    const nestedAny = nested as Record<string, unknown>
    const videoScript = nestedAny["video_script"]
    if (videoScript && typeof videoScript === "object") return videoScript as Record<string, unknown>
  }
  return null
}
