export async function runWithConcurrencyLimit<T>(tasks: Array<() => Promise<T>>, maxConcurrent: number): Promise<T[]> {
  const limit = Math.max(1, Math.trunc(maxConcurrent || 1))
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0

  const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async () => {
    while (true) {
      const idx = nextIndex
      nextIndex += 1
      if (idx >= tasks.length) return
      results[idx] = await tasks[idx]!()
    }
  })

  await Promise.all(workers)
  return results
}

