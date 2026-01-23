export const escapeXmlText = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;")
}

export const createPreviewSvgDataUrl = (title: string, subtitle: string): string => {
  const safeTitle = escapeXmlText(title || "未命名")
  const safeSubtitle = escapeXmlText(subtitle || "")
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#eaf2ff"/>
          <stop offset="0.55" stop-color="#f4f8ff"/>
          <stop offset="1" stop-color="#ffffff"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" rx="32" fill="url(#bg)"/>
      <rect x="40" y="40" width="1200" height="640" rx="26" fill="#ffffff" stroke="#dbeafe" stroke-width="2"/>
      <circle cx="94" cy="92" r="16" fill="#2563eb" opacity="0.25"/>
      <circle cx="132" cy="92" r="10" fill="#0f172a" opacity="0.18"/>
      <text x="80" y="170" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="44" font-weight="700" fill="#0f172a">${safeTitle}</text>
      <text x="80" y="220" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="20" font-weight="600" fill="#2563eb">${safeSubtitle}</text>
      <text x="80" y="280" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="16" fill="#64748b">点击条目展示的示意图（后续可替换为真实素材/图片）</text>
      <rect x="80" y="330" width="1120" height="280" rx="22" fill="#f8fafc" stroke="#e2e8f0"/>
      <path d="M180 520 L320 400 L450 500 L560 430 L700 540 L780 500 L920 560 L1040 470" fill="none" stroke="#2563eb" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
      <circle cx="320" cy="400" r="10" fill="#2563eb"/>
      <circle cx="560" cy="430" r="10" fill="#2563eb"/>
      <circle cx="920" cy="560" r="10" fill="#2563eb"/>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
