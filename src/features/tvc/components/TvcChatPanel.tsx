"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import styles from "./TvcChatPanel.module.css"
import type { ChatMessage } from "@/features/tvc/types"
import { createId } from "./TvcChatPanelParts/ids"
import { ChatHeader } from "./TvcChatPanelParts/ChatHeader"
import { ChatThread } from "./TvcChatPanelParts/ChatThread"
import { ChatComposer } from "./TvcChatPanelParts/ChatComposer"
import { useTvcChatPersist } from "./TvcChatPanelParts/useTvcChatPersist"
import { useTvcChatStream } from "./TvcChatPanelParts/useTvcChatStream"
import { encodeUploadImagesMessage } from "@/shared/tvcChatContent"
import type { ClarificationEvent } from "@/features/tvc/clarification"

export function TvcChatPanel({
  focusToken,
  onUserMessage,
  onAgentTask,
  onScript,
  onClarification,
  onClarificationReset,
  projectId,
  initialMessages,
  externalSend,
  externalDraft
}: {
  focusToken?: number
  onUserMessage?: (text: string) => void
  onAgentTask?: (task: {
    id: string
    kind: "reference_image" | "first_frame" | "video_clip"
    state: "queued" | "running" | "done" | "failed"
    targetOrdinal?: number
    targetOrdinals?: number[]
    producedCount?: number
    message?: string
  }) => void
  onScript?: (e: { phase: "delta" | "done"; markdown: string }) => void
  onClarification?: (e: ClarificationEvent) => void
  onClarificationReset?: () => void
  projectId?: string | null
  initialMessages?: ChatMessage[]
  externalSend?: { id: string; text: string } | null
  externalDraft?: { id: string; text: string } | null
}): ReactElement {
  const [input, setInput] = useState("")
  const [uploadingImages, setUploadingImages] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<Array<{ id: string; file: File; previewUrl: string }>>([])
  const defaultMessages = useMemo<ChatMessage[]>(() => {
    return [
      {
        id: createId("m"),
        role: "assistant",
        text:
          "我可以帮你生成 TVC 的结构与镜头节奏。\n\n先告诉我：\n1) 产品是什么？（一句话）\n2) 目标平台与时长？（15/30/60s）\n3) 有无参考广告/品牌/画面感觉（可选）"
      }
    ]
  }, [])
  const [messages, setMessages] = useState<ChatMessage[]>(() => (initialMessages && initialMessages.length > 0 ? initialMessages : defaultMessages))
  const lastProjectIdRef = useRef<string | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingFilesRef = useRef<Array<{ id: string; file: File; previewUrl: string }>>([])
  const lastExternalSendIdRef = useRef<string | null>(null)
  const lastExternalDraftIdRef = useRef<string | null>(null)

  const persist = useTvcChatPersist(projectId)
  const stream = useTvcChatStream({
    projectId,
    onAgentTask,
    onClarification,
    onScript: ({ phase, markdown }) => {
      onScript?.({ phase, markdown })
    },
    onUserMessage,
    enqueuePersist: persist.enqueue,
    markAssistantMessageOnce: persist.markAssistantMessageOnce
  })

  const scrollToBottom = useCallback(() => {
    const el = threadRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    const nextProjectId = projectId ?? null
    if (lastProjectIdRef.current === nextProjectId) return
    lastProjectIdRef.current = nextProjectId
    setMessages(initialMessages && initialMessages.length > 0 ? initialMessages : defaultMessages)
  }, [defaultMessages, initialMessages, projectId])

  useEffect(() => {
    if (stream.streaming) return
    if (!initialMessages || initialMessages.length === 0) return
    setMessages((prev) => {
      if (prev.length === 0) return initialMessages
      if (initialMessages.length < prev.length) return prev
      const prevIsDefault =
        prev.length === 1 && prev[0]?.role === "assistant" && String(prev[0]?.text ?? "").trim() === String(defaultMessages[0]?.text ?? "").trim()
      if (prevIsDefault) return initialMessages
      return initialMessages.length > prev.length ? initialMessages : prev
    })
  }, [defaultMessages, initialMessages, stream.streaming])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  useEffect(() => {
    if (!focusToken) return
    textareaRef.current?.focus()
  }, [focusToken])

  useEffect(() => {
    const id = externalDraft?.id ?? null
    if (!id || lastExternalDraftIdRef.current === id) return
    lastExternalDraftIdRef.current = id
    const text = String(externalDraft?.text ?? "").trim()
    setInput(text)
    textareaRef.current?.focus()
  }, [externalDraft?.id, externalDraft?.text])

  useEffect(() => {
    pendingFilesRef.current = pendingFiles
  }, [pendingFiles])

  useEffect(() => {
    return () => {
      for (const p of pendingFilesRef.current) {
        try {
          URL.revokeObjectURL(p.previewUrl)
        } catch {
        }
      }
    }
  }, [])

  const canSend = input.trim().length > 0 || pendingFiles.length > 0

  const pickImages = (files: File[]) => {
    const next = files
      .map((file) => {
        try {
          const previewUrl = URL.createObjectURL(file)
          return { id: createId("p"), file, previewUrl }
        } catch {
          return null
        }
      })
      .filter(Boolean) as Array<{ id: string; file: File; previewUrl: string }>
    if (next.length === 0) return
    setPendingFiles((prev) => [...prev, ...next])
  }

  const removePendingImage = (id: string) => {
    setPendingFiles((prev) => {
      const hit = prev.find((p) => p.id === id)
      if (hit) {
        try {
          URL.revokeObjectURL(hit.previewUrl)
        } catch {
        }
      }
      return prev.filter((p) => p.id !== id)
    })
  }

  const uploadFiles = useCallback(async (files: File[]): Promise<{ images: Array<{ url: string }> } | null> => {
    if (!projectId) return null
    const fd = new FormData()
    for (const f of files) fd.append("files", f)
    const res = await fetch(`/api/tvc/projects/${encodeURIComponent(projectId)}/assets/upload-product-image`, { method: "POST", body: fd })
    const json = (await res.json().catch(() => null)) as any
    const items = Array.isArray(json?.data?.items) ? (json.data.items as any[]) : []
    if (!res.ok || items.length === 0) {
      const msg = String(json?.error?.message ?? "上传失败")
      throw new Error(msg)
    }
    const images = items
      .map((it) => {
        const url = String(it?.url ?? "").trim()
        if (!url) return null
        return { url }
      })
      .filter(Boolean) as Array<{ url: string }>
    return { images }
  }, [projectId])

  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (stream.streaming) {
      stream.abort()
      return
    }
    if (uploadingImages) return
    onClarificationReset?.()
    const filesToUpload = pendingFiles.map((p) => p.file)
    const hasFiles = filesToUpload.length > 0
    if (!trimmed && !hasFiles) return

    if (hasFiles && !projectId) {
      setMessages((prev) => [...prev, { id: createId("m"), role: "assistant", text: "当前项目还没创建成功，暂时无法发送图片。请先生成一次内容或刷新后重试。" }])
      return
    }

    const userId = createId("m")
    const assistantId = createId("m")
    let uploaded: { images: Array<{ url: string }> } | null = null
    if (hasFiles) {
      setUploadingImages(true)
      try {
        uploaded = await uploadFiles(filesToUpload)
        if (!uploaded) throw new Error("上传失败")
      } catch (err) {
        const msg = String((err as any)?.message ?? "上传失败")
        setMessages((prev) => [...prev, { id: createId("m"), role: "assistant", text: `图片上传失败：${msg}` }])
        return
      } finally {
        setUploadingImages(false)
      }
      for (const p of pendingFiles) {
        try {
          URL.revokeObjectURL(p.previewUrl)
        } catch {
        }
      }
      setPendingFiles([])
    }

    setInput("")
    const userText = trimmed
    const images = uploaded?.images ?? []
    const userContentToPersist = images.length ? encodeUploadImagesMessage({ text: userText, images }) : userText
    if (persist.markUserMessageOnce(userContentToPersist)) persist.enqueue({ messages: [{ role: "user", content: userContentToPersist }] })

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text: userText, ...(images.length ? { attachments: images.map((img) => ({ kind: "image", url: img.url })) } : {}) },
      { id: assistantId, role: "assistant", text: "", blocks: [] }
    ])

    const userTextForCallback = userText || (images.length ? "[图片]" : "")
    await stream.start({ prompt: userContentToPersist, userTextForCallback, assistantId, setMessages, scrollToBottom })
  }, [onClarificationReset, pendingFiles, persist, projectId, scrollToBottom, stream, uploadingImages, uploadFiles])

  useEffect(() => {
    const id = externalSend?.id ?? null
    if (!id || lastExternalSendIdRef.current === id) return
    lastExternalSendIdRef.current = id
    const text = String(externalSend?.text ?? "").trim()
    if (!text) return
    if (stream.streaming || uploadingImages) {
      setInput(text)
      textareaRef.current?.focus()
      return
    }
    void sendText(text)
  }, [externalSend?.id, externalSend?.text, sendText, stream.streaming, uploadingImages])

  const send = async () => {
    await sendText(input)
  }

  const handleAction = async (command: string) => {
    await sendText(command)
  }

  return (
    <div className={styles.panel}>
      <ChatHeader streaming={stream.streaming} statusText={stream.statusText} />
      <ChatThread threadRef={threadRef} messages={messages} onAction={handleAction} />
      <ChatComposer
        input={input}
        setInput={setInput}
        canSend={canSend}
        streaming={stream.streaming}
        uploadingImages={uploadingImages}
        uploadDisabled={false}
        pendingImages={pendingFiles.map((p) => ({ id: p.id, previewUrl: p.previewUrl }))}
        onRemovePendingImage={removePendingImage}
        quickActions={stream.quickActions}
        onAction={handleAction}
        onSend={() => void send()}
        onAbort={stream.abort}
        onUploadImages={(files) => pickImages(files)}
        textareaRef={textareaRef}
      />
    </div>
  )
}
