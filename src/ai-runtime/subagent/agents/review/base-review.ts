/**
 * Base Review Agent - 审查Agent基类
 *
 * 所有审查Agent的抽象基类，提供：
 * - 统一的审查流程
 * - 问题发现和报告格式
 * - 只读操作约束
 */

import { BaseSubagent } from '../../base-subagent'
import type { SubagentConfig } from '../../types'

/**
 * 审查发现
 */
export interface ReviewIssue {
  /** 问题ID */
  id: string
  /** 严重程度 */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  /** 问题类型 */
  type: string
  /** 文件路径 */
  file: string
  /** 行号 */
  line?: number
  /** 列号 */
  column?: number
  /** 问题描述 */
  message: string
  /** 建议修复 */
  suggestion?: string
  /** 相关代码片段 */
  snippet?: string
  /** 参考链接 */
  references?: string[]
}

/**
 * 审查报告
 */
export interface ReviewReport {
  /** 审查类型 */
  reviewType: string
  /** 审查范围 */
  scope: {
    files: string[]
    lines?: number
  }
  /** 发现的问题 */
  issues: ReviewIssue[]
  /** 统计 */
  stats: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
    total: number
  }
  /** 建议 */
  recommendations: string[]
  /** 执行时间 */
  duration: number
}

/**
 * 审查配置
 */
export interface ReviewConfig extends SubagentConfig {
  /** 目标文件/目录 */
  targets?: string[]
  /** 排除模式 */
  excludes?: string[]
  /** 最小严重程度 */
  minSeverity?: ReviewIssue['severity']
  /** 最大发现数 */
  maxIssues?: number
}

/**
 * 基础审查Agent
 *
 * 所有审查Agent的抽象基类
 */
export abstract class BaseReviewAgent extends BaseSubagent {
  protected issues: ReviewIssue[] = []
  protected targets: string[] = []
  protected excludes: string[] = []
  protected minSeverity: ReviewIssue['severity'] = 'low'
  protected maxIssues: number = 100

  constructor(
    type: 'ReviewFrontend' | 'ReviewSecurity' | 'ReviewArchitecture' | 'ReviewPerformance' | 'ReviewBusinessLogic' | 'ReviewJudge',
    config?: Partial<ReviewConfig>
  ) {
    super(type, config)

    if (config?.targets) {
      this.targets = config.targets
    }
    if (config?.excludes) {
      this.excludes = config.excludes
    }
    if (config?.minSeverity) {
      this.minSeverity = config.minSeverity
    }
    if (config?.maxIssues) {
      this.maxIssues = config.maxIssues
    }
  }

  /**
   * 执行审查
   */
  protected async run(prompt: string): Promise<string> {
    this.reportProgress(`Starting ${this.type} review...`)

    // 1. 解析审查目标
    this.targets = this.parseTargets(prompt)
    this.reportProgress(`Reviewing ${this.targets.length} target(s)`)

    if (this.targets.length === 0) {
      return 'No valid targets specified for review.'
    }

    // 2. 收集文件
    const files = await this.collectFiles()
    this.reportProgress(`Found ${files.length} file(s) to review`)

    // 3. 执行审查
    for (const file of files) {
      await this.reviewFile(file)

      this.nextIteration()
      if (this.checkIterationLimit()) {
        this.reportProgress('Iteration limit reached')
        break
      }
      if (this.issues.length >= this.maxIssues) {
        this.reportProgress('Max issues reached')
        break
      }
    }

    // 4. 生成报告
    const report = this.generateReport()
    return this.formatReport(report)
  }

  /**
   * 子类实现的具体审查逻辑
   */
  protected abstract reviewFile(file: string): Promise<void>

  /**
   * 解析审查目标
   */
  protected parseTargets(prompt: string): string[] {
    // 尝试从提示中提取文件路径
    const pathMatch = prompt.match(/(?:file|path|in|review):\s*([^\s,]+)/gi)
    if (pathMatch) {
      return pathMatch.map((m) => m.replace(/(?:file|path|in|review):\s*/gi, ''))
    }

    // 如果提示中包含路径模式
    const paths = prompt.split(/[\s,]+/).filter((s) => s.includes('/') || s.includes('\\') || s.endsWith('.ts') || s.endsWith('.tsx'))
    if (paths.length > 0) {
      return paths
    }

    // 默认审查当前工作区
    return [this.getWorkspacePath()]
  }

  /**
   * 收集要审查的文件
   */
  protected async collectFiles(): Promise<string[]> {
    const files: string[] = []

    for (const target of this.targets) {
      // 检查是否是文件
      if (target.endsWith('.ts') || target.endsWith('.tsx') || target.endsWith('.js') || target.endsWith('.jsx')) {
        files.push(target)
        continue
      }

      // 使用Glob搜索
      try {
        const result = await this.callTool<string[]>('Glob', {
          pattern: `${target}/**/*.ts`,
          path: this.getWorkspacePath(),
        })
        if (Array.isArray(result)) {
          files.push(...result)
        }
      } catch {
        // 忽略错误
      }

      try {
        const result = await this.callTool<string[]>('Glob', {
          pattern: `${target}/**/*.tsx`,
          path: this.getWorkspacePath(),
        })
        if (Array.isArray(result)) {
          files.push(...result)
        }
      } catch {
        // 忽略错误
      }
    }

    // 过滤排除的文件
    return files.filter((f) => !this.excludes.some((e) => f.includes(e)))
  }

  /**
   * 添加问题
   */
  protected addIssue(issue: Omit<ReviewIssue, 'id'>): void {
    // 检查严重程度过滤
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
    if (severityOrder[issue.severity] > severityOrder[this.minSeverity]) {
      return
    }

    this.issues.push({
      ...issue,
      id: `issue-${this.issues.length}`,
    })
  }

  /**
   * 读取文件内容
   */
  protected async readFileContent(file: string): Promise<string | null> {
    try {
      const content = await this.callTool<string>('Read', { file_path: file })
      return typeof content === 'string' ? content : null
    } catch {
      return null
    }
  }

  /**
   * 搜索模式
   */
  protected async searchPattern(pattern: string, path?: string): Promise<Array<{ path: string; line: number; content: string }>> {
    try {
      const result = await this.callTool<Array<{ path: string; line: number; content: string }>>('Grep', {
        pattern,
        path: path ?? this.getWorkspacePath(),
        output_mode: 'content',
        head_limit: 50,
      })
      return Array.isArray(result) ? result : []
    } catch {
      return []
    }
  }

  /**
   * 生成审查报告
   */
  protected generateReport(): ReviewReport {
    const stats = {
      critical: this.issues.filter((i) => i.severity === 'critical').length,
      high: this.issues.filter((i) => i.severity === 'high').length,
      medium: this.issues.filter((i) => i.severity === 'medium').length,
      low: this.issues.filter((i) => i.severity === 'low').length,
      info: this.issues.filter((i) => i.severity === 'info').length,
      total: this.issues.length,
    }

    const recommendations = this.generateRecommendations()

    return {
      reviewType: this.type,
      scope: {
        files: this.targets,
      },
      issues: this.issues,
      stats,
      recommendations,
      duration: 0, // 由外部设置
    }
  }

  /**
   * 生成建议
   */
  protected generateRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.issues.some((i) => i.severity === 'critical')) {
      recommendations.push('Address all critical issues immediately before deployment')
    }
    if (this.issues.some((i) => i.severity === 'high')) {
      recommendations.push('Resolve high severity issues in the current sprint')
    }
    if (this.issues.length > 10) {
      recommendations.push('Consider breaking down the review into smaller batches')
    }

    return recommendations
  }

  /**
   * 格式化报告输出
   */
  protected formatReport(report: ReviewReport): string {
    const lines: string[] = [
      `# ${report.reviewType} Report`,
      '',
      '## Summary',
      '',
      `| Severity | Count |`,
      `|----------|-------|`,
      `| Critical | ${report.stats.critical} |`,
      `| High | ${report.stats.high} |`,
      `| Medium | ${report.stats.medium} |`,
      `| Low | ${report.stats.low} |`,
      `| Info | ${report.stats.info} |`,
      `| **Total** | ${report.stats.total} |`,
      '',
      '---',
      '',
    ]

    if (report.issues.length > 0) {
      lines.push('## Issues', '')

      for (const issue of report.issues) {
        const severityBadge = this.getSeverityBadge(issue.severity)
        lines.push(`### ${severityBadge} ${issue.type}`)
        lines.push(`- **File**: ${issue.file}${issue.line ? `:${issue.line}` : ''}`)
        lines.push(`- **Message**: ${issue.message}`)
        if (issue.suggestion) {
          lines.push(`- **Suggestion**: ${issue.suggestion}`)
        }
        lines.push('')
      }
    }

    if (report.recommendations.length > 0) {
      lines.push('## Recommendations', '')
      for (const rec of report.recommendations) {
        lines.push(`- ${rec}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * 获取严重程度徽章
   */
  protected getSeverityBadge(severity: ReviewIssue['severity']): string {
    const badges: Record<ReviewIssue['severity'], string> = {
      critical: '[CRITICAL]',
      high: '[HIGH]',
      medium: '[MEDIUM]',
      low: '[LOW]',
      info: '[INFO]',
    }
    return badges[severity]
  }
}
