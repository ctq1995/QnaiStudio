/**
 * FileFinder Agent - 文件查找Agent
 *
 * 专用于语义化文件搜索和定位。
 * 输出：文件路径、行范围（可选）、简短描述。
 */

import { BaseSubagent } from '../base-subagent'
import type { SubagentConfig } from '../types'

/**
 * 文件查找结果
 */
export interface FileFinderResult {
  /** 文件路径 */
  path: string
  /** 行范围（可选） */
  lineRange?: {
    start: number
    end: number
  }
  /** 简短描述 */
  description: string
  /** 相关性分数（0-1） */
  relevance?: number
}

/**
 * FileFinder Agent实现
 */
export class FileFinderAgent extends BaseSubagent {
  constructor(config?: Partial<SubagentConfig>) {
    super('FileFinder', config)
  }

  /**
   * 执行文件查找
   *
   * 策略：
   * 1. 分析用户提示，提取关键词和语义
   * 2. 使用Glob进行模式匹配
   * 3. 使用Grep进行内容搜索
   * 4. 综合结果并排序
   */
  protected async run(prompt: string): Promise<string> {
    this.reportProgress(`Analyzing search query: "${prompt}"`)

    // 1. 提取搜索关键词
    const keywords = this.extractKeywords(prompt)
    this.reportProgress(`Extracted keywords: ${keywords.join(', ')}`)

    // 2. 使用Glob进行文件名匹配
    const globPatterns = this.inferGlobPatterns(keywords)
    const globResults: string[] = []

    for (const pattern of globPatterns) {
      try {
        const result = await this.callTool<string[]>('Glob', { pattern })
        if (Array.isArray(result)) {
          globResults.push(...result)
        }
      } catch {
        // 忽略glob错误，继续其他模式
      }
    }

    this.reportProgress(`Glob found ${globResults.length} files`)

    // 3. 使用Grep进行内容搜索
    const grepPatterns = this.inferGrepPatterns(keywords)
    const grepResults: Array<{ path: string; line?: number; match?: string }> = []

    for (const pattern of grepPatterns) {
      try {
        const result = await this.callTool<{ path: string; line?: number }[]>('Grep', {
          pattern,
          output_mode: 'files_with_matches',
        })
        if (Array.isArray(result)) {
          grepResults.push(...result)
        }
      } catch {
        // 忽略grep错误
      }
    }

    this.reportProgress(`Grep found ${grepResults.length} matches`)

    // 4. 合并和排序结果
    const combinedResults = this.combineResults(globResults, grepResults, keywords)

    // 5. 读取前几个文件获取更多上下文
    const enrichedResults = await this.enrichResults(combinedResults.slice(0, 10))

    // 6. 格式化输出
    return this.formatOutput(enrichedResults)
  }

  /**
   * 从提示中提取关键词
   */
  private extractKeywords(prompt: string): string[] {
    // 移除常见停用词
    const stopWords = new Set(['find', 'search', 'locate', 'files', 'that', 'implement', 'define', 'the', 'a', 'an', 'is', 'are', 'for', 'to', 'of', 'in', 'on', 'with'])

    // 分词并过滤
    const words = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))

    return [...new Set(words)]
  }

  /**
   * 推断Glob模式
   */
  private inferGlobPatterns(keywords: string[]): string[] {
    const patterns: string[] = []

    for (const keyword of keywords) {
      // 常见文件名模式
      patterns.push(`**/*${keyword}*`)
      patterns.push(`**/${keyword}*`)
      patterns.push(`**/*${keyword}.*`)

      // 特定扩展名
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go']
      for (const ext of extensions) {
        patterns.push(`**/*${keyword}${ext}`)
      }
    }

    return patterns
  }

  /**
   * 推断Grep模式
   */
  private inferGrepPatterns(keywords: string[]): string[] {
    // 返回关键词作为正则模式
    return keywords.map((k) => {
      // 转换为正则，匹配函数定义、类定义等
      return `(function|class|interface|const|export)\\s+\\w*${k}\\w*`
    })
  }

  /**
   * 合并结果
   */
  private combineResults(
    globResults: string[],
    grepResults: Array<{ path: string; line?: number }>,
    _keywords: string[]
  ): FileFinderResult[] {
    const results = new Map<string, FileFinderResult>()

    // 添加glob结果
    for (const path of globResults) {
      const existing = results.get(path)
      if (!existing) {
        results.set(path, {
          path,
          description: 'Matched by filename pattern',
          relevance: 0.5,
        })
      }
    }

    // 添加grep结果（优先级更高）
    for (const { path, line } of grepResults) {
      const existing = results.get(path)
      if (existing) {
        existing.lineRange = line ? { start: line, end: line } : undefined
        existing.relevance = Math.min(1, (existing.relevance ?? 0.5) + 0.3)
        existing.description = 'Matched by content and filename'
      } else {
        results.set(path, {
          path,
          lineRange: line ? { start: line, end: line } : undefined,
          description: 'Matched by content search',
          relevance: 0.7,
        })
      }
    }

    // 按相关性排序
    return Array.from(results.values()).sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
  }

  /**
   * 丰富结果（读取文件获取更多上下文）
   */
  private async enrichResults(results: FileFinderResult[]): Promise<FileFinderResult[]> {
    const enriched: FileFinderResult[] = []

    for (const result of results) {
      try {
        // 读取文件前几行获取概要
        const content = await this.callTool<string>('Read', {
          file_path: result.path,
          limit: 20,
        })

        if (typeof content === 'string') {
          // 尝试提取文件描述（从注释）
          const descMatch = content.match(/\/\*\*?\s*\n?\s*\*?\s*(.+)/)
          if (descMatch) {
            result.description = descMatch[1].trim()
          }
        }

        enriched.push(result)
      } catch {
        // 读取失败，保留原始结果
        enriched.push(result)
      }

      this.nextIteration()
      if (this.checkIterationLimit()) break
    }

    return enriched
  }

  /**
   * 格式化输出
   */
  private formatOutput(results: FileFinderResult[]): string {
    if (results.length === 0) {
      return 'No files found matching the search criteria.'
    }

    const lines: string[] = ['Found files:', '']

    for (const result of results) {
      let line = `- ${result.path}`
      if (result.lineRange) {
        line += `:${result.lineRange.start}`
      }
      line += ` - ${result.description}`
      lines.push(line)
    }

    lines.push('')
    lines.push(`Total: ${results.length} file(s) found`)

    return lines.join('\n')
  }
}

// 注册到全局注册表
import { registerSubagent } from '../subagent-registry'
registerSubagent('FileFinder', (config) => new FileFinderAgent(config))
