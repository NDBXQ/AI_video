import type { ReactElement } from "react"
import { ScriptCreationPage } from "@/features/script/ScriptCreationPage"

export const dynamic = "force-dynamic"

type ScriptPageProps = Readonly<{
  searchParams?:
    | Readonly<{
        mode?: string | string[]
      }>
    | Promise<
        Readonly<{
          mode?: string | string[]
        }>
      >
}>

/**
 * 脚本创作页
 * @param {ScriptPageProps} props - 页面属性
 * @param {Object} [props.searchParams] - 查询参数
 * @param {string} [props.searchParams.mode] - 进入模式（source/brief）
 * @returns {ReactElement} 页面内容
 */
export default async function ScriptPage({ searchParams }: ScriptPageProps): Promise<ReactElement> {
  const resolvedSearchParams = await Promise.resolve(searchParams)
  const modeValue = resolvedSearchParams?.mode
  const mode = Array.isArray(modeValue) ? modeValue[0] : modeValue

  if (mode === "brief" || mode === "source") {
    return <ScriptCreationPage initialMode={mode} />
  }

  return <ScriptCreationPage />
}
