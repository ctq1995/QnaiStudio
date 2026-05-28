import type { EngineeringRunSummary } from './types'
import { extractChangedFilesFromDiff } from './verification-policy'

export function buildEngineeringFinalMessage(summary: Omit<EngineeringRunSummary, 'finalMessage'>): string {
  const lines: string[] = []
  const changedFiles = summary.diff ? extractChangedFilesFromDiff(summary.diff) : []

  lines.push('## 工程执行总结')
  lines.push('')
  lines.push(`- 任务类型：${summary.classification.kind}`)
  lines.push(`- 分类依据：${summary.classification.reason}`)
  if (summary.context) {
    lines.push(`- 上下文候选文件：${summary.context.candidateFiles.length} 个`)
    lines.push(`- 项目指令文件：${summary.context.instructions.files.length} 个`)
    const tools = summary.context.projectSignals.buildTools.join(', ') || '未识别'
    lines.push(`- 项目信号：${tools}`)
  }
  lines.push(`- 快照：${formatSnapshot(summary.snapshot)}`)

  if (changedFiles.length > 0) {
    lines.push(`- 修改文件：${changedFiles.length} 个`)
    for (const file of changedFiles.slice(0, 20)) {
      lines.push(`  - ${file}`)
    }
    if (changedFiles.length > 20) {
      lines.push(`  - 其余 ${changedFiles.length - 20} 个文件已省略`)
    }
  } else {
    lines.push('- 修改文件：未检测到 Git diff')
  }

  if (summary.verificationResults.length > 0) {
    lines.push('- 验证：')
    for (const result of summary.verificationResults) {
      lines.push(`  - ${result.command.label}：${result.success ? '通过' : '失败'}`)
    }
  } else {
    lines.push('- 验证：未运行')
  }

  if (summary.review.skipped) {
    lines.push('- Review：已跳过')
  } else {
    lines.push(`- Review：${summary.review.success ? '完成' : '失败'}`)
  }

  lines.push(`- 结果：${summary.success ? '成功' : '失败'}`)
  if (summary.failedStage) lines.push(`- 失败阶段：${summary.failedStage}`)
  if (summary.agentResult?.error) lines.push(`- Agent 错误：${summary.agentResult.error}`)
  if (summary.diffError) lines.push(`- Diff 错误：${summary.diffError}`)
  if (summary.review.error) lines.push(`- Review 错误：${summary.review.error}`)

  return lines.join('\n')
}

function formatSnapshot(snapshot: EngineeringRunSummary['snapshot']): string {
  if (snapshot.created) return snapshot.versionId ? `已创建 ${snapshot.versionId}` : '已创建'
  return snapshot.error ? `未创建（${snapshot.error}）` : '未创建'
}
