import type { ReactElement } from "react"
import layoutStyles from "../VideoAssetSidebarLayout.module.css"

export function CollapsibleSplitBlock({
  ariaLabel,
  label,
  title,
  headerActions,
  collapsed,
  contentId,
  onToggle,
  children
}: {
  ariaLabel: string
  label: string
  title: string
  headerActions?: ReactElement | null
  collapsed: boolean
  contentId: string
  onToggle: () => void
  children: ReactElement
}): ReactElement {
  return (
    <div className={`${layoutStyles.splitBlock} ${collapsed ? layoutStyles.splitBlockCollapsed : ""}`} aria-label={ariaLabel}>
      <div className={layoutStyles.splitLabel}>{label}</div>
      <div className={layoutStyles.splitContent}>
        <div className={layoutStyles.splitHeader}>
          <div className={layoutStyles.splitTitleRow}>
            <div className={layoutStyles.splitTitle}>{title}</div>
            <div className={layoutStyles.splitHeaderActions}>
              {headerActions ?? null}
              <button
                type="button"
                className={layoutStyles.splitToggle}
                aria-label={collapsed ? `展开${title}` : `折叠${title}`}
                aria-expanded={!collapsed}
                aria-controls={contentId}
                onClick={onToggle}
              >
                <span className={`${layoutStyles.splitToggleIcon} ${collapsed ? layoutStyles.splitToggleIconCollapsed : ""}`} aria-hidden="true">
                  ▾
                </span>
              </button>
            </div>
          </div>
        </div>
        {!collapsed ? (
          <div className={layoutStyles.splitBody} id={contentId}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}

