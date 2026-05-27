/**
 * ReviewPerformance Agent - 性能审查Agent
 *
 * 专注于性能问题：
 * - 延迟和热路径效率
 * - 不必要的内存分配
 * - N+1查询模式
 * - 阻塞调用
 * - 过度获取数据
 * - 规模敏感的退化
 */

import { BaseReviewAgent } from './base-review'
import type { ReviewConfig } from './base-review'

/**
 * 性能审查Agent
 */
export class ReviewPerformanceAgent extends BaseReviewAgent {
  constructor(config?: Partial<ReviewConfig>) {
    super('ReviewPerformance', config)
  }

  /**
   * 审查单个文件
   */
  protected async reviewFile(file: string): Promise<void> {
    const content = await this.readFileContent(file)
    if (!content) return

    // 执行性能检查
    this.checkNPlusOnePatterns(file, content)
    this.checkBlockingCalls(file, content)
    this.checkMemoryAllocation(file, content)
    this.checkLoopEfficiency(file, content)
    this.checkAsyncPatterns(file, content)
    this.checkCaching(file, content)
    this.checkBundleSize(file, content)
  }

  /**
   * 检查N+1查询模式
   */
  private checkNPlusOnePatterns(file: string, content: string): void {
    // 检查循环中的数据库查询
    const loopPatterns = [
      /for\s*\(.*?\)\s*\{[\s\S]*?(?:query|find|get|fetch|select)[\s\S]*?\}/gi,
      /\.map\(.*?=>[\s\S]*?(?:query|find|get|fetch|select)[\s\S]*?\)/gi,
      /while\s*\(.*?\)\s*\{[\s\S]*?(?:query|find|get|fetch|select)[\s\S]*?\}/gi,
    ]

    for (const pattern of loopPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        for (const match of matches) {
          if (match.includes('await') || match.includes('async')) {
            this.addIssue({
              severity: 'high',
              type: 'n+1-query',
              file,
              message: 'Potential N+1 query pattern detected in loop',
              suggestion: 'Use batch loading, DataLoader, or join queries to avoid N+1',
            })
            break // 每个文件只报告一次
          }
        }
      }
    }

    // 检查await in loop
    const awaitInLoop = content.match(/for\s*\([^)]*\)\s*\{[^}]*await[^}]*\}/g)
    if (awaitInLoop) {
      this.addIssue({
        severity: 'medium',
        type: 'await-in-loop',
        file,
        message: 'Await inside loop may cause sequential execution instead of parallel',
        suggestion: 'Use Promise.all() for parallel execution, or batch operations',
      })
    }
  }

  /**
   * 检查阻塞调用
   */
  private checkBlockingCalls(file: string, content: string): void {
    // 检查同步I/O操作
    const syncPatterns = [
      { pattern: /readFileSync/g, name: 'readFileSync' },
      { pattern: /writeFileSync/g, name: 'writeFileSync' },
      { pattern: /existsSync/g, name: 'existsSync' },
      { pattern: /statSync/g, name: 'statSync' },
      { pattern: /readdirSync/g, name: 'readdirSync' },
    ]

    for (const { pattern, name } of syncPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        // 检查是否在热路径中（不在初始化代码）
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(pattern)) {
            // 检查是否在函数内（热路径）
            const beforeContent = lines.slice(0, i).join('\n')
            const functionCount = (beforeContent.match(/function|=>/g) || []).length
            if (functionCount > 0) {
              this.addIssue({
                severity: 'medium',
                type: 'blocking-io',
                file,
                line: i + 1,
                message: `Synchronous I/O operation '${name}' in hot path may block event loop`,
                suggestion: 'Use asynchronous equivalents (e.g., readFile instead of readFileSync)',
              })
            }
          }
        }
      }
    }

    // 检查大量的CPU密集操作
    if (content.includes('crypto.createHash') && content.includes('.update(') && !content.includes('async')) {
      this.addIssue({
        severity: 'low',
        type: 'cpu-intensive',
        file,
        message: 'CPU-intensive crypto operation may block event loop',
        suggestion: 'Consider using worker threads or async crypto operations',
      })
    }
  }

  /**
   * 检查内存分配
   */
  private checkMemoryAllocation(file: string, content: string): void {
    // 检查循环内的大对象创建
    const objectInLoop = content.match(/for\s*\([^)]*\)\s*\{[^}]*(?:\{[^}]*\}|\[[^\]]*\])[^}]*\}/g)
    if (objectInLoop) {
      for (const match of objectInLoop) {
        const objectCount = (match.match(/\{|\[/g) || []).length
        if (objectCount > 3) {
          this.addIssue({
            severity: 'medium',
            type: 'memory-allocation',
            file,
            message: 'Large object allocation in loop may cause GC pressure',
            suggestion: 'Move object creation outside loop or use object pooling',
          })
          break
        }
      }
    }

    // 检查字符串拼接在循环中
    const stringConcatInLoop = content.match(/(?:for|while)\s*[^{]+\{[^}]*\w+\s*\+=\s*[^}]+\}/g)
    if (stringConcatInLoop) {
      this.addIssue({
        severity: 'low',
        type: 'string-concatenation',
        file,
        message: 'String concatenation in loop may be inefficient',
        suggestion: 'Use array.join() or template literals for better performance',
      })
    }

    // 检查未清理的事件监听器
    const addEventListener = content.match(/addEventListener|on\(['"]\w+['"]/g)
    const removeEventListener = content.match(/removeEventListener|off\(['"]\w+['"]/g)
    if (addEventListener && (!removeEventListener || addEventListener.length > removeEventListener.length)) {
      this.addIssue({
        severity: 'medium',
        type: 'memory-leak',
        file,
        message: 'Event listeners added without corresponding removal may cause memory leaks',
        suggestion: 'Ensure event listeners are removed when no longer needed',
      })
    }
  }

  /**
   * 检查循环效率
   */
  private checkLoopEfficiency(file: string, content: string): void {
    // 检查循环中的length属性访问
    const lengthInLoop = content.match(/for\s*\(\s*(?:let|var)\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*\w+\.length/g)
    if (lengthInLoop) {
      this.addIssue({
        severity: 'low',
        type: 'loop-optimization',
        file,
        message: 'Array.length accessed in loop condition may be inefficient for large arrays',
        suggestion: 'Cache array.length in a variable outside the loop',
      })
    }

    // 检查嵌套循环
    const nestedLoops = content.match(/for\s*[^{]+\{[^}]*for\s*[^{]+\{/g)
    if (nestedLoops) {
      this.addIssue({
        severity: 'medium',
        type: 'nested-loop',
        file,
        message: `Found ${nestedLoops.length} nested loops, potential O(n²) complexity`,
        suggestion: 'Consider using Map/Set for O(1) lookups or refactoring algorithm',
      })
    }

    // 检查find在循环中
    const findInLoop = content.match(/(?:for|while|map)\s*.*\.find\(/g)
    if (findInLoop) {
      this.addIssue({
        severity: 'medium',
        type: 'inefficient-search',
        file,
        message: 'Using .find() inside loop creates O(n²) complexity',
        suggestion: 'Convert array to Map/Set for O(1) lookups',
      })
    }
  }

  /**
   * 检查异步模式
   */
  private checkAsyncPatterns(file: string, content: string): void {
    // 检查Promise.all可以优化的地方
    const sequentialAwait = content.match(/await\s+\w+[^;]+;\s*await\s+\w+/g)
    if (sequentialAwait) {
      const isIndependent = true // 简化假设
      if (isIndependent) {
        this.addIssue({
          severity: 'medium',
          type: 'sequential-async',
          file,
          message: 'Sequential await calls could potentially run in parallel',
          suggestion: 'Use Promise.all() for independent async operations',
        })
      }
    }

    // 检查未处理Promise rejection
    const unhandledPromise = content.match(/(?:async\s+)?\w+\s*\([^)]*\)\s*\{[^}]*\breturn\b[^}]*\}/g)
    if (unhandledPromise && !content.includes('.catch(') && !content.includes('try')) {
      this.addIssue({
        severity: 'low',
        type: 'unhandled-promise',
        file,
        message: 'Async function may have unhandled promise rejections',
        suggestion: 'Add .catch() handler or try-catch for proper error handling',
      })
    }
  }

  /**
   * 检查缓存
   */
  private checkCaching(file: string, content: string): void {
    // 检查是否缺少缓存的数据获取
    if (content.includes('fetch(') || content.includes('axios') || content.includes('query')) {
      if (!content.includes('cache') && !content.includes('memo') && !content.includes('swr') && !content.includes('react-query')) {
        this.addIssue({
          severity: 'low',
          type: 'missing-cache',
          file,
          message: 'Data fetching without caching may cause redundant requests',
          suggestion: 'Consider using caching strategies (SWR, React Query, or memoization)',
        })
      }
    }

    // 检查无效的缓存键
    if (content.includes('useMemo') || content.includes('useCallback')) {
      const emptyDeps = content.match(/use(?:Memo|Callback)\([^)]+\)\s*,\s*\[\s*\]/g)
      if (emptyDeps) {
        this.addIssue({
          severity: 'medium',
          type: 'invalid-cache',
          file,
          message: 'useMemo/useCallback with empty dependency array never updates',
          suggestion: 'Include all dependencies in the dependency array',
        })
      }
    }
  }

  /**
   * 检查打包大小
   */
  private checkBundleSize(file: string, content: string): void {
    // 检查大型库导入
    const largeLibraries = ['lodash', 'moment', 'jquery', 'rxjs', '@mui/material']
    for (const lib of largeLibraries) {
      if (content.includes(`from '${lib}'`) || content.includes(`from "${lib}"`)) {
        // 检查是否是全量导入
        if (content.includes(`import _`) || content.includes(`import * as`)) {
          this.addIssue({
            severity: 'medium',
            type: 'bundle-size',
            file,
            message: `Full import of '${lib}' increases bundle size significantly`,
            suggestion: `Use tree-shaking with named imports: import { x } from '${lib}/x'`,
          })
        }
      }
    }

    // 检查动态导入
    if (content.includes('import(') && file.endsWith('.tsx')) {
      this.addIssue({
        severity: 'info',
        type: 'code-splitting',
        file,
        message: 'Dynamic import detected - good for code splitting',
      })
    }
  }
}

// 注册
import { registerSubagent } from '../../subagent-registry'
registerSubagent('ReviewPerformance', (config) => new ReviewPerformanceAgent(config as Partial<ReviewConfig>))
