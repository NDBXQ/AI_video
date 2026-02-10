export function recommendBackgroundMusic(params: { sceneType: string; mood: string; durationSeconds: number }): {
  sceneType: string
  mood: string
  style: string
  bpm: string
  instruments: string
} {
  const scene = (params.sceneType || "product").toLowerCase()
  const mood = (params.mood || "exciting").toLowerCase()
  const table: Record<string, Record<string, { style: string; bpm: string; instruments: string }>> = {
    product: {
      exciting: { style: "电子/流行，节奏明快", bpm: "120-140", instruments: "合成器、鼓点、贝斯" },
      calm: { style: "轻音乐/环境音，简约清新", bpm: "60-80", instruments: "钢琴、Pad、轻打击" },
      elegant: { style: "古典/轻爵士，精致高雅", bpm: "80-110", instruments: "钢琴、弦乐、刷鼓" },
      energetic: { style: "摇滚/电子，充满活力", bpm: "140+", instruments: "电吉他、鼓、合成器" },
      dramatic: { style: "管弦乐/史诗，震撼有力", bpm: "90-120", instruments: "弦乐、铜管、定音鼓" }
    },
    brand: {
      exciting: { style: "现代电子/广告流行，时尚前沿", bpm: "110-135", instruments: "合成器、鼓、贝斯" },
      calm: { style: "氛围音乐/自然音效，舒适氛围", bpm: "60-85", instruments: "Pad、环境音、轻打击" },
      elegant: { style: "古典/精品音乐，高端形象", bpm: "70-100", instruments: "钢琴、弦乐" },
      energetic: { style: "流行/舞曲，年轻化", bpm: "120-145", instruments: "鼓、贝斯、合成器" },
      dramatic: { style: "电影感配乐，故事感", bpm: "90-120", instruments: "弦乐、铜管" }
    }
  }
  const picked = table[scene]?.[mood] ?? table.product.exciting
  return { sceneType: scene, mood, style: picked.style, bpm: `${picked.bpm} BPM`, instruments: picked.instruments }
}
