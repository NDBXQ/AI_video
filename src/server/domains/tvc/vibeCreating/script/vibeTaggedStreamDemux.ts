export type VibeTaggedStreamDemux = {
  push: (piece: string) => void
  flush: () => { outsideRemainder: string }
  getFull: () => { clarification: string; script: string; storyboards: string }
  getState: () => {
    clarificationOpen: boolean
    clarificationClosed: boolean
    scriptOpen: boolean
    scriptClosed: boolean
    storyboardsOpen: boolean
    storyboardsClosed: boolean
  }
}

function stripDivTags(text: string): string {
  return text.replaceAll("<div>", "").replaceAll("</div>", "")
}

export function createVibeTaggedStreamDemux(params: {
  onOutside: (text: string) => void
  onClarificationDelta: (text: string) => void
  onClarificationDone: (full: string) => void
  onScriptDelta: (text: string) => void
  onScriptDone: (full: string) => void
  onStoryboardsDelta: (text: string) => void
  onStoryboardsDone: (full: string) => void
}): VibeTaggedStreamDemux {
  const OPEN_CLAR = "<clarification>"
  const CLOSE_CLAR = "</clarification>"
  const OPEN_SCRIPT = "<script>"
  const CLOSE_SCRIPT = "</script>"
  const OPEN_STORYBOARDS = "<storyboards>"
  const CLOSE_STORYBOARDS = "</storyboards>"

  let outsideRemainder = ""
  let clarificationFull = ""
  let clarificationOpen = false
  let clarificationClosed = false
  let scriptFull = ""
  let scriptOpen = false
  let scriptClosed = false
  let storyboardsFull = ""
  let storyboardsOpen = false
  let storyboardsClosed = false
  let streamBuffer = ""

  const emitOutside = (t: string) => {
    const cleaned = stripDivTags(t)
    if (!cleaned) return
    params.onOutside(cleaned)
  }

  const emitClarification = (t: string) => {
    if (!t) return
    clarificationFull += t
    params.onClarificationDelta(t)
  }

  const closeClarification = () => {
    if (clarificationClosed) return
    clarificationOpen = false
    clarificationClosed = true
    params.onClarificationDone(clarificationFull)
  }

  const emitScript = (t: string) => {
    const cleaned = stripDivTags(t)
    if (!cleaned) return
    scriptFull += cleaned
    params.onScriptDelta(cleaned)
  }

  const closeScript = () => {
    if (scriptClosed) return
    scriptOpen = false
    scriptClosed = true
    params.onScriptDone(scriptFull)
  }

  const emitStoryboards = (t: string) => {
    if (!t) return
    storyboardsFull += t
    params.onStoryboardsDelta(t)
  }

  const closeStoryboards = () => {
    if (storyboardsClosed) return
    storyboardsOpen = false
    storyboardsClosed = true
    params.onStoryboardsDone(storyboardsFull)
  }

  const pump = () => {
    while (streamBuffer) {
      if (!clarificationOpen && !clarificationClosed && !scriptOpen && !scriptClosed && !storyboardsOpen && !storyboardsClosed) {
        const idxClar = streamBuffer.indexOf(OPEN_CLAR)
        const idxScript = streamBuffer.indexOf(OPEN_SCRIPT)
        const idxStoryboards = streamBuffer.indexOf(OPEN_STORYBOARDS)
        const idx = [idxClar, idxScript, idxStoryboards].filter((n) => n >= 0).sort((a, b) => a - b)[0] ?? -1
        if (idx >= 0) {
          emitOutside(streamBuffer.slice(0, idx))
          if (idx === idxClar) {
            streamBuffer = streamBuffer.slice(idx + OPEN_CLAR.length)
            clarificationOpen = true
          } else if (idx === idxScript) {
            streamBuffer = streamBuffer.slice(idx + OPEN_SCRIPT.length)
            scriptOpen = true
          } else {
            streamBuffer = streamBuffer.slice(idx + OPEN_STORYBOARDS.length)
            storyboardsOpen = true
          }
          continue
        }
        const safeLen = streamBuffer.length - (Math.max(OPEN_CLAR.length, OPEN_SCRIPT.length, OPEN_STORYBOARDS.length) - 1)
        if (safeLen > 0) {
          emitOutside(streamBuffer.slice(0, safeLen))
          streamBuffer = streamBuffer.slice(safeLen)
        }
        break
      }

      if (clarificationOpen && !clarificationClosed) {
        const idx = streamBuffer.indexOf(CLOSE_CLAR)
        if (idx >= 0) {
          emitClarification(streamBuffer.slice(0, idx))
          streamBuffer = streamBuffer.slice(idx + CLOSE_CLAR.length)
          closeClarification()
          continue
        }
        const safeLen = streamBuffer.length - (CLOSE_CLAR.length - 1)
        if (safeLen > 0) {
          emitClarification(streamBuffer.slice(0, safeLen))
          streamBuffer = streamBuffer.slice(safeLen)
        }
        break
      }

      if (scriptOpen && !scriptClosed) {
        const idx = streamBuffer.indexOf(CLOSE_SCRIPT)
        if (idx >= 0) {
          emitScript(streamBuffer.slice(0, idx))
          streamBuffer = streamBuffer.slice(idx + CLOSE_SCRIPT.length)
          closeScript()
          continue
        }
        const safeLen = streamBuffer.length - (CLOSE_SCRIPT.length - 1)
        if (safeLen > 0) {
          emitScript(streamBuffer.slice(0, safeLen))
          streamBuffer = streamBuffer.slice(safeLen)
        }
        break
      }

      if (storyboardsOpen && !storyboardsClosed) {
        const idx = streamBuffer.indexOf(CLOSE_STORYBOARDS)
        if (idx >= 0) {
          emitStoryboards(streamBuffer.slice(0, idx))
          streamBuffer = streamBuffer.slice(idx + CLOSE_STORYBOARDS.length)
          closeStoryboards()
          continue
        }
        const safeLen = streamBuffer.length - (CLOSE_STORYBOARDS.length - 1)
        if (safeLen > 0) {
          emitStoryboards(streamBuffer.slice(0, safeLen))
          streamBuffer = streamBuffer.slice(safeLen)
        }
        break
      }

      emitOutside(streamBuffer)
      streamBuffer = ""
    }
  }

  return {
    push: (piece: string) => {
      streamBuffer += String(piece ?? "")
      pump()
    },
    flush: () => {
      if (!streamBuffer) return { outsideRemainder }
      if (clarificationOpen && !clarificationClosed) {
        emitClarification(streamBuffer)
        streamBuffer = ""
        closeClarification()
        return { outsideRemainder }
      }
      if (scriptOpen && !scriptClosed) {
        emitScript(streamBuffer)
        streamBuffer = ""
        closeScript()
        return { outsideRemainder }
      }
      if (storyboardsOpen && !storyboardsClosed) {
        emitStoryboards(streamBuffer)
        streamBuffer = ""
        closeStoryboards()
        return { outsideRemainder }
      }
      outsideRemainder += stripDivTags(streamBuffer)
      streamBuffer = ""
      return { outsideRemainder }
    },
    getFull: () => ({ clarification: clarificationFull, script: scriptFull, storyboards: storyboardsFull }),
    getState: () => ({ clarificationOpen, clarificationClosed, scriptOpen, scriptClosed, storyboardsOpen, storyboardsClosed })
  }
}
