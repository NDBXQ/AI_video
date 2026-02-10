export function formatAgentError(message: string): string {
  return `<response>\n❌ 执行出错：${message}\n\n请选择以下操作：\n👉 输入"重试"重新执行此步骤\n👉 输入"返回"返回上一步骤\n</response>`
}

