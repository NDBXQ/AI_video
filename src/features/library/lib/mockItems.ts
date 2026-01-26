import type { LibraryItem } from "../components/LibraryCard"

function makeSvgDataUrl({
  background,
  label,
}: {
  background: string
  label: string
}): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${background}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><rect width="960" height="540" rx="24" fill="url(#g)"/><text x="50%" y="50%" font-family="ui-sans-serif, system-ui" font-size="54" font-weight="700" fill="rgba(15,23,42,0.65)" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const MOCK_ITEMS: LibraryItem[] = [
  {
    id: "1",
    title: "汽车宣传片",
    type: "storyboard",
    updatedAt: "2026/01/15 10:45",
    specs: "4:3 480p",
    scope: "my",
  },
  {
    id: "2",
    title: "未命名草稿",
    type: "draft",
    updatedAt: "2026/01/14 18:20",
    scope: "my",
  },
  {
    id: "3",
    title: "产品展示",
    type: "video",
    updatedAt: "2026/01/12 09:15",
    specs: "16:9 1080p",
    scope: "my",
  },
  {
    id: "4",
    title: "风景素材",
    type: "material",
    updatedAt: "2026/01/10 14:30",
    specs: "1024x1024",
    scope: "my",
  },
  {
    id: "p1",
    title: "男孩",
    subtitle: "一个男孩",
    type: "material",
    scope: "public",
    publicCategory: "all",
    thumbnail: makeSvgDataUrl({ background: "#c7d2fe", label: "Boy" }),
  },
  {
    id: "p2",
    title: "一个女孩",
    subtitle: "一个女孩",
    type: "material",
    scope: "public",
    publicCategory: "roles",
    thumbnail: makeSvgDataUrl({ background: "#fecaca", label: "Girl" }),
  },
  {
    id: "p3",
    title: "扎马尾女生",
    subtitle: "扎马尾女生",
    type: "material",
    scope: "public",
    publicCategory: "roles",
    thumbnail: makeSvgDataUrl({ background: "#bbf7d0", label: "Role" }),
  },
]

export const MOCK_COUNTS = {
  draft: 1,
  video: 0,
  storyboard: 2,
  material: 5,
}

export const PUBLIC_COUNTS: Record<string, number> = {
  all: 3,
  roles: 2,
  backgrounds: 0,
  props: 1,
  audios: 0,
  videos: 0,
}
