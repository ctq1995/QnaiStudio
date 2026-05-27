/**
 * ReviewJudge Agent - 审查仲裁Agent
 *
 * 独立第三方仲裁者，验证审查报告的：
 * - 逻辑一致性
 * - 证据质量
 * - 抽样代码位置验证
 */

import { BaseSubagent } from '../../base-subagent'
import type { SubagentConfig } from '../../types'

/**
 * 审查报告
 */
interface ReviewReportInput {
  reviewType: string
  issues: Array<{
    id: string
    severity: string
    type: string
    file: string
    line?: number
    message: string
    snippet?: string
  }>
  recommendations: string[]
}

/**
 * 仲裁结果
 */
interface JudgmentResult {
  isValid: boolean
  confidence: number // 0-1
  issues: Array<{
    reportIssueId: string
    judgment: 'valid' | 'invalid' | 'uncertain'
    reason: string
    evidence?: string
  }>
  summary: string
}

/**
 * ReviewJudge Agent
 */
export class ReviewJudgeAgent extends BaseSubagent {
  constructor(config?: Partial<SubagentConfig>) {
    super('ReviewJudge', config)
  }

  /**
   * 执行仲裁
   */
  protected async run(prompt: string): Promise<string> {
    this.reportProgress('Parsing review report for judgment...')

    // 1. 解析审查报告
    const report = this.parseReport(prompt)
    if (!report) {
      return 'Invalid review report format. Please provide a structured review report.'
    }

    this.reportProgress(`Judging ${report.issues.length} issues from ${report.reviewType}`)

    // 2. 执行仲裁
    const judgment = await this.judgeReport(report)

    // 3. 生成仲裁报告
    return this.formatJudgment(judgment)
  }

  /**
   * 解析审查报告
   */
  private parseReport(prompt: string): ReviewReportInput | null {
    // 尝试JSON解析
    try {
      const parsed = JSON.parse(prompt)
      if (parsed.issues && Array.isArray(parsed.issues)) {
        return parsed as ReviewReportInput
      }
    } catch {
      // 不是JSON，尝试文本解析
    }

    // 文本格式解析
    const issues: ReviewReportInput['issues'] = []
    const lines = prompt.split('\n')

    let currentIssue: Partial<ReviewReportInput['issues'][0]> = {}

    for (const line of lines) {
      // 检测问题标记
      const issueMatch = line.match(/\[(CRITICAL|HIGH|MEDIUM|LOW|INFO)\]\s+(\w+)\s*:\s*(.+)/i)
      if (issueMatch) {
        if (currentIssue.id) {
          issues.push(currentIssue as ReviewReportInput['issues'][0])
        }
        currentIssue = {
          id: `issue-${issues.length}`,
          severity: issueMatch[1].toLowerCase(),
          type: issueMatch[2],
          message: issueMatch[3],
        }
        continue
      }

      // 检测文件路径
      const fileMatch = line.match(/(?:file|path):\s*([^\s]+)/i)
      if (fileMatch) {
        currentIssue.file = fileMatch[1]
      }

      // 检测行号
      const lineMatch = line.match(/line:\s*(\d+)/i)
      if (lineMatch) {
        currentIssue.line = parseInt(lineMatch[1])
      }
    }

    if (currentIssue.id) {
      issues.push(currentIssue as ReviewReportInput['issues'][0])
    }

    if (issues.length === 0) {
      return null
    }

    return {
      reviewType: 'unknown',
      issues,
      recommendations: [],
    }
  }

  /**
   * 仲裁审查报告
   */
  private async judgeReport(report: ReviewReportInput): Promise<JudgmentResult> {
    const issues: JudgmentResult['issues'] = []
    let validCount = 0
    let invalidCount = 0
    let uncertainCount = 0

    // 抽样验证关键问题
    const criticalIssues = report.issues.filter((i) => i.severity === 'critical' || i.severity === 'high')
    const sampleIssues = criticalIssues.length > 0
      ? criticalIssues.slice(0, 5) // 抽样前5个关键问题
      : report.issues.slice(0, 3) // 或前3个普通问题

    for (const issue of sampleIssues) {
      this.reportProgress(`Verifying issue ${issue.id}...`)

      const judgment = await this.verifyIssue(issue)
      issues.push(judgment)

      if (judgment.judgment === 'valid') validCount++
      else if (judgment.judgment === 'invalid') invalidCount++
      else uncertainCount++

      this.nextIteration()
      if (this.checkIterationLimit()) break
    }

    // 计算置信度
    const totalChecked = validCount + invalidCount + uncertainCount
    const confidence = totalChecked > 0 ? validCount / totalChecked : 0

    // 判断报告整体有效性
    const isValid = invalidCount === 0 && confidence > 0.5

    // 生成摘要
    const summary = this.generateSummary(report, validCount, invalidCount, uncertainCount, confidence)

    return {
      isValid,
      confidence,
      issues,
      summary,
    }
  }

  /**
   * 验证单个问题
   */
  private async verifyIssue(issue: ReviewReportInput['issues'][0]): Promise<JudgmentResult['issues'][0]> {
    // 检查是否有文件路径
    if (!issue.file) {
      return {
        reportIssueId: issue.id,
        judgment: 'uncertain',
        reason: 'No file path specified for verification',
      }
    }

    try {
      // 读取文件内容
      const content = await this.callTool<string>('Read', { file_path: issue.file })
      if (typeof content !== 'string') {
        return {
          reportIssueId: issue.id,
          judgment: 'uncertain',
          reason: 'Could not read file for verification',
        }
      }

      // 检查指定行是否存在问题
      if (issue.line) {
        const lines = content.split('\n')
        const targetLine = lines[issue.line - 1]

        if (!targetLine) {
          return {
            reportIssueId: issue.id,
            judgment: 'invalid',
            reason: `Line ${issue.line} does not exist in file`,
          }
        }

        // 验证问题类型是否匹配
        const isValidIssue = this.matchIssuePattern(targetLine, issue.type, issue.message)

        if (isValidIssue) {
          return {
            reportIssueId: issue.id,
            judgment: 'valid',
            reason: 'Issue pattern verified at specified location',
            evidence: targetLine.trim(),
          }
        } else {
          return {
            reportIssueId: issue.id,
            judgment: 'invalid',
            reason: 'Issue pattern not found at specified location',
            evidence: targetLine.trim(),
          }
        }
      } else {
        // 没有行号，搜索文件内容
        const matchLine = this.searchIssuePattern(content, issue.type, issue.message)

        if (matchLine >= 0) {
          return {
            reportIssueId: issue.id,
            judgment: 'valid',
            reason: `Issue pattern found at line ${matchLine + 1}`,
            evidence: content.split('\n')[matchLine].trim(),
          }
        } else {
          return {
            reportIssueId: issue.id,
            judgment: 'uncertain',
            reason: 'Could not locate issue pattern in file',
          }
        }
      }
    } catch (error) {
      return {
        reportIssueId: issue.id,
        judgment: 'uncertain',
        reason: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * 匹配问题模式
   */
  private matchIssuePattern(line: string, type: string, _message: string): boolean {
    // 根据问题类型定义匹配模式
    const patterns: Record<string, RegExp[]> = {
      'sql-injection': [/`SELECT.*\$\{/, /`INSERT.*\$\{/, /query\(/],
      'xss': [/innerHTML/, /dangerouslySetInnerHTML/, /v-html/],
      'command-injection': [/exec\(/, /eval\(/, /spawn\(/],
      'n+1-query': [/for.*await.*query/, /\.map.*await.*find/],
      'memory-leak': [/addEventListener.*removeEventListener/],
      'blocking-io': [/readFileSync/, /writeFileSync/],
      'null-handling': [/\.\w+\.\w+/, /\w+\[\d+\]/],
      'input-validation': [/req\.body/, /params/, /query/],
    }

    const typePatterns = patterns[type] || []
    return typePatterns.some((p) => p.test(line))
  }

  /**
   * 搜索问题模式
   */
  private searchIssuePattern(content: string, type: string, message: string): number {
    const lines = content.split('\n')

    // 从消息中提取关键词
    const keywords = message.toLowerCase().split(' ').filter((w) => w.length > 3)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase()

      // 检查类型模式
      if (this.matchIssuePattern(lines[i], type, message)) {
        return i
      }

      // 检查关键词匹配
      const matchCount = keywords.filter((k) => line.includes(k)).length
      if (matchCount >= 2) {
        return i
      }
    }

    return -1
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    report: ReviewReportInput,
    validCount: number,
    invalidCount: number,
    uncertainCount: number,
    confidence: number
  ): string {
    const lines: string[] = [
      `Review report from ${report.reviewType} analyzed.`,
      '',
      `**Issues Verified**: ${validCount + invalidCount + uncertainCount}`,
      `- Valid: ${validCount}`,
      `- Invalid: ${invalidCount}`,
      `- Uncertain: ${uncertainCount}`,
      '',
      `**Confidence**: ${(confidence * 100).toFixed(0)}%`,
    ]

    if (invalidCount > 0) {
      lines.push('')
      lines.push('**Warning**: Some issues could not be verified. The review report may contain false positives.')
    }

    return lines.join('\n')
  }

  /**
   * 格式化仲裁结果
   */
  private formatJudgment(judgment: JudgmentResult): string {
    const lines: string[] = [
      '# Review Judgment Report',
      '',
      `**Verdict**: ${judgment.isValid ? 'VALID' : 'INVALID'}`,
      `**Confidence**: ${(judgment.confidence * 100).toFixed(0)}%`,
      '',
      '---',
      '',
      '## Issue Verifications',
      '',
    ]

    for (const issue of judgment.issues) {
      const icon = issue.judgment === 'valid' ? '✓' : issue.judgment === 'invalid' ? '✗' : '?'
      lines.push(`### ${icon} Issue ${issue.reportIssueId}`)
      lines.push(`**Judgment**: ${issue.judgment.toUpperCase()}`)
      lines.push(`**Reason**: ${issue.reason}`)
      if (issue.evidence) {
        lines.push(`**Evidence**: \`${issue.evidence}\``)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
    lines.push('## Summary')
    lines.push('')
    lines.push(judgment.summary)

    return lines.join('\n')
  }
}

// 注册
import { registerSubagent } from '../../subagent-registry'
registerSubagent('ReviewJudge', (config) => new ReviewJudgeAgent(config))
