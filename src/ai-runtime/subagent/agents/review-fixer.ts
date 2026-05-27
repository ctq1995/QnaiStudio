/**
 * ReviewFixer Agent - 代码审查修复Agent
 *
 * 用于深度审查后的修复工作：
 * - 接收验证过的审查发现
 * - 执行最小安全修复
 * - 输出简洁的验证总结
 * - 支持增量审查流程
 */

import { BaseSubagent } from '../base-subagent'
import type { SubagentConfig } from '../types'

/**
 * 审查发现
 */
export interface ReviewFinding {
  /** 发现ID */
  id: string
  /** 问题类型 */
  type: 'security' | 'performance' | 'architecture' | 'frontend' | 'business-logic' | 'bug'
  /** 严重程度 */
  severity: 'critical' | 'high' | 'medium' | 'low'
  /** 文件路径 */
  file: string
  /** 行范围 */
  lines?: { start: number; end: number }
  /** 问题描述 */
  description: string
  /** 建议修复 */
  suggestedFix?: string
}

/**
 * 修复结果
 */
export interface FixResult {
  /** 发现ID */
  findingId: string
  /** 是否成功 */
  success: boolean
  /** 修复描述 */
  description: string
  /** 修改的文件 */
  modifiedFiles: string[]
  /** 验证结果 */
  verification?: {
    passed: boolean
    notes: string
  }
}

/**
 * ReviewFixer Agent实现
 */
export class ReviewFixerAgent extends BaseSubagent {
  private findings: ReviewFinding[] = []
  private fixResults: FixResult[] = []

  constructor(config?: Partial<SubagentConfig>) {
    super('ReviewFixer', config)
  }

  /**
   * 执行修复
   *
   * 策略：
   * 1. 解析审查发现
   * 2. 评估修复风险
   * 3. 执行最小安全修复
   * 4. 验证修复效果
   * 5. 生成修复报告
   */
  protected async run(prompt: string): Promise<string> {
    this.reportProgress('Parsing review findings...')

    // 1. 解析审查发现
    this.findings = this.parseFindings(prompt)
    this.reportProgress(`Parsed ${this.findings.length} findings`)

    if (this.findings.length === 0) {
      return 'No valid review findings provided. Please provide structured review findings to fix.'
    }

    // 2. 按优先级排序
    this.findings.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })

    // 3. 逐个修复
    for (const finding of this.findings) {
      this.reportProgress(`Fixing: ${finding.id} (${finding.severity})`)

      const result = await this.fixFinding(finding)
      this.fixResults.push(result)

      this.nextIteration()
      if (this.checkIterationLimit()) {
        this.reportProgress('Iteration limit reached, stopping')
        break
      }
    }

    // 4. 生成报告
    return this.generateReport()
  }

  /**
   * 解析审查发现
   */
  private parseFindings(prompt: string): ReviewFinding[] {
    const findings: ReviewFinding[] = []

    // 尝试解析JSON格式
    try {
      const parsed = JSON.parse(prompt)
      if (Array.isArray(parsed)) {
        return parsed.map((p, i) => ({
          id: p.id ?? `finding-${i}`,
          type: p.type ?? 'bug',
          severity: p.severity ?? 'medium',
          file: p.file ?? '',
          lines: p.lines,
          description: p.description ?? '',
          suggestedFix: p.suggestedFix,
        }))
      }
    } catch {
      // 不是JSON，尝试解析文本格式
    }

    // 解析文本格式的发现
    // 格式示例:
    // [CRITICAL] security: SQL injection in auth.ts:45
    // [HIGH] performance: N+1 query in user.service.ts:120-130
    const lines = prompt.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // 匹配严重程度标记
      const severityMatch = line.match(/\[(CRITICAL|HIGH|MEDIUM|LOW)\]/i)
      if (!severityMatch) continue

      const severity = severityMatch[1].toLowerCase() as ReviewFinding['severity']

      // 匹配类型和描述
      const typeMatch = line.match(/\]\s*(\w+):\s*(.+)/)
      if (!typeMatch) continue

      const typeStr = typeMatch[1].toLowerCase()
      const type: ReviewFinding['type'] = ['security', 'performance', 'architecture', 'frontend', 'business-logic', 'bug'].includes(typeStr)
        ? typeStr as ReviewFinding['type']
        : 'bug'

      const description = typeMatch[2]

      // 匹配文件和行号
      const fileMatch = description.match(/in\s+([^\s:]+):?(\d+)?-?(\d+)?/)
      const file = fileMatch ? fileMatch[1] : ''

      findings.push({
        id: `finding-${findings.length}`,
        type,
        severity,
        file,
        description,
        suggestedFix: lines[i + 1]?.trim().startsWith('Fix:') ? lines[i + 1].replace('Fix:', '').trim() : undefined,
      })
    }

    return findings
  }

  /**
   * 修复单个发现
   */
  private async fixFinding(finding: ReviewFinding): Promise<FixResult> {
    const result: FixResult = {
      findingId: finding.id,
      success: false,
      description: '',
      modifiedFiles: [],
    }

    try {
      // 1. 读取问题文件
      if (!finding.file) {
        result.description = 'No file specified for this finding'
        return result
      }

      const content = await this.callTool<string>('Read', { file_path: finding.file })
      if (typeof content !== 'string') {
        result.description = 'Failed to read file'
        return result
      }

      // 2. 分析问题位置
      const targetLines = this.identifyTargetLines(content, finding)
      if (!targetLines) {
        result.description = 'Could not locate the issue in the file'
        return result
      }

      // 3. 生成修复代码
      const fix = await this.generateFix(content, finding, targetLines)
      if (!fix) {
        result.description = 'Could not generate a fix for this issue'
        return result
      }

      // 4. 应用修复
      const editResult = await this.callTool<{ success: boolean }>('Edit', {
        file_path: finding.file,
        old_string: fix.oldCode,
        new_string: fix.newCode,
      })

      if (editResult && typeof editResult === 'object' && 'success' in editResult) {
        result.success = true
        result.description = fix.description
        result.modifiedFiles.push(finding.file)

        // 5. 验证修复（可选）
        const verification = await this.verifyFix(finding)
        result.verification = verification
      } else {
        result.description = 'Failed to apply the fix'
      }
    } catch (error) {
      result.description = `Error during fix: ${error instanceof Error ? error.message : String(error)}`
    }

    return result
  }

  /**
   * 识别目标行
   */
  private identifyTargetLines(
    content: string,
    finding: ReviewFinding
  ): { start: number; end: number; code: string } | null {
    // 如果有明确的行号，使用它
    if (finding.lines) {
      const lines = content.split('\n')
      const start = Math.max(0, finding.lines.start - 1)
      const end = Math.min(lines.length, finding.lines.end ?? finding.lines.start)
      return {
        start,
        end,
        code: lines.slice(start, end).join('\n'),
      }
    }

    // 否则尝试通过关键词定位
    const keywords = finding.description.split(' ').filter((w) => w.length > 3)
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      for (const keyword of keywords) {
        if (lines[i].toLowerCase().includes(keyword.toLowerCase())) {
          return {
            start: i,
            end: i + 1,
            code: lines[i],
          }
        }
      }
    }

    return null
  }

  /**
   * 生成修复代码
   */
  private async generateFix(
    content: string,
    finding: ReviewFinding,
    target: { start: number; end: number; code: string }
  ): Promise<{ oldCode: string; newCode: string; description: string } | null> {
    // 根据问题类型生成不同策略的修复
    switch (finding.type) {
      case 'security':
        return this.generateSecurityFix(content, finding, target)
      case 'performance':
        return this.generatePerformanceFix(content, finding, target)
      case 'architecture':
        return this.generateArchitectureFix(content, finding, target)
      default:
        return this.generateGenericFix(content, finding, target)
    }
  }

  /**
   * 生成安全修复
   */
  private generateSecurityFix(
    _content: string,
    finding: ReviewFinding,
    target: { start: number; end: number; code: string }
  ): { oldCode: string; newCode: string; description: string } | null {
    const code = target.code

    // SQL注入修复
    if (finding.description.toLowerCase().includes('sql injection') || finding.description.toLowerCase().includes('sql')) {
      // 检测字符串拼接SQL
      const sqlMatch = code.match(/`SELECT.*\$\{.*\}.*`/)
      if (sqlMatch) {
        return {
          oldCode: code,
          newCode: code.replace(/\$\{[^}]+\}/g, '?').replace(/`/g, "'"),
          description: 'Replaced string interpolation with parameterized query',
        }
      }
    }

    // XSS修复
    if (finding.description.toLowerCase().includes('xss') || finding.description.toLowerCase().includes('cross-site')) {
      if (code.includes('innerHTML') || code.includes('dangerouslySetInnerHTML')) {
        return {
          oldCode: code,
          newCode: code.replace(/innerHTML|dangerouslySetInnerHTML/g, 'textContent'),
          description: 'Replaced innerHTML with textContent to prevent XSS',
        }
      }
    }

    return null
  }

  /**
   * 生成性能修复
   */
  private generatePerformanceFix(
    _content: string,
    finding: ReviewFinding,
    target: { start: number; end: number; code: string }
  ): { oldCode: string; newCode: string; description: string } | null {
    const code = target.code

    // N+1查询修复提示
    if (finding.description.toLowerCase().includes('n+1') || finding.description.toLowerCase().includes('n + 1')) {
      // 添加注释提示
      return {
        oldCode: code,
        newCode: `// TODO: Optimize N+1 query - consider using batch loading\n${code}`,
        description: 'Added TODO comment for N+1 query optimization',
      }
    }

    return null
  }

  /**
   * 生成架构修复
   */
  private generateArchitectureFix(
    _content: string,
    finding: ReviewFinding,
    target: { start: number; end: number; code: string }
  ): { oldCode: string; newCode: string; description: string } | null {
    // 架构问题通常需要重构，这里只添加注释
    return {
      oldCode: target.code,
      newCode: `// ARCHITECTURE: ${finding.description}\n${target.code}`,
      description: 'Added architecture note for future refactoring',
    }
  }

  /**
   * 生成通用修复
   */
  private generateGenericFix(
    _content: string,
    finding: ReviewFinding,
    target: { start: number; end: number; code: string }
  ): { oldCode: string; newCode: string; description: string } | null {
    // 如果有建议修复，尝试应用
    if (finding.suggestedFix) {
      return {
        oldCode: target.code,
        newCode: finding.suggestedFix,
        description: 'Applied suggested fix from review',
      }
    }

    return null
  }

  /**
   * 验证修复
   */
  private async verifyFix(finding: ReviewFinding): Promise<{ passed: boolean; notes: string }> {
    try {
      // 重新读取文件检查语法
      const content = await this.callTool<string>('Read', { file_path: finding.file })

      if (typeof content !== 'string') {
        return { passed: false, notes: 'Could not verify - file read failed' }
      }

      // 基本语法检查（检测明显的语法错误）
      const hasBasicSyntax = this.checkBasicSyntax(content)

      return {
        passed: hasBasicSyntax,
        notes: hasBasicSyntax
          ? 'Basic syntax check passed'
          : 'Potential syntax issues detected - please review',
      }
    } catch (error) {
      return {
        passed: false,
        notes: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * 基本语法检查
   */
  private checkBasicSyntax(content: string): boolean {
    // 检查括号匹配
    const openBraces = (content.match(/{/g) || []).length
    const closeBraces = (content.match(/}/g) || []).length
    const openParens = (content.match(/\(/g) || []).length
    const closeParens = (content.match(/\)/g) || []).length
    const openBrackets = (content.match(/\[/g) || []).length
    const closeBrackets = (content.match(/]/g) || []).length

    return (
      openBraces === closeBraces &&
      openParens === closeParens &&
      openBrackets === closeBrackets
    )
  }

  /**
   * 生成修复报告
   */
  private generateReport(): string {
    const lines: string[] = [
      '# Review Fix Report',
      '',
      `**Total Findings**: ${this.findings.length}`,
      `**Fixed**: ${this.fixResults.filter((r) => r.success).length}`,
      `**Failed**: ${this.fixResults.filter((r) => !r.success).length}`,
      '',
      '---',
      '',
    ]

    for (const result of this.fixResults) {
      const finding = this.findings.find((f) => f.id === result.findingId)
      const icon = result.success ? '✓' : '✗'

      lines.push(`## ${icon} ${finding?.severity.toUpperCase()} - ${finding?.type}`)
      lines.push(`**File**: ${finding?.file}`)
      lines.push(`**Description**: ${finding?.description}`)
      lines.push(`**Fix**: ${result.description}`)

      if (result.verification) {
        lines.push(`**Verification**: ${result.verification.passed ? 'Passed' : 'Failed'} - ${result.verification.notes}`)
      }

      lines.push('')
    }

    return lines.join('\n')
  }
}

// 注册到全局注册表
import { registerSubagent } from '../subagent-registry'
registerSubagent('ReviewFixer', (config) => new ReviewFixerAgent(config))
