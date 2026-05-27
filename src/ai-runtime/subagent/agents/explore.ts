/**
 * Explore Agent - 代码库探索Agent
 *
 * 用于宽范围代码库探索，支持：
 * - 搜索优先工作流：先用Grep和Glob缩小范围，再Read少量相关文件
 * - 架构问题解答："X是如何端到端连接的？"
 * - 多轮探索和结果聚合
 */

import { BaseSubagent } from '../base-subagent'
import type { SubagentConfig } from '../types'

/**
 * 探索结果项
 */
export interface ExploreResultItem {
  /** 文件路径 */
  path: string
  /** 行范围 */
  lines?: { start: number; end: number }
  /** 发现的摘要 */
  summary: string
  /** 相关性 */
  relevance: 'high' | 'medium' | 'low'
}

/**
 * 探索计划
 */
interface ExplorePlan {
  /** 搜索模式 */
  searchPatterns: string[]
  /** 文件模式 */
  filePatterns: string[]
  /** 需要详细读取的文件 */
  deepReadFiles: string[]
  /** 探索策略 */
  strategy: 'breadth-first' | 'depth-first' | 'targeted'
}

/**
 * Explore Agent实现
 */
export class ExploreAgent extends BaseSubagent {
  constructor(config?: Partial<SubagentConfig>) {
    super('Explore', config)
  }

  /**
   * 执行探索
   *
   * 策略：
   * 1. 分析探索目标，制定探索计划
   * 2. 广度优先：Grep/Glob快速扫描
   * 3. 选择性深度：Read关键文件
   * 4. 综合分析输出报告
   */
  protected async run(prompt: string): Promise<string> {
    this.reportProgress(`Planning exploration for: "${prompt}"`)

    // 1. 制定探索计划
    const plan = this.createExplorePlan(prompt)
    this.reportProgress(`Plan: ${plan.strategy} with ${plan.searchPatterns.length} patterns`)

    // 2. 广度扫描阶段
    this.reportProgress('Starting breadth-first scan...')
    const scanResults = await this.breadthScan(plan)

    // 3. 深度分析阶段
    this.reportProgress(`Deep reading ${plan.deepReadFiles.length} key files...`)
    const deepResults = await this.deepAnalysis(scanResults, plan)

    // 4. 综合分析
    this.reportProgress('Synthesizing exploration results...')
    return this.synthesizeReport(prompt, deepResults)
  }

  /**
   * 创建探索计划
   */
  private createExplorePlan(prompt: string): ExplorePlan {
    const lowerPrompt = prompt.toLowerCase()

    // 检测探索类型
    let strategy: ExplorePlan['strategy'] = 'breadth-first'
    if (lowerPrompt.includes('how') || lowerPrompt.includes('flow') || lowerPrompt.includes('architecture')) {
      strategy = 'depth-first'
    } else if (lowerPrompt.includes('where') || lowerPrompt.includes('find')) {
      strategy = 'targeted'
    }

    // 提取关键词
    const keywords = this.extractKeywords(prompt)

    // 生成搜索模式
    const searchPatterns = this.generateSearchPatterns(prompt, keywords)

    // 生成文件模式
    const filePatterns = this.generateFilePatterns(prompt, keywords)

    // 识别可能的入口文件
    const deepReadFiles: string[] = []

    return {
      searchPatterns,
      filePatterns,
      deepReadFiles,
      strategy,
    }
  }

  /**
   * 提取关键词
   */
  private extractKeywords(prompt: string): string[] {
    const stopWords = new Set([
      'how', 'what', 'where', 'when', 'why', 'is', 'are', 'the', 'a', 'an',
      'do', 'does', 'can', 'could', 'would', 'should', 'will', 'be', 'been',
      'have', 'has', 'had', 'this', 'that', 'these', 'those', 'in', 'on',
      'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'into', 'through',
      'give', 'me', 'show', 'find', 'search', 'explore', 'map', 'overview',
    ])

    return prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
  }

  /**
   * 生成搜索模式
   */
  private generateSearchPatterns(prompt: string, keywords: string[]): string[] {
    const patterns: string[] = []

    // 添加关键词搜索
    for (const keyword of keywords) {
      patterns.push(keyword)
    }

    // 添加特定结构搜索
    if (prompt.toLowerCase().includes('api') || prompt.toLowerCase().includes('endpoint')) {
      patterns.push('(router|app)\\.(get|post|put|delete|route)')
    }
    if (prompt.toLowerCase().includes('auth')) {
      patterns.push('(auth|login|session|token|password)')
    }
    if (prompt.toLowerCase().includes('database') || prompt.toLowerCase().includes('db')) {
      patterns.push('(database|db|schema|model|query)')
    }
    if (prompt.toLowerCase().includes('config')) {
      patterns.push('(config|settings|env|variable)')
    }

    return patterns
  }

  /**
   * 生成文件模式
   */
  private generateFilePatterns(prompt: string, _keywords: string[]): string[] {
    const patterns: string[] = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']

    // 根据提示添加特定模式
    if (prompt.toLowerCase().includes('api') || prompt.toLowerCase().includes('endpoint')) {
      patterns.push('**/api/**', '**/routes/**', '**/controllers/**')
    }
    if (prompt.toLowerCase().includes('component') || prompt.toLowerCase().includes('ui')) {
      patterns.push('**/components/**', '**/*.tsx')
    }
    if (prompt.toLowerCase().includes('service')) {
      patterns.push('**/services/**', '**/service/**')
    }
    if (prompt.toLowerCase().includes('util')) {
      patterns.push('**/utils/**', '**/lib/**')
    }

    return patterns
  }

  /**
   * 广度扫描
   */
  private async breadthScan(plan: ExplorePlan): Promise<ExploreResultItem[]> {
    const results: ExploreResultItem[] = []
    const seenPaths = new Set<string>()

    // 执行Grep搜索
    for (const pattern of plan.searchPatterns.slice(0, 5)) {
      try {
        const grepResult = await this.callTool<Array<{ path: string; line: number; content: string }>>('Grep', {
          pattern,
          output_mode: 'content',
          head_limit: 20,
        })

        if (Array.isArray(grepResult)) {
          for (const item of grepResult) {
            if (!seenPaths.has(item.path)) {
              seenPaths.add(item.path)
              results.push({
                path: item.path,
                lines: { start: item.line, end: item.line },
                summary: `Matched: "${pattern}"`,
                relevance: 'medium',
              })
            }
          }
        }
      } catch {
        // 忽略搜索错误
      }

      this.nextIteration()
      if (this.checkIterationLimit()) break
    }

    // 执行Glob搜索补充
    for (const pattern of plan.filePatterns.slice(0, 3)) {
      try {
        const globResult = await this.callTool<string[]>('Glob', { pattern })

        if (Array.isArray(globResult)) {
          for (const path of globResult.slice(0, 10)) {
            if (!seenPaths.has(path)) {
              seenPaths.add(path)
              results.push({
                path,
                summary: 'Matched file pattern',
                relevance: 'low',
              })
            }
          }
        }
      } catch {
        // 忽略
      }

      this.nextIteration()
      if (this.checkIterationLimit()) break
    }

    return results
  }

  /**
   * 深度分析
   */
  private async deepAnalysis(
    scanResults: ExploreResultItem[],
    _plan: ExplorePlan
  ): Promise<ExploreResultItem[]> {
    // 选择高相关性文件进行深度读取
    const highRelevancePaths = scanResults
      .filter((r) => r.relevance === 'high' || r.relevance === 'medium')
      .slice(0, 5)
      .map((r) => r.path)

    const deepResults: ExploreResultItem[] = [...scanResults]

    for (const path of highRelevancePaths) {
      try {
        const content = await this.callTool<string>('Read', {
          file_path: path,
          limit: 100,
        })

        if (typeof content === 'string') {
          // 分析文件结构
          const analysis = this.analyzeFileStructure(content)

          // 更新结果
          const existing = deepResults.find((r) => r.path === path)
          if (existing) {
            existing.summary = analysis.summary
            existing.relevance = 'high'
          }
        }
      } catch {
        // 忽略读取错误
      }

      this.nextIteration()
      if (this.checkIterationLimit()) break
    }

    return deepResults.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.relevance] - order[b.relevance]
    })
  }

  /**
   * 分析文件结构
   */
  private analyzeFileStructure(content: string): { summary: string; exports: string[]; imports: string[] } {
    // 提取导出
    const exportMatches = content.matchAll(/export\s+(?:async\s+)?(?:function|class|const|interface|type)\s+(\w+)/g)
    const exports = Array.from(exportMatches, (m) => m[1])

    // 提取导入
    const importMatches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)
    const imports = Array.from(importMatches, (m) => m[1])

    // 生成摘要
    let summary = 'File contents'
    if (exports.length > 0) {
      summary = `Exports: ${exports.slice(0, 5).join(', ')}${exports.length > 5 ? '...' : ''}`
    }

    return { summary, exports, imports }
  }

  /**
   * 综合报告
   */
  private synthesizeReport(prompt: string, results: ExploreResultItem[]): string {
    const lines: string[] = [
      `# Exploration Results`,
      '',
      `**Query**: ${prompt}`,
      `**Files Found**: ${results.length}`,
      '',
      '---',
      '',
    ]

    // 按相关性分组
    const highRelevance = results.filter((r) => r.relevance === 'high')
    const mediumRelevance = results.filter((r) => r.relevance === 'medium')
    const lowRelevance = results.filter((r) => r.relevance === 'low')

    if (highRelevance.length > 0) {
      lines.push('## High Relevance')
      for (const item of highRelevance.slice(0, 10)) {
        lines.push(`- [${item.path}](${item.path})${item.lines ? `:${item.lines.start}` : ''} - ${item.summary}`)
      }
      lines.push('')
    }

    if (mediumRelevance.length > 0) {
      lines.push('## Medium Relevance')
      for (const item of mediumRelevance.slice(0, 10)) {
        lines.push(`- [${item.path}](${item.path})${item.lines ? `:${item.lines.start}` : ''} - ${item.summary}`)
      }
      lines.push('')
    }

    if (lowRelevance.length > 0 && lines.length < 50) {
      lines.push('## Other Files')
      for (const item of lowRelevance.slice(0, 5)) {
        lines.push(`- ${item.path} - ${item.summary}`)
      }
    }

    return lines.join('\n')
  }
}

// 注册到全局注册表
import { registerSubagent } from '../subagent-registry'
registerSubagent('Explore', (config) => new ExploreAgent(config))
