import Link from "next/link"
import type { ReactElement } from "react"
import styles from "./HelpDoc.module.css"

export type DocSection = {
  id: string
  title: string
  content: ReactElement
}

function InlineCode({ children }: { children: string }): ReactElement {
  return <span className={styles.inlineCode}>{children}</span>
}

function CodeBlock({ children }: { children: string }): ReactElement {
  return (
    <pre className={styles.codeBlock}>
      <code>{children}</code>
    </pre>
  )
}

function Callout({ title, children }: { title: string; children: ReactElement }): ReactElement {
  return (
    <div className={styles.callout}>
      <div className={styles.calloutTitle}>{title}</div>
      <div className={styles.calloutText}>{children}</div>
    </div>
  )
}

export function buildHelpSections(): DocSection[] {
  return [
    {
      id: "quickstart",
      title: "快速开始",
      content: (
        <>
          <p className={styles.p}>
            这个项目是一个基于 Next.js（App Router）的 AI 视频创作平台，主要包含三条路径：内容库 → 剧本创作 → 视频创作（分镜/生图/生视频）。
          </p>
          <ul className={styles.list}>
            <li>
              从 <Link className={styles.link} href="/library">内容库</Link> 选择已有故事继续创作，或导入/管理素材。
            </li>
            <li>
              在 <Link className={styles.link} href="/script/workspace?entry=nav">剧本创作</Link> 生成大纲与改写内容，再一键生成分镜文本。
            </li>
            <li>
              在 <Link className={styles.link} href="/video?tab=list">视频创作</Link> 管理分镜列表/故事板，并进入生图/生视频工作台完成制作。
            </li>
          </ul>
          <Callout title="推荐路径">
            <span>
              如果你是第一次使用，建议先从 <Link className={styles.link} href="/script/workspace?entry=nav">剧本创作</Link> 入口态创建故事 → 生成大纲，再进入视频创作。
            </span>
          </Callout>
        </>
      )
    },
    {
      id: "auth",
      title: "账号与登录",
      content: (
        <>
          <h3 id="login" className={styles.h3}>
            登录
          </h3>
          <p className={styles.p}>
            访问需要登录的页面时，如果会话已过期会提示去登录。登录成功后，会在右上角显示账号信息，并可点击退出。
          </p>
          <ul className={styles.list}>
            <li>
              登录页：<Link className={styles.link} href="/login">/login</Link>
            </li>
            <li>
              会话 cookie：<InlineCode>ai_video_session</InlineCode>
            </li>
          </ul>
          <Callout title="开发环境提示">
            <span>
              如果服务端日志出现 <InlineCode>AUTH_SESSION_SECRET 未设置</InlineCode> 的 warn，表示会使用开发默认值；生产环境应配置该变量。
            </span>
          </Callout>
        </>
      )
    },
    {
      id: "library",
      title: "内容库（继续创作/素材管理）",
      content: (
        <>
          <p className={styles.p}>内容库是你的“起点与中转站”：可以继续之前的故事，也可以管理公共/私有素材。</p>
          <ul className={styles.list}>
            <li>我的故事：根据故事进度跳转到剧本工作台或视频创作页继续。</li>
            <li>公共素材：可查看/上传/导入，在后续生图/生视频中复用。</li>
          </ul>
          <Callout title="继续创作逻辑">
            <span>内容库会根据故事的阶段（progress stage）决定下一站：大纲阶段回到剧本工作台，完成大纲后进入视频创作。</span>
          </Callout>
        </>
      )
    },
    {
      id: "script-workspace",
      title: "剧本创作（大纲/改写/生成分镜文本）",
      content: (
        <>
          <h3 id="script-start" className={styles.h3}>
            创建项目（入口态）
          </h3>
          <p className={styles.p}>剧本工作台分为入口态与详情态：入口态用于创建故事；详情态用于查看大纲、改写并生成分镜文本。</p>
          <ul className={styles.list}>
            <li>入口态：选择“从故事原文开始”或“从剧情简介开始”。</li>
            <li>左侧：大纲章节列表；中间：预览；右侧：改写输入与对话。</li>
            <li>下一步：点击“一键生成”生成分镜文本，系统会跳转到视频创作页。</li>
          </ul>
          <h3 id="script-outline" className={styles.h3}>
            生成大纲
          </h3>
          <Callout title="两种生成方式">
            <span>“一键生成”会直接触发生成并跳转；“手动生成”用于你希望更可控地编辑需求后再生成的场景。</span>
          </Callout>
          <h3 id="script-storyboard" className={styles.h3}>
            生成分镜脚本
          </h3>
        </>
      )
    },
    {
      id: "video-creation",
      title: "视频创作（分镜管理 → 生图/生视频）",
      content: (
        <>
          <p className={styles.p}>视频创作页用于管理同一故事下的分镜（shots），支持列表与故事板两种视图，并可进入生图/生视频工作台。</p>
          <ul className={styles.list}>
            <li>
              分镜列表：<InlineCode>/video?tab=list</InlineCode>，适合批量查看/编辑/生成。
            </li>
            <li>
              故事板：<InlineCode>/video?tab=board</InlineCode>，适合按顺序浏览分镜画面与提示信息。
            </li>
            <li>进入工作台：选择某个镜头后进入生图或生视频页面继续制作。</li>
          </ul>
          <h3 id="video-generate" className={styles.h3}>
            发起生成与查看进度
          </h3>
          <p className={styles.p}>发起生成后可以在页面就地查看请求状态，也可以打开右上角“任务中心”跟踪后台任务。</p>
          <h3 id="video-export" className={styles.h3}>
            导出与沉淀到内容库
          </h3>
          <p className={styles.p}>建议在每个阶段都把成果保存到内容库，便于回溯、复用素材与继续创作。</p>
        </>
      )
    },
    {
      id: "task-center",
      title: "任务中心（进度跟踪/失败定位）",
      content: (
        <>
          <p className={styles.p}>任务中心用于汇总你当前故事的后台生成任务（排队/进行中/失败），并帮助你快速定位问题。</p>
          <ul className={styles.list}>
            <li>入口：右上角“任务中心”按钮。</li>
            <li>建议做法：失败时优先复制错误信息里的 traceId，用于定位服务端日志。</li>
            <li>没有任务时：去分镜列表发起生成，任务中心会自动更新。</li>
          </ul>
        </>
      )
    },
    {
      id: "tvc",
      title: "TVC（广告一键成片）",
      content: (
        <>
          <p className={styles.p}>如果你要做广告成片，可使用 TVC 入口（输入产品/风格 → 生成脚本与成片）。</p>
          <p className={styles.p}>本节仅作为入口说明，平台主链路仍推荐从“内容库 → 剧本 → 视频创作”开始。</p>
        </>
      )
    },
    {
      id: "image-workbench",
      title: "生图工作台（参考图/提示词/合成）",
      content: (
        <>
          <p className={styles.p}>生图工作台用于为镜头准备参考图与提示词，并生成/合成所需的图片素材，供后续视频生成使用。</p>
          <ul className={styles.list}>
            <li>常见动作：设置提示词、上传/导入参考图、生成参考图、合成图片。</li>
            <li>参考图素材会在内容库/生成记录中可复用。</li>
          </ul>
        </>
      )
    },
    {
      id: "video-workbench",
      title: "生视频工作台（参数/时间线/生成）",
      content: (
        <>
          <p className={styles.p}>生视频工作台用于配置视频生成参数、管理片段时间线（如有）、触发生成并查看进度与结果。</p>
          <ul className={styles.list}>
            <li>常见动作：设置视频提示词/时长/模式等参数，生成视频并预览。</li>
            <li>生成进度通常通过 job 事件更新（前端会轮询或订阅进度）。</li>
          </ul>
        </>
      )
    },
    {
      id: "troubleshooting",
      title: "常见问题与排障",
      content: (
        <>
          <p className={styles.p}>遇到 500/生成失败/素材不可用时，优先从浏览器 Network 与服务端日志定位 traceId。</p>
          <ul className={styles.list}>
            <li>
              Server Actions 报错：<InlineCode>x-forwarded-host</InlineCode> 与 <InlineCode>origin</InlineCode> 不匹配会导致 “Invalid Server Actions request”。
            </li>
            <li>
              S3 未配置：上传/导入素材时报 <InlineCode>S3 storage not configured</InlineCode>，需要配置 BUCKET 相关环境变量。
            </li>
            <li>
              DB 未配置：依赖 <InlineCode>PGDATABASE_URL</InlineCode>（或 DATABASE_URL/POSTGRES_URL）；缺失会导致读写失败。
            </li>
          </ul>
          <Callout title="建议做法">
            <span>优先修正网关转发头（Host/X-Forwarded-Host/X-Forwarded-Proto）与外网域名一致；必要时再配置 serverActions allowedOrigins 白名单。</span>
          </Callout>
        </>
      )
    },
    {
      id: "dev",
      title: "开发者：本地开发与配置",
      content: (
        <>
          <p className={styles.p}>本项目常用开发命令如下（依赖 Node + npm）：</p>
          <CodeBlock>
            {`npm i
npm run dev -- -p 3001

npm run lint
npm run build

npm run db:push
npm run db:studio`}
          </CodeBlock>
          <p className={styles.p}>
            环境变量以 <InlineCode>.env.local</InlineCode> 为主，常见类别：数据库连接（PGDATABASE_URL）、会话密钥（AUTH_SESSION_SECRET）、存储（BUCKET_*）以及生成相关的第三方端点（COZE_*）。
          </p>
        </>
      )
    }
  ]
}
