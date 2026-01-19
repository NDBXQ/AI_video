import { type ReactElement, useState } from "react"
import type { StoryboardItem, Episode } from "../types"
import { MOCK_STORYBOARD_ITEMS } from "@/features/video/mock/storyboardMock"
import { ChipEditModal } from "@/features/video/components/ChipEditModal"
import { ImagePreviewModal } from "@/features/video/components/ImagePreviewModal"
import styles from "./StoryboardList.module.css"

type StoryboardListProps = {
  initialItems?: StoryboardItem[]
}

// 模拟数据：剧集列表
const MOCK_EPISODES: Episode[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `ep-${i + 1}`,
  name: `第${i + 1}集`,
  status: i === 0 || i === 1 ? "completed" : "pending"
}))

export function StoryboardList({ initialItems = [] }: StoryboardListProps): ReactElement {
  const [items, setItems] = useState<StoryboardItem[]>(initialItems.length > 0 ? initialItems : MOCK_STORYBOARD_ITEMS)
  const [activeEpisode, setActiveEpisode] = useState("ep-1")
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<{ title: string; imageSrc: string } | null>(null)
  const [addRole, setAddRole] = useState<{ open: boolean; itemId: string }>({ open: false, itemId: "" })
  const [addItem, setAddItem] = useState<{ open: boolean; itemId: string }>({ open: false, itemId: "" })

  const escapeXmlText = (value: string): string => {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&apos;")
  }

  const createPreviewSvgDataUrl = (title: string, subtitle: string): string => {
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

  const openPreview = (title: string, subtitle: string) => {
    setPreview({ title, imageSrc: createPreviewSvgDataUrl(title, subtitle) })
  }

  const closePreview = () => setPreview(null)

  const maxRoleItemsVisible = 2
  const maxSceneItemsVisible = 2

  const updateItemById = (id: string, updater: (item: StoryboardItem) => StoryboardItem) => {
    setItems((prev) => prev.map((it) => (it.id === id ? updater(it) : it)))
  }

  const handleAddRole = (itemId: string, roleName: string) => {
    updateItemById(itemId, (it) => {
      const exists = it.shot_content.roles.some((r) => r.role_name === roleName)
      if (exists) return it
      return {
        ...it,
        shot_content: {
          ...it.shot_content,
          roles: [
            ...it.shot_content.roles,
            {
              role_name: roleName,
              appearance_time_point: 0,
              location_info: "",
              action: "",
              expression: "",
              speak: null
            }
          ]
        }
      }
    })
  }

  const handleRemoveRole = (itemId: string, roleName: string) => {
    updateItemById(itemId, (it) => ({
      ...it,
      shot_content: {
        ...it.shot_content,
        roles: it.shot_content.roles.filter((r) => r.role_name !== roleName)
      }
    }))
  }

  const handleAddItem = (itemId: string, targetKey: "role_items" | "other_items", name: string) => {
    updateItemById(itemId, (it) => {
      const currentList = it.shot_content[targetKey]
      if (currentList.includes(name)) return it
      return {
        ...it,
        shot_content: {
          ...it.shot_content,
          [targetKey]: [...currentList, name]
        }
      }
    })
  }

  const handleRemoveItem = (itemId: string, target: "role_items" | "other_items", name: string) => {
    updateItemById(itemId, (it) => ({
      ...it,
      shot_content: {
        ...it.shot_content,
        [target]: it.shot_content[target].filter((n) => n !== name)
      }
    }))
  }

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(items.map(i => i.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedItems(newSet)
  }

  const handleDelete = (id: string) => {
    if (confirm("确定要删除这个分镜吗？")) {
      setItems(items.filter(i => i.id !== id))
    }
  }

  /**
   * 批量删除分镜
   * @returns {void}
   */
  const handleBatchDelete = () => {
    if (selectedItems.size === 0) return
    if (confirm(`确定要删除选中的 ${selectedItems.size} 个分镜吗？`)) {
      setItems(items.filter(i => !selectedItems.has(i.id)))
      setSelectedItems(new Set())
    }
  }

  return (
    <div className={styles.wrapper}>
      {addRole.open && (
        <ChipEditModal
          open={addRole.open}
          title="添加角色"
          placeholder="请输入角色名"
          onClose={() => setAddRole({ open: false, itemId: "" })}
          onSubmit={(value) => {
            if (!addRole.itemId) return
            handleAddRole(addRole.itemId, value)
            setAddRole({ open: false, itemId: "" })
          }}
        />
      )}
      {addItem.open && (
        <ChipEditModal
          open={addItem.open}
          title="添加物品"
          placeholder="请输入物品名称"
          optionLabels={{ left: "角色物品", right: "场景物品" }}
          defaultOption="left"
          onClose={() => setAddItem({ open: false, itemId: "" })}
          onSubmit={(value, option) => {
            if (!addItem.itemId) return
            handleAddItem(addItem.itemId, option === "left" ? "role_items" : "other_items", value)
            setAddItem({ open: false, itemId: "" })
          }}
        />
      )}
      <ImagePreviewModal
        open={Boolean(preview)}
        title={preview?.title ?? ""}
        imageSrc={preview?.imageSrc ?? ""}
        onClose={closePreview}
      />
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>剧集列表</div>
        <div className={styles.episodeList}>
          {MOCK_EPISODES.map((ep) => (
            <div
              key={ep.id}
              className={`${styles.episodeItem} ${activeEpisode === ep.id ? styles.episodeActive : ""}`}
              onClick={() => setActiveEpisode(ep.id)}
            >
              <span>{ep.name}</span>
              <span className={`${styles.statusBadge} ${ep.status === "completed" ? styles.statusCompleted : styles.statusProcessing}`}>
                {ep.status === "completed" ? "已完成" : "生成中"}
              </span>
            </div>
          ))}
        </div>
      </aside>

      <div className={styles.mainContent}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <h2 className={styles.toolbarTitle}>分镜脚本</h2>
            <span className={styles.toolbarMeta}>共 {items.length} 个镜头</span>
          </div>
          <div className={styles.toolbarActions}>
            {selectedItems.size > 0 && (
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleBatchDelete}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                删除 ({selectedItems.size})
              </button>
            )}
            <button className={`${styles.btn} ${styles.btnPrimary}`}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              AI 生成
            </button>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colCheckbox}>
                  <input type="checkbox" checked={items.length > 0 && selectedItems.size === items.length} onChange={toggleSelectAll} />
                </th>
                <th className={styles.colNo}>镜号</th>
                <th className={styles.colVisual}>分镜描述</th>
                <th className={styles.colRole}>角色</th>
                <th className={styles.colBackground}>背景</th>
                <th className={styles.colItems}>物品</th>
                <th className={styles.colInfo}>拍摄角度</th>
                <th className={styles.colAudio}>台词 / 音效</th>
                <th className={styles.colActions}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className={styles.colCheckbox}>
                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelect(item.id)} />
                  </td>
                  <td className={styles.colNo}>
                    <span className={styles.sceneNo}>{item.scene_no}</span>
                  </td>
                  <td className={styles.colVisual}>
                    <div className={styles.visualContent}>
                      {item.shot_content.roles
                        .filter((r) => r.role_name !== "旁白")
                        .map((role, idx) => (
                          <div key={idx} className={styles.roleAction}>
                            <span className={styles.roleName}>{role.role_name}</span>
                            {role.action}
                            {role.expression && <span className={styles.roleExpression}>{role.expression}</span>}
                          </div>
                        ))}
                    </div>
                  </td>
                  <td className={styles.colRole}>
                    <div className={styles.characterList}>
                      {item.shot_content.roles.map((role, idx) => (
                        <div key={idx} className={styles.characterChip}>
                          <span className={styles.avatar}>{role.role_name[0]}</span>
                          <span className={styles.characterName}>{role.role_name}</span>
                          <button
                            type="button"
                            className={`${styles.chipRemove} ${styles.chipRemoveDanger}`}
                            onClick={() => handleRemoveRole(item.id, role.role_name)}
                            aria-label="移除角色"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" className={styles.addCharBtn} title="添加角色" onClick={() => setAddRole({ open: true, itemId: item.id })}>+</button>
                    </div>
                  </td>
                  <td className={styles.colBackground}>
                    <div className={styles.backgroundStack}>
                      <span
                        className={`${styles.simpleChip} ${styles.chipClickable}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openPreview(item.shot_content.background.background_name, "背景")}
                        onKeyDown={(e) => (e.key === "Enter" ? openPreview(item.shot_content.background.background_name, "背景") : undefined)}
                      >
                        {item.shot_content.background.background_name}
                      </span>
                      <span className={`${styles.simpleChip} ${styles.metaChip}`}>{item.shot_content.background.status}</span>
                    </div>
                  </td>
                  <td className={styles.colItems}>
                    <div className={styles.chipList}>
                      {item.shot_content.role_items.slice(0, maxRoleItemsVisible).map((name) => (
                        <span
                          key={`role-item-${name}`}
                          className={`${styles.simpleChip} ${styles.chipClickable}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => openPreview(name, "角色物品")}
                          onKeyDown={(e) => (e.key === "Enter" ? openPreview(name, "角色物品") : undefined)}
                        >
                          {name}
                          <button
                            type="button"
                            className={`${styles.chipRemove} ${styles.chipRemoveDanger}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveItem(item.id, "role_items", name)
                            }}
                            aria-label="移除物品"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {item.shot_content.other_items.slice(0, maxSceneItemsVisible).map((name) => (
                        <span
                          key={`other-item-${name}`}
                          className={`${styles.simpleChip} ${styles.sceneItemText} ${styles.chipClickable}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => openPreview(name, "场景物品")}
                          onKeyDown={(e) => (e.key === "Enter" ? openPreview(name, "场景物品") : undefined)}
                        >
                          {name}
                          <button
                            type="button"
                            className={`${styles.chipRemove} ${styles.chipRemoveDanger}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveItem(item.id, "other_items", name)
                            }}
                            aria-label="移除物品"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {item.shot_content.role_items.length + item.shot_content.other_items.length > maxRoleItemsVisible + maxSceneItemsVisible ? (
                        <span className={`${styles.simpleChip} ${styles.metaChip}`}>
                          +{item.shot_content.role_items.length + item.shot_content.other_items.length - (maxRoleItemsVisible + maxSceneItemsVisible)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className={styles.addCharBtn}
                        title="添加物品"
                        onClick={() => setAddItem({ open: true, itemId: item.id })}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className={styles.colInfo}>
                    <div className={styles.shootInfo}>
                      <div>
                        <span className={`${styles.tag} ${styles.tagBlue}`}>{item.shot_content.shoot.camera_movement}</span>
                        <span className={`${styles.tag} ${styles.tagGray}`}>{item.shot_content.shoot.shot_angle}</span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.colAudio}>
                    <div className={styles.dialogueBox}>
                      {item.shot_content.roles
                        .filter(role => role.speak && role.speak.content)
                        .map((role, idx) => (
                          <div key={idx} className={styles.dialogueLine}>
                            <span className={styles.dialogueRole}>{role.role_name}</span>
                            <span className={styles.dialogueContent}>“{role.speak?.content}”</span>
                          </div>
                        ))
                      }
                      {(!item.shot_content.roles.some(r => r.speak?.content) && item.shot_content.bgm) && (
                        <div className={styles.bgmLine}>
                          🎵 {item.shot_content.bgm}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={styles.colActions}>
                    <div className={styles.actionGroup}>
                      <button className={styles.actionBtn} title="预览">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      <button className={styles.actionBtn} title="上移">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button className={styles.actionBtn} title="下移">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(item.id)} title="删除">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
