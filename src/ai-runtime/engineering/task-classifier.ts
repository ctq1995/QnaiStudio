import type { EngineeringTaskClassification, EngineeringTaskKind } from './types'

const RULES: Array<{ kind: EngineeringTaskKind; keywords: string[]; confidence: number }> = [
  { kind: 'bugfix', keywords: ['修复', '报错', '失败', 'bug', 'error', '构建错误', '异常', '不工作'], confidence: 0.85 },
  { kind: 'feature', keywords: ['实现', '增加', '添加', '新功能', '新增', '支持', '接入'], confidence: 0.82 },
  { kind: 'refactor', keywords: ['重构', '优化结构', '整理', '抽象', '拆分'], confidence: 0.78 },
  { kind: 'review', keywords: ['review', '审查', '检查', '评审'], confidence: 0.8 },
  { kind: 'explain', keywords: ['解释', '说明', '为什么', '讲解', '分析一下'], confidence: 0.75 },
]

const MODIFYING_KINDS = new Set<EngineeringTaskKind>(['feature', 'bugfix', 'refactor'])

export function classifyEngineeringTask(userRequest: string): EngineeringTaskClassification {
  const normalized = userRequest.trim().toLowerCase()

  for (const rule of RULES) {
    const matched = rule.keywords.find((keyword) => normalized.includes(keyword.toLowerCase()))
    if (matched) {
      const mayModifyFiles = MODIFYING_KINDS.has(rule.kind)
      return {
        kind: rule.kind,
        mayModifyFiles,
        requiresVerification: mayModifyFiles,
        requiresReview: mayModifyFiles,
        confidence: rule.confidence,
        reason: `Matched keyword: ${matched}`,
      }
    }
  }

  return {
    kind: 'unknown',
    mayModifyFiles: false,
    requiresVerification: false,
    requiresReview: false,
    confidence: 0.3,
    reason: 'No engineering task keyword matched',
  }
}
