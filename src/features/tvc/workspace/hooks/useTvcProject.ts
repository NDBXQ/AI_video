"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

export function useTvcProject(): {
  projectId: string
  setProjectId: React.Dispatch<React.SetStateAction<string>>
  projectError: string | null
  setProjectError: React.Dispatch<React.SetStateAction<string | null>>
  isCreatingProject: boolean
  finalVideoUrl: string | null
  brief: string
  setBrief: React.Dispatch<React.SetStateAction<string>>
  durationSec: number
  setDurationSec: React.Dispatch<React.SetStateAction<number>>
  refreshProject: () => Promise<void>
  createNewProject: (params: { onReset?: () => void }) => Promise<void>
} {
  const [projectId, setProjectId] = useState("")
  const [projectError, setProjectError] = useState<string | null>(null)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null)
  const [brief, setBrief] = useState("")
  const [durationSec, setDurationSec] = useState(30)

  useEffect(() => {
    let cancelled = false
    const initialDurationSec = 30
    const syncUrlProjectId = (projectId: string) => {
      const id = String(projectId ?? "").trim()
      if (!id) return
      try {
        const url = new URL(window.location.href)
        if ((url.searchParams.get("projectId") ?? "").trim() === id) return
        url.searchParams.set("projectId", id)
        window.history.replaceState({}, "", url.toString())
      } catch {}
    }
    const readProjectIdFromUrl = (): string => {
      try {
        const url = new URL(window.location.href)
        return (url.searchParams.get("projectId") ?? "").trim()
      } catch {
        return ""
      }
    }
    const shouldForceNewProject = (): boolean => {
      try {
        const url = new URL(window.location.href)
        const v = (url.searchParams.get("new") ?? "").trim().toLowerCase()
        return v === "1" || v === "true" || v === "yes"
      } catch {
        return false
      }
    }
    const readCachedId = (): string => {
      try {
        return (window.localStorage.getItem("last_tvc_project_id") ?? "").trim()
      } catch {
        return ""
      }
    }
    const saveCachedId = (id: string) => {
      try {
        window.localStorage.setItem("last_tvc_project_id", id)
      } catch {}
    }

    const fetchProject = async (id: string) => {
      const res = await fetch(`/api/tvc/projects/${encodeURIComponent(id)}`, { method: "GET", cache: "no-store" })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      return json.data.project as any
    }

    const createProject = async () => {
      const res = await fetch("/api/tvc/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "TVC 项目", durationSec: initialDurationSec })
      })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      return json.data.project as any
    }

    void (async () => {
      setProjectError(null)
      const forceNew = shouldForceNewProject()
      const candidate = forceNew ? "" : readProjectIdFromUrl() || readCachedId()
      try {
        const proj = candidate ? await fetchProject(candidate) : await createProject()
        if (cancelled) return
        const id = String(proj.id ?? "").trim()
        if (id) {
          setProjectId(id)
          saveCachedId(id)
          syncUrlProjectId(id)
        }
        if (forceNew) {
          try {
            const url = new URL(window.location.href)
            url.searchParams.delete("new")
            url.searchParams.set("projectId", id)
            window.history.replaceState({}, "", url.toString())
          } catch {}
        }
        const tvcMeta = (proj.metadata as any)?.tvc ?? {}
        const nextBrief = typeof tvcMeta.brief === "string" ? tvcMeta.brief : typeof proj.storyText === "string" ? proj.storyText : ""
        const nextDuration = typeof tvcMeta.durationSec === "number" ? tvcMeta.durationSec : 30
        setBrief(nextBrief ?? "")
        setDurationSec(nextDuration)
        setFinalVideoUrl(typeof proj.finalVideoUrl === "string" && proj.finalVideoUrl.trim() ? proj.finalVideoUrl.trim() : null)
      } catch (e) {
        if (cancelled) return
        const anyErr = e as { message?: string }
        setProjectError(anyErr?.message ?? "项目初始化失败")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const refreshProject = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await fetch(`/api/tvc/projects/${encodeURIComponent(projectId)}`, { method: "GET", cache: "no-store" })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok || !json?.ok) return
      const proj = json.data.project as any
      setFinalVideoUrl(typeof proj.finalVideoUrl === "string" && proj.finalVideoUrl.trim() ? proj.finalVideoUrl.trim() : null)
    } catch {}
  }, [projectId])

  const createNewProject = useMemo(() => {
    const saveCachedId = (id: string) => {
      try {
        window.localStorage.setItem("last_tvc_project_id", id)
      } catch {}
    }
    const syncUrlProjectId = (projectId: string) => {
      const id = String(projectId ?? "").trim()
      if (!id) return
      try {
        const url = new URL(window.location.href)
        if ((url.searchParams.get("projectId") ?? "").trim() === id) return
        url.searchParams.set("projectId", id)
        url.searchParams.delete("new")
        window.history.replaceState({}, "", url.toString())
      } catch {}
    }

    return async (params: { onReset?: () => void }) => {
      if (isCreatingProject) return
      setProjectError(null)
      setIsCreatingProject(true)
      params.onReset?.()
      setFinalVideoUrl(null)
      try {
        const res = await fetch("/api/tvc/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "TVC 项目", durationSec, brief })
        })
        const json = (await res.json().catch(() => null)) as any
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        const proj = json.data.project as any
        const id = String(proj.id ?? "").trim()
        if (!id) throw new Error("项目创建失败：缺少 id")
        setProjectId(id)
        saveCachedId(id)
        syncUrlProjectId(id)
      } catch (e) {
        const anyErr = e as { message?: string }
        setProjectError(anyErr?.message ?? "项目创建失败")
      } finally {
        setIsCreatingProject(false)
      }
    }
  }, [brief, durationSec, isCreatingProject])

  return {
    projectId,
    setProjectId,
    projectError,
    setProjectError,
    isCreatingProject,
    finalVideoUrl,
    brief,
    setBrief,
    durationSec,
    setDurationSec,
    refreshProject,
    createNewProject
  }
}
