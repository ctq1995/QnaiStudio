/**
 * ReviewFrontend Agent - 前端审查Agent
 *
 * 专注于前端特定问题：
 * - i18n key 同步
 * - React性能模式（memoization, virtualization）
 * - Effect/Reactivity依赖
 * - 可访问性
 * - 状态管理
 * - 前后端API契约对齐
 */

import { BaseReviewAgent } from './base-review'
import type { ReviewConfig } from './base-review'

/**
 * 前端审查Agent
 */
export class ReviewFrontendAgent extends BaseReviewAgent {
  constructor(config?: Partial<ReviewConfig>) {
    super('ReviewFrontend', config)
  }

  /**
   * 审查单个文件
   */
  protected async reviewFile(file: string): Promise<void> {
    // 只审查前端文件
    if (!this.isFrontendFile(file)) {
      return
    }

    const content = await this.readFileContent(file)
    if (!content) return

    // 执行各类检查
    await this.checkReactPatterns(file, content)
    await this.checkI18nPatterns(file, content)
    await this.checkAccessibility(file, content)
    await this.checkStateManagement(file, content)
    await this.checkEffectDependencies(file, content)
  }

  /**
   * 判断是否是前端文件
   */
  private isFrontendFile(file: string): boolean {
    const frontendPatterns = [
      '.tsx', '.jsx',
      'components/', 'pages/', 'views/',
      'hooks/', 'stores/', 'context/',
    ]
    return frontendPatterns.some((p) => file.includes(p))
  }

  /**
   * 检查React模式
   */
  private async checkReactPatterns(file: string, content: string): Promise<void> {
    // 检查缺少memoization的大型组件
    const componentMatch = content.match(/(?:function|const)\s+(\w+)\s*[=:]\s*(?:\(.*?\)\s*=>|function)/g)
    if (componentMatch) {
      for (const match of componentMatch) {
        const componentName = match.match(/\w+/g)?.[1]

        // 检查是否有React.memo或useMemo
        if (content.length > 500 && !content.includes('React.memo') && !content.includes('useMemo')) {
          this.addIssue({
            severity: 'medium',
            type: 'performance',
            file,
            message: `Component '${componentName}' might benefit from memoization for better performance`,
            suggestion: 'Consider using React.memo or useMemo for expensive computations',
          })
        }
      }
    }

    // 检查内联函数和对象
    const inlineHandlerMatch = content.match(/onClick=\{.*=>/g)
    if (inlineHandlerMatch && inlineHandlerMatch.length > 3) {
      this.addIssue({
        severity: 'low',
        type: 'performance',
        file,
        message: 'Multiple inline arrow functions in onClick handlers may cause unnecessary re-renders',
        suggestion: 'Consider using useCallback for event handlers',
      })
    }

    // 检查key prop
    const keyMatch = content.match(/key=\{index\}/g)
    if (keyMatch) {
      this.addIssue({
        severity: 'medium',
        type: 'anti-pattern',
        file,
        message: 'Using array index as key can cause issues with component state',
        suggestion: 'Use a unique identifier from your data as key instead of index',
      })
    }
  }

  /**
   * 检查i18n模式
   */
  private async checkI18nPatterns(file: string, content: string): Promise<void> {
    // 检查硬编码字符串
    const hardcodedMatch = content.match(/>[A-Z][a-zA-Z\s]+</g)
    if (hardcodedMatch) {
      const filtered = hardcodedMatch.filter((m) => m.length > 10 && !m.includes('{'))
      if (filtered.length > 0) {
        this.addIssue({
          severity: 'low',
          type: 'i18n',
          file,
          message: `Found ${filtered.length} potential hardcoded text strings that may need i18n`,
          suggestion: 'Wrap text in i18n translation function for internationalization support',
        })
      }
    }

    // 检查i18n key使用
    const i18nKeys = content.match(/t\(['"]([\w.]+)['"]\)/g)
    if (i18nKeys) {
      // 可以进一步检查key是否在翻译文件中存在
      this.reportProgress(`Found ${i18nKeys.length} i18n keys in ${file}`)
    }
  }

  /**
   * 检查可访问性
   */
  private async checkAccessibility(file: string, content: string): Promise<void> {
    // 检查缺少alt的图片
    const imgMatch = content.match(/<img[^>]*>/g)
    if (imgMatch) {
      for (const img of imgMatch) {
        if (!img.includes('alt=')) {
          this.addIssue({
            severity: 'high',
            type: 'accessibility',
            file,
            message: 'Image element missing alt attribute',
            suggestion: 'Add descriptive alt text for screen readers',
          })
        }
      }
    }

    // 检查缺少aria-label的交互元素
    const buttonMatch = content.match(/<button[^>]*>/g)
    if (buttonMatch) {
      for (const btn of buttonMatch) {
        if (!btn.includes('aria-label') && !btn.match(/>.+\s*</)) {
          this.addIssue({
            severity: 'medium',
            type: 'accessibility',
            file,
            message: 'Button without visible text may need aria-label',
            suggestion: 'Add aria-label attribute for screen readers',
          })
        }
      }
    }

    // 检查表单元素缺少label关联
    const inputMatch = content.match(/<input[^>]*>/g)
    if (inputMatch) {
      for (const input of inputMatch) {
        if (!input.includes('id=') && !input.includes('aria-label')) {
          this.addIssue({
            severity: 'medium',
            type: 'accessibility',
            file,
            message: 'Input element without associated label',
            suggestion: 'Add id attribute and associated label, or use aria-label',
          })
        }
      }
    }
  }

  /**
   * 检查状态管理
   */
  private async checkStateManagement(file: string, content: string): Promise<void> {
    // 检查过深的state嵌套
    const nestedStateMatch = content.match(/useState.*\{.*\{.*\{/)
    if (nestedStateMatch) {
      this.addIssue({
        severity: 'medium',
        type: 'state-management',
        file,
        message: 'Deeply nested state can lead to update issues',
        suggestion: 'Consider flattening state structure or using useReducer',
      })
    }

    // 检查prop drilling
    const propsMatch = content.match(/\.\.\.props/g)
    if (propsMatch && propsMatch.length > 2) {
      this.addIssue({
        severity: 'low',
        type: 'state-management',
        file,
        message: 'Prop drilling detected - spreading props through multiple levels',
        suggestion: 'Consider using Context API or state management library',
      })
    }
  }

  /**
   * 检查Effect依赖
   */
  private async checkEffectDependencies(file: string, content: string): Promise<void> {
    // 检查空依赖数组的effect
    const emptyDepsMatch = content.match(/useEffect\([^)]+\)\s*,\s*\[\s*\]/g)
    if (emptyDepsMatch) {
      // 检查effect内部使用了哪些变量
      for (const match of emptyDepsMatch) {
        const effectContent = match.slice(0, match.lastIndexOf(')') + 1)
        // 简化检查：如果effect内有函数调用，可能缺少依赖
        if (effectContent.match(/\w+\(/g)?.length && effectContent.match(/\w+\(/g)!.length > 2) {
          this.addIssue({
            severity: 'medium',
            type: 'react-hooks',
            file,
            message: 'useEffect with empty dependency array may be missing dependencies',
            suggestion: 'Review effect dependencies to ensure all used values are included',
          })
        }
      }
    }

    // 检查缺少清理的effect
    const effectWithoutCleanup = content.match(/useEffect\(\s*\(\)\s*=>\s*\{[^}]+\}/g)
    if (effectWithoutCleanup) {
      for (const effect of effectWithoutCleanup) {
        if (effect.includes('addEventListener') || effect.includes('setInterval') || effect.includes('setTimeout')) {
          if (!effect.includes('removeEventListener') && !effect.includes('clearInterval') && !effect.includes('clearTimeout')) {
            this.addIssue({
              severity: 'high',
              type: 'memory-leak',
              file,
              message: 'Effect with event listener/timer may cause memory leak without cleanup',
              suggestion: 'Add cleanup function in useEffect return',
            })
          }
        }
      }
    }
  }

  /**
   * 格式化输出
   */
  protected formatReport(report: ReturnType<typeof this.generateReport>): string {
    const lines = [
      '# Frontend Review Report',
      '',
      `**Files Reviewed**: ${this.targets.length}`,
      '',
      super.formatReport(report),
    ]
    return lines.join('\n')
  }
}

// 注册
import { registerSubagent } from '../../subagent-registry'
registerSubagent('ReviewFrontend', (config) => new ReviewFrontendAgent(config as Partial<ReviewConfig>))
