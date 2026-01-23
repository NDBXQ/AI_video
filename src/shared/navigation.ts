export type NavItem = {
  href: string
  label: string
}

export const appNavItems: NavItem[] = [
  { href: "/", label: "首页" },
  { href: "/script/workspace?entry=nav", label: "剧本创作" },
  { href: "/video", label: "视频创作" },
  { href: "/library", label: "内容库" }
]

export const libraryNavItems: NavItem[] = [
  { href: "/library/roles", label: "角色库" },
  { href: "/library/items", label: "物品库" },
  { href: "/library/backgrounds", label: "背景库" },
  { href: "/library/generated-scripts", label: "已生成的脚本库" },
  { href: "/library/generated-images", label: "已生成的图片库" },
  { href: "/library/generated-videos", label: "已生成的视频库" }
]
