import Link from "next/link"
import { eq, asc } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import type { ReactElement } from "react"
import styles from "./StoryboardPage.module.css"
import { stories, storyOutlines } from "@/shared/schema"

type StoryboardPageProps = Readonly<{
  mode?: string
  outline?: string
  storyId?: string
  scene?: string
}>

/**
 * 生成分镜文本页面（简版占位实现）
 * @param {StoryboardPageProps} props - 组件属性
 * @param {string} [props.mode] - 进入模式（brief/source）
 * @param {string} [props.outline] - 大纲编号
 * @returns {ReactElement} 页面内容
 */
export async function StoryboardPage({
  mode,
  outline,
  storyId,
  scene
}: StoryboardPageProps): Promise<ReactElement> {
  const promptTitle = mode === "source" ? "故事原文" : "剧情简介"

  const selectedSequence = (() => {
    const parsed = Number(scene ?? outline)
    if (!Number.isFinite(parsed)) return 1
    if (parsed < 1) return 1
    return Math.trunc(parsed)
  })()

  const storyIdText = typeof storyId === "string" ? storyId.trim() : ""
  const db = storyIdText ? await getDb({ stories, storyOutlines }) : null

  const story =
    db && storyIdText ? (await db.select().from(stories).where(eq(stories.id, storyIdText)))[0] : null

  const scenes =
    db && storyIdText
      ? await db
          .select()
          .from(storyOutlines)
          .where(eq(storyOutlines.storyId, storyIdText))
          .orderBy(asc(storyOutlines.sequence))
      : []

  const safeScenes = scenes.length
    ? scenes.map((s) => {
        return {
          id: s.id,
          sequence: s.sequence,
          outlineText: s.outlineText,
          originalText: s.originalText
        }
      })
    : [
        {
          id: "demo-1",
          sequence: 1,
          outlineText: "长安UNI-Z新蓝鲸智电SUV在龙湖北城天街举办上市活动",
          originalText:
            "冬日的阳光透过薄雾洒在龙湖北城天街的玻璃幕墙上，金色的光斑随着人流晃动。12月25日的商场门口，一辆三厢高的圣诞树摇曳着灯，树下却放着一台蓝白相间的展区轮台子风头——长安UNI-Z新蓝鲸智电SUV的上市舞台，正被热闹的人群围得水泄不通。"
        },
        {
          id: "demo-2",
          sequence: 2,
          outlineText: "工作人员宣讲试驾福利，吸引年轻情侣体验",
          originalText:
            "人群像被磁石吸引似的围过来。穿驼色大衣的年轻情侣趴在车窗上，女孩指尖划过中控屏的曲面边框，眼睛亮得像星星。男孩敲了敲引擎盖，好奇地询问续航与补能，销售笑着点头，邀请他们坐进车里体验座椅加热。"
        },
        {
          id: "demo-3",
          sequence: 3,
          outlineText: "大叔在儿子劝说下体验车辆，被细节打动",
          originalText:
            "不远处，一位戴毛线帽的大叔拿着宣传单反复看，眉头却皱着。儿子在旁边劝说，大叔犹豫着拉开车门，手刚碰到方向盘就愣了——方向盘加热已经自动开启，暖乎乎的温度顺着指尖传到心里。"
        }
      ]

  const total = safeScenes.length
  const currentIndex = (() => {
    const idx = safeScenes.findIndex((s) => s.sequence === selectedSequence)
    return idx >= 0 ? idx : 0
  })()
  const current = safeScenes[currentIndex] ?? safeScenes[0]!

  const prev = currentIndex > 0 ? safeScenes[currentIndex - 1] : null
  const next = currentIndex < total - 1 ? safeScenes[currentIndex + 1] : null

  const backHref =
    storyIdText && storyIdText
      ? `/script/workspace/${encodeURIComponent(storyIdText)}?mode=${mode ?? "brief"}&outline=${current.sequence}`
      : "/script"

  return (
    <main className={styles.main}>
      <section className={styles.grid}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitleRow}>
              <div className={styles.sidebarTitle}>场景列表</div>
              <div className={styles.sidebarCount}>{total} 个</div>
            </div>
            <button type="button" className={styles.sidebarAction}>
              重新生成
            </button>
          </div>

          <div className={styles.sceneList} role="list">
            {safeScenes.map((item) => {
              const isActive = item.sequence === current.sequence
              const href = `/script/storyboard?mode=${mode ?? "brief"}&storyId=${encodeURIComponent(
                storyIdText || ""
              )}&scene=${item.sequence}`
              return (
                <Link
                  key={item.id}
                  href={href}
                  className={isActive ? styles.sceneItemActive : styles.sceneItem}
                >
                  <div className={styles.sceneItemTop}>
                    <div className={styles.sceneBadge}>{item.sequence}</div>
                    <div className={styles.sceneTitle} title={item.outlineText}>
                      {item.outlineText}
                    </div>
                  </div>
                  <div className={styles.sceneMeta}>
                    <span className={styles.sceneStatus}>已生成</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </aside>

        <section className={styles.detail}>
          <div className={styles.detailHeader}>
            <div className={styles.detailHeaderLeft}>
              <div className={styles.detailTitle}>详情展示</div>
              <div className={styles.detailSub}>
                来源：{story?.title ? story.title : `剧本（${promptTitle}）`}
              </div>
            </div>

            <div className={styles.detailHeaderRight}>
              <div className={styles.toggle}>
                <button type="button" className={styles.toggleActive}>
                  当前
                </button>
                <button type="button" className={styles.toggleBtn}>
                  全部
                </button>
              </div>
              <Link className={styles.primaryLink} href="/video">
                去视频创作
              </Link>
              <Link className={styles.secondaryLink} href={backHref}>
                返回大纲工作区
              </Link>
            </div>
          </div>

          <div className={styles.detailBody}>
            <section className={styles.card}>
              <div className={styles.cardTitle}>大纲</div>
              <div className={styles.cardText}>{current.outlineText}</div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>原文</div>
              <div className={styles.cardTextMuted}>{current.originalText}</div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeaderRow}>
                <div className={styles.cardTitle}>分镜文本</div>
                <button type="button" className={styles.ghostButton}>
                  重新生成
                </button>
              </div>

              <div className={styles.shotList}>
                <div className={styles.shotCard}>
                  <div className={styles.shotHeader}>
                    <div className={styles.shotTitle}>镜头 1</div>
                    <span className={styles.shotTagWarn}>需要切镜</span>
                  </div>
                  <div className={styles.shotText}>
                    冬日阳光穿透薄雾，龙湖北城天街玻璃幕墙上映出金色光斑。镜头缓慢推进到广场中央的展示台，
                    人群围拢，圣诞树灯光闪烁。销售引导观众靠近车辆，强调上市福利与智能系统亮点。
                  </div>
                </div>

                <div className={styles.shotCard}>
                  <div className={styles.shotHeader}>
                    <div className={styles.shotTitle}>镜头 2</div>
                    <span className={styles.shotTag}>无需切镜</span>
                  </div>
                  <div className={styles.shotText}>
                    展台中央的UNI-Z车身线条流畅，车顶全景天窗映着飘落雪花。镜头切到人群反应，年轻情侣体验中控与AR导航，
                    询问续航与补能，销售微笑回应并邀请试坐座椅加热。
                  </div>
                </div>
              </div>
            </section>

            <div className={styles.pager}>
              <Link
                className={prev ? styles.pagerBtn : styles.pagerBtnDisabled}
                href={
                  prev
                    ? `/script/storyboard?mode=${mode ?? "brief"}&storyId=${encodeURIComponent(
                        storyIdText || ""
                      )}&scene=${prev.sequence}`
                    : "#"
                }
                aria-disabled={!prev}
              >
                上一场景
              </Link>
              <div className={styles.pagerText}>
                {currentIndex + 1} / {total}
              </div>
              <Link
                className={next ? styles.pagerBtn : styles.pagerBtnDisabled}
                href={
                  next
                    ? `/script/storyboard?mode=${mode ?? "brief"}&storyId=${encodeURIComponent(
                        storyIdText || ""
                      )}&scene=${next.sequence}`
                    : "#"
                }
                aria-disabled={!next}
              >
                下一场景
              </Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
