import type { ReactElement } from "react"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

type ScriptPageProps = Readonly<{
  searchParams: Promise<Readonly<{
    mode?: string | string[]
  }>>
}>

/**
 * 脚本创作页
 * @param {ScriptPageProps} props - 页面属性
 * @returns {ReactElement} 页面内容
 */
export default async function ScriptPage({ searchParams }: ScriptPageProps): Promise<ReactElement> {
  const resolvedSearchParams = await searchParams
  const modeValue = resolvedSearchParams.mode
  const mode = Array.isArray(modeValue) ? modeValue[0] : modeValue

  if (mode === "brief" || mode === "source") {
    redirect(`/script/workspace?mode=${mode}`)
  }

  redirect("/script/workspace")
}
