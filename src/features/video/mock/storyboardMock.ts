import type { StoryboardItem } from "@/features/video/types"

const BASE_ITEMS: StoryboardItem[] = [
  {
    id: "1",
    scene_no: 1,
    shot_info: {
      shot_duration: 15,
      cut_to: false,
      shot_style: "写实风格"
    },
    shot_content: {
      background: {
        background_name: "广场中央",
        status: "正常状态"
      },
      roles: [
        {
          role_name: "林晓",
          appearance_time_point: 0,
          location_info: "广场中央白色展台前",
          action: "脚步猛地顿住，下意识抬头望去，目光从方案草稿上移开，盯着车尾灯",
          expression: "惊讶/专注",
          speak: null
        },
        {
          role_name: "旁白",
          appearance_time_point: 0,
          location_info: "广场中央",
          action: "发出促销声",
          expression: "",
          speak: {
            time_point: 0,
            tone: "激昂",
            content: "长安UNI-Z新蓝鲸智电SUV——惊喜上市！",
            speed: 1.2,
            emotion: "兴奋"
          }
        }
      ],
      role_items: ["方案草稿", "奶茶"],
      other_items: ["扩音喇叭", "白色展台"],
      shoot: {
        shot_angle: "平视",
        angle: "0.0",
        camera_movement: "固定镜头",
        composition: "中心构图",
        light: "自然光",
        color: "明亮"
      },
      bgm: "有鼓点的背景音乐"
    },
    note: "anime插画，cel-shading上色，色彩明亮"
  },
  {
    id: "2",
    scene_no: 2,
    shot_info: {
      shot_duration: 5,
      cut_to: false,
      shot_style: "写实风格"
    },
    shot_content: {
      background: {
        background_name: "小巷深处",
        status: "血月高悬"
      },
      roles: [
        {
          role_name: "陈骁",
          appearance_time_point: 0,
          location_info: "小巷深处",
          action: "握紧重剑，眼神透露出近乎透明的杀意",
          expression: "冷峻",
          speak: {
            time_point: 0,
            tone: "低沉",
            content: "怪物只是开胃菜……真正的进化游戏，要来了。",
            speed: 1.0,
            emotion: "冷静"
          }
        }
      ],
      role_items: ["重剑"],
      other_items: [],
      shoot: {
        shot_angle: "仰视",
        angle: "15.0",
        camera_movement: "缓慢推镜头",
        composition: "对角线",
        light: "红色月光",
        color: "高对比"
      },
      bgm: "紧张的弦乐"
    }
  }
]

function cloneItem(base: StoryboardItem, nextId: string, sceneNo: number): StoryboardItem {
  const backgroundVariants = [
    { background_name: "城市街道", status: "霓虹闪烁" },
    { background_name: "酒吧吧台", status: "灯光昏暗" },
    { background_name: "酒馆角落", status: "人群喧嚣" },
    { background_name: "巷口转角", status: "危险逼近" },
    { background_name: "狭窄小巷", status: "冷色调" },
    { background_name: "街区门头", status: "红色灯光" },
    { background_name: "擂台场景", status: "紧张气氛" }
  ]

  const bg = backgroundVariants[(sceneNo - 1) % backgroundVariants.length]

  return {
    ...base,
    id: nextId,
    scene_no: sceneNo,
    shot_content: {
      ...base.shot_content,
      background: bg,
      roles: base.shot_content.roles.map((r) => ({
        ...r,
        action: r.action ? `${r.action}（镜头 ${sceneNo}）` : `镜头 ${sceneNo} 的动作描述`,
        speak: r.speak
          ? {
              ...r.speak,
              content: `${r.speak.content}（镜头 ${sceneNo}）`
            }
          : null
      }))
    }
  }
}

export const MOCK_STORYBOARD_ITEMS: StoryboardItem[] = [
  ...BASE_ITEMS,
  ...Array.from({ length: 9 }).map((_, idx) => {
    const sceneNo = idx + 3
    const base = sceneNo % 2 === 0 ? BASE_ITEMS[1] : BASE_ITEMS[0]
    return cloneItem(base, String(sceneNo), sceneNo)
  })
]
