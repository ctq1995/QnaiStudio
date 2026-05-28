import type { EngineeringContextBudget } from './token-budget'

export function buildOverflowRecoveryAdvice(budget: EngineeringContextBudget): string[] {
  if (!budget.overflow) return []

  return [
    '减少候选文件数量，只保留与当前任务直接相关的文件。',
    '裁剪大型工具结果，保留开头和结尾。',
    '压缩历史 assistant 消息和旧工具调用结果。',
    '仅保留最近几轮对话。',
    '降低项目指令文件读取上限。',
  ]
}
