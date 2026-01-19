import type { ReactElement } from "react"
import styles from "./AnalyticsOverview.module.css"

type Metric = {
  label: string
  value: string
  deltaText: string
  deltaDirection: "up" | "down"
}

type BarItem = {
  label: string
  valueLabel: string
  percent: number
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function Sparkline(): ReactElement {
  const points = [
    { x: 0, y: 48 },
    { x: 16, y: 44 },
    { x: 32, y: 52 },
    { x: 48, y: 34 },
    { x: 64, y: 38 },
    { x: 80, y: 26 },
    { x: 96, y: 30 },
    { x: 112, y: 20 },
    { x: 128, y: 24 },
    { x: 144, y: 16 },
    { x: 160, y: 22 }
  ]

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ")
  const area = `0,72 ${polyline} 160,72`

  return (
    <svg className={styles.sparkline} viewBox="0 0 160 72" role="img" aria-label="最近趋势">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(123, 97, 255, 0.0)" />
          <stop offset="30%" stopColor="rgba(123, 97, 255, 0.18)" />
          <stop offset="100%" stopColor="rgba(91, 95, 245, 0.18)" />
        </linearGradient>
      </defs>
      <path d={`M ${area}`} fill="url(#spark)" />
      <polyline
        points={polyline}
        fill="none"
        stroke="rgba(91, 95, 245, 0.92)"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * 首页数据分析概览（当前为静态占位数据）
 * @returns {ReactElement} 区块内容
 */
export function AnalyticsOverview(): ReactElement {
  const metrics: Metric[] = [
    { label: "今日生成剧本", value: "8", deltaText: "+2", deltaDirection: "up" },
    { label: "今日生成视频", value: "3", deltaText: "+1", deltaDirection: "up" },
    { label: "素材入库", value: "26", deltaText: "+6", deltaDirection: "up" },
    { label: "成功率", value: "98%", deltaText: "-1%", deltaDirection: "down" }
  ]

  const bars: BarItem[] = [
    { label: "脚本生成", valueLabel: "72%", percent: 72 },
    { label: "出图生成", valueLabel: "54%", percent: 54 },
    { label: "视频合成", valueLabel: "39%", percent: 39 }
  ]

  return (
    <section className={styles.card} aria-label="数据分析">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.icon} aria-hidden="true" />
          <span className={styles.title}>数据分析</span>
        </div>
        <div className={styles.range}>近 7 天</div>
      </div>

      <div className={styles.grid}>
        <div>
          <div className={styles.metrics} aria-label="关键指标">
            {metrics.map((m) => (
              <div key={m.label} className={styles.metricCard}>
                <div className={styles.metricLabel}>{m.label}</div>
                <div className={styles.metricValueRow}>
                  <div className={styles.metricValue}>{m.value}</div>
                  <div
                    className={`${styles.metricDelta} ${
                      m.deltaDirection === "down" ? styles.metricDeltaDown : ""
                    }`}
                    aria-label="变化"
                  >
                    {m.deltaText}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.note}>数据为占位示例，后续可接入真实埋点与生成记录。</div>
        </div>

        <div className={styles.side}>
          <div className={styles.panel} aria-label="趋势">
            <div className={styles.panelTitle}>
              <span>活跃趋势</span>
              <span className={styles.panelHint}>本周</span>
            </div>
            <Sparkline />
          </div>

          <div className={styles.panel} aria-label="模块使用">
            <div className={styles.panelTitle}>
              <span>模块使用</span>
              <span className={styles.panelHint}>占比</span>
            </div>
            <div className={styles.bars}>
              {bars.map((b) => (
                <div key={b.label} className={styles.barRow}>
                  <div className={styles.barLabel}>{b.label}</div>
                  <div className={styles.barTrack} aria-hidden="true">
                    <div className={styles.barFill} style={{ width: `${clampPercent(b.percent)}%` }} />
                  </div>
                  <div className={styles.barValue}>{b.valueLabel}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

