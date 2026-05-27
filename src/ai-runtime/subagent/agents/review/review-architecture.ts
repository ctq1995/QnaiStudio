/**
 * ReviewArchitecture Agent - 架构审查Agent
 *
 * 专注于架构问题：
 * - 模块边界违规
 * - API契约设计
 * - 抽象完整性
 * - 依赖方向
 * - 跨切面关注点影响
 */

import { BaseReviewAgent } from './base-review'
import type { ReviewConfig } from './base-review'

/**
 * 架构审查Agent
 */
export class ReviewArchitectureAgent extends BaseReviewAgent {
  constructor(config?: Partial<ReviewConfig>) {
    super('ReviewArchitecture', config)
  }

  /**
   * 审查单个文件
   */
  protected async reviewFile(file: string): Promise<void> {
    const content = await this.readFileContent(file)
    if (!content) return

    // 执行架构检查
    this.checkModuleBoundaries(file, content)
    this.checkDependencyDirection(file, content)
    this.checkAbstractionIntegrity(file, content)
    this.checkAPIContracts(file, content)
    this.checkCircularDependencies(file, content)
    this.checkLayerViolation(file, content)
  }

  /**
   * 检查模块边界
   */
  private checkModuleBoundaries(file: string, content: string): void {
    // 检查跨层导入
    const imports = this.extractImports(content)

    // 检查组件直接导入服务层
    if (this.isInLayer(file, 'components')) {
      for (const imp of imports) {
        if (imp.includes('/services/') || imp.includes('/repositories/')) {
          this.addIssue({
            severity: 'medium',
            type: 'layer-violation',
            file,
            message: `Component directly imports from service layer: ${imp}`,
            suggestion: 'Introduce a facade or use custom hooks to abstract service access',
          })
        }
      }
    }

    // 检查服务层直接导入组件
    if (this.isInLayer(file, 'services')) {
      for (const imp of imports) {
        if (imp.includes('/components/') || imp.includes('.tsx')) {
          this.addIssue({
            severity: 'high',
            type: 'layer-violation',
            file,
            message: `Service layer imports UI components: ${imp}`,
            suggestion: 'Services should not depend on UI components',
          })
        }
      }
    }

    // 检查工具层导入业务逻辑
    if (this.isInLayer(file, 'utils') || this.isInLayer(file, 'lib')) {
      for (const imp of imports) {
        if (imp.includes('/services/') || imp.includes('/models/')) {
          this.addIssue({
            severity: 'medium',
            type: 'layer-violation',
            file,
            message: `Utility module imports business logic: ${imp}`,
            suggestion: 'Utility modules should remain independent of business logic',
          })
        }
      }
    }
  }

  /**
   * 检查依赖方向
   */
  private checkDependencyDirection(file: string, content: string): void {
    const imports = this.extractImports(content)

    // 检查相对路径导入（可能表示架构问题）
    const relativeImports = imports.filter((imp) => imp.startsWith('../') && imp.split('../').length > 3)
    for (const imp of relativeImports) {
      this.addIssue({
        severity: 'low',
        type: 'dependency-direction',
        file,
        message: `Deep relative import may indicate poor module organization: ${imp}`,
        suggestion: 'Consider using absolute imports or reorganizing module structure',
      })
    }

    // 检查从node_modules直接导入内部路径
    const internalPackageImports = imports.filter((imp) => imp.includes('/dist/') || imp.includes('/lib/'))
    for (const imp of internalPackageImports) {
      this.addIssue({
        severity: 'medium',
        type: 'internal-import',
        file,
        message: `Importing from internal package path: ${imp}`,
        suggestion: 'Use the public API exports instead of internal paths',
      })
    }
  }

  /**
   * 检查抽象完整性
   */
  private checkAbstractionIntegrity(file: string, content: string): void {
    // 检查过大的文件
    const lines = content.split('\n').length
    if (lines > 500) {
      this.addIssue({
        severity: 'medium',
        type: 'abstraction-integrity',
        file,
        message: `File has ${lines} lines, consider splitting into smaller modules`,
        suggestion: 'Extract related functionality into separate modules following Single Responsibility Principle',
      })
    }

    // 检查过多的导出
    const exports = content.match(/^export\s+/gm) || []
    if (exports.length > 20) {
      this.addIssue({
        severity: 'low',
        type: 'abstraction-integrity',
        file,
        message: `File exports ${exports.length} items, may indicate lack of cohesion`,
        suggestion: 'Consider splitting into more focused modules',
      })
    }

    // 检查过深的嵌套
    const maxNesting = this.getMaxNesting(content)
    if (maxNesting > 4) {
      this.addIssue({
        severity: 'medium',
        type: 'code-complexity',
        file,
        message: `Maximum nesting depth of ${maxNesting} detected`,
        suggestion: 'Extract nested logic into separate functions to improve readability',
      })
    }

    // 检查过多参数
    const paramMatch = content.match(/function\s+\w+\s*\([^)]{100,}\)/g)
    if (paramMatch) {
      for (const match of paramMatch) {
        const params = match.slice(match.indexOf('(') + 1, match.lastIndexOf(')')).split(',').length
        if (params > 5) {
          this.addIssue({
            severity: 'low',
            type: 'abstraction-integrity',
            file,
            message: `Function has ${params} parameters, consider using options object`,
            suggestion: 'Group related parameters into an options object',
          })
        }
      }
    }
  }

  /**
   * 检查API契约
   */
  private checkAPIContracts(file: string, content: string): void {
    // 检查API端点定义
    if (file.includes('api') || file.includes('routes') || file.includes('controller')) {
      // 检查缺少类型定义的端点
      if (!content.includes('interface') && !content.includes('type ') && !content.includes('zod') && !content.includes('joi')) {
        this.addIssue({
          severity: 'medium',
          type: 'api-contract',
          file,
          message: 'API endpoint lacks request/response type definitions',
          suggestion: 'Add type definitions or validation schemas for API contracts',
        })
      }

      // 检查缺少错误处理
      if (content.includes('async') && !content.includes('try') && !content.includes('catch')) {
        this.addIssue({
          severity: 'medium',
          type: 'api-contract',
          file,
          message: 'Async function lacks error handling',
          suggestion: 'Add try-catch blocks or use Result pattern for error handling',
        })
      }
    }

    // 检查any类型滥用
    const anyCount = (content.match(/:\s*any\b/g) || []).length
    if (anyCount > 3) {
      this.addIssue({
        severity: 'medium',
        type: 'type-safety',
        file,
        message: `Found ${anyCount} uses of 'any' type, reducing type safety`,
        suggestion: 'Replace any with specific types or unknown with type guards',
      })
    }
  }

  /**
   * 检查循环依赖
   */
  private checkCircularDependencies(file: string, content: string): void {
    const imports = this.extractImports(content)

    // 检查自导入
    const fileName = file.split('/').pop()?.replace(/\.(ts|tsx)$/, '')
    for (const imp of imports) {
      if (imp.includes(`/${fileName}`) && !imp.includes(`/${fileName}/`)) {
        this.addIssue({
          severity: 'high',
          type: 'circular-dependency',
          file,
          message: 'Potential self-import detected',
          suggestion: 'Refactor to avoid circular dependency',
        })
      }
    }

    // 检查重导出可能导致的循环
    if (content.includes('export * from') && content.includes('export {') && imports.length > 20) {
      this.addIssue({
        severity: 'low',
        type: 'circular-dependency-risk',
        file,
        message: 'Mixed re-exports in large file may lead to circular dependencies',
        suggestion: 'Consider separating re-exports into barrel files',
      })
    }
  }

  /**
   * 检查层级违规
   */
  private checkLayerViolation(file: string, content: string): void {
    // 确定文件所在层级
    const layer = this.determineLayer(file)
    if (!layer) return

    // 检查是否有不适当的依赖
    const imports = this.extractImports(content)

    // 数据库层不应该知道API层
    if (layer === 'data') {
      if (imports.some((imp) => imp.includes('api') || imp.includes('controller') || imp.includes('route'))) {
        this.addIssue({
          severity: 'high',
          type: 'layer-violation',
          file,
          message: 'Data layer imports from higher layers',
          suggestion: 'Data layer should only be imported by domain/service layer',
        })
      }
    }

    // 基础设施层不应该知道应用层
    if (layer === 'infrastructure') {
      if (imports.some((imp) => imp.includes('usecase') || imp.includes('application'))) {
        this.addIssue({
          severity: 'high',
          type: 'layer-violation',
          file,
          message: 'Infrastructure layer imports from application layer',
          suggestion: 'Use dependency inversion with interfaces',
        })
      }
    }
  }

  /**
   * 提取导入语句
   */
  private extractImports(content: string): string[] {
    const importMatches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)
    return Array.from(importMatches, (m) => m[1])
  }

  /**
   * 判断文件是否在特定层
   */
  private isInLayer(file: string, layer: string): boolean {
    const layerPatterns: Record<string, RegExp[]> = {
      components: [/components?\//i, /pages?\//i, /views?\//i],
      services: [/services?\//i, /usecases?\//i, /application\//i],
      data: [/data\//i, /repositories?\//i, /models?\//i, /entities?\//i],
      utils: [/utils?\//i, /lib\//i, /helpers?\//i, /common\//i],
      infrastructure: [/infrastructure\//i, /config\//i, /di\//i],
    }

    const patterns = layerPatterns[layer] || []
    return patterns.some((p) => p.test(file))
  }

  /**
   * 确定文件层级
   */
  private determineLayer(file: string): string | null {
    const layers = ['components', 'services', 'data', 'utils', 'infrastructure']
    for (const layer of layers) {
      if (this.isInLayer(file, layer)) {
        return layer
      }
    }
    return null
  }

  /**
   * 获取最大嵌套深度
   */
  private getMaxNesting(content: string): number {
    let maxDepth = 0
    let currentDepth = 0

    for (const char of content) {
      if (char === '{') {
        currentDepth++
        maxDepth = Math.max(maxDepth, currentDepth)
      } else if (char === '}') {
        currentDepth--
      }
    }

    return maxDepth
  }
}

// 注册
import { registerSubagent } from '../../subagent-registry'
registerSubagent('ReviewArchitecture', (config) => new ReviewArchitectureAgent(config as Partial<ReviewConfig>))
