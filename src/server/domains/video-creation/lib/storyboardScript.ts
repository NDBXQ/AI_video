import type { StoryboardScriptContent } from "@/shared/schema"

export function buildEmptyScript(): StoryboardScriptContent {
  return {
    shot_info: { cut_to: false, shot_style: "", shot_duration: 0 },
    shot_content: {
      bgm: "",
      roles: [],
      shoot: { angle: "", shot_angle: "", camera_movement: "" },
      background: { status: "", background_name: "" },
      role_items: [],
      other_items: []
    },
    video_content: {
      items: [],
      roles: [],
      background: { description: "", background_name: "" },
      other_items: []
    }
  }
}

export function normalizeEntityCategory(input: unknown): "background" | "role" | "item" {
  return input === "role" || input === "item" || input === "background" ? input : "background"
}

export function renameEntityInScript(current: StoryboardScriptContent, input: { category: string; from: string; to: string }): StoryboardScriptContent {
  const from = input.from.trim()
  const to = input.to.trim()
  if (!from || !to || from === to) return current
  const next = structuredClone(current)
  if (input.category === "role") {
    for (const list of [next.shot_content?.roles, next.video_content?.roles]) {
      if (!Array.isArray(list)) continue
      for (const r of list as any[]) {
        if (r && typeof r.role_name === "string" && r.role_name.trim() === from) r.role_name = to
      }
    }
    return next
  }
  if (input.category === "background") {
    const bg1 = next.shot_content?.background as any
    if (bg1 && typeof bg1.background_name === "string" && bg1.background_name.trim() === from) bg1.background_name = to
    const bg2 = next.video_content?.background as any
    if (bg2 && typeof bg2.background_name === "string" && bg2.background_name.trim() === from) bg2.background_name = to
    return next
  }
  const replaceInArray = (arr: unknown) => {
    if (!Array.isArray(arr)) return arr
    return arr.map((v) => (typeof v === "string" && v.trim() === from ? to : v))
  }
  ;(next.shot_content as any).role_items = replaceInArray((next.shot_content as any).role_items)
  ;(next.shot_content as any).other_items = replaceInArray((next.shot_content as any).other_items)
  for (const list of [next.video_content?.items, next.video_content?.other_items]) {
    if (!Array.isArray(list)) continue
    for (const it of list as any[]) {
      if (it && typeof it.item_name === "string" && it.item_name.trim() === from) it.item_name = to
    }
  }
  return next
}

export function withReferenceAsset(
  current: StoryboardScriptContent | null,
  input: { category: string; entityName: string; assetName: string; assetDescription: string }
): StoryboardScriptContent {
  const next = current ? structuredClone(current) : buildEmptyScript()
  const entityName = input.entityName.trim()
  const assetName = input.assetName.trim()
  const assetDescription = input.assetDescription.trim()
  if (!entityName || !assetName) return next

  if (input.category === "role") {
    const roles = Array.isArray(next.video_content.roles) ? (next.video_content.roles as any[]) : []
    let row = roles.find((r) => (r.role_name ?? "").trim() === entityName)
    if (!row) {
      row = { role_name: entityName, description: "" }
      roles.push(row)
      ;(next.video_content as any).roles = roles
    }
    row.reference_image_name = assetName
    row.reference_image_description = assetDescription
    return next
  }

  if (input.category === "background") {
    const bg = ((next.video_content as any).background as any) ?? { description: "", background_name: "" }
    bg.reference_image_name = assetName
    bg.reference_image_description = assetDescription
    ;(next.video_content as any).background = bg
    return next
  }

  const items = Array.isArray((next.video_content as any).items) ? ((next.video_content as any).items as any[]) : []
  const otherItems = Array.isArray((next.video_content as any).other_items) ? ((next.video_content as any).other_items as any[]) : []
  let row =
    items.find((r) => (r.item_name ?? "").trim() === entityName) ??
    otherItems.find((r) => (r.item_name ?? "").trim() === entityName) ??
    null
  if (!row) {
    row = { relation: "", item_name: entityName, description: "" }
    items.push(row)
    ;(next.video_content as any).items = items
  }
  row.reference_image_name = assetName
  row.reference_image_description = assetDescription
  return next
}

