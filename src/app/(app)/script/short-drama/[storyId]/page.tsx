import type { ReactElement } from "react"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { stories } from "@/shared/schema"
import { ShortDramaSetupPage } from "@/features/script/shortDramaSetup/ShortDramaSetupPage"

export const dynamic = "force-dynamic"

export default async function Page({
  params,
  searchParams
}: {
  params: { storyId: string } | Promise<{ storyId: string }>
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>
}): Promise<ReactElement> {
  const resolvedParams = await Promise.resolve(params)
  const storyId = resolvedParams.storyId?.trim()
  if (!storyId) notFound()

  const db = await getDb({ stories })
  const [row] = await db.select({ metadata: stories.metadata }).from(stories).where(eq(stories.id, storyId)).limit(1)
  if (!row) notFound()

  const metadata = (row.metadata ?? {}) as Record<string, unknown>
  await Promise.resolve(searchParams)
  return <ShortDramaSetupPage storyId={storyId} storyMetadata={metadata} />
}

