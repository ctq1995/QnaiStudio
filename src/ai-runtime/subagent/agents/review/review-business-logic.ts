/**
 * ReviewBusinessLogic Agent - 业务逻辑审查Agent
 *
 * 专注于业务问题：
 * - 工作流正确性
 * - 业务规则验证
 * - 状态转换
 * - 数据完整性
 * - 边界情况处理
 */

import { BaseReviewAgent } from './base-review'
import type { ReviewConfig } from './base-review'

/**
 * 业务逻辑审查Agent
 */
export class ReviewBusinessLogicAgent extends BaseReviewAgent {
  constructor(config?: Partial<ReviewConfig>) {
    super('ReviewBusinessLogic', config)
  }

  /**
   * 审查单个文件
   */
  protected async reviewFile(file: string): Promise<void> {
    const content = await this.readFileContent(file)
    if (!content) return

    // 执行业务逻辑检查
    this.checkStateTransitions(file, content)
    this.checkBusinessRules(file, content)
    this.checkDataIntegrity(file, content)
    this.checkEdgeCases(file, content)
    this.checkErrorHandling(file, content)
    this.checkValidation(file, content)
  }

  /**
   * 检查状态转换
   */
  private checkStateTransitions(file: string, content: string): void {
    // 检查状态变量
    const statePatterns = [
      /status\s*[=:]\s*['"](\w+)['"]/g,
      /state\s*[=:]\s*['"](\w+)['"]/g,
      /\.status\s*=/g,
    ]

    for (const pattern of statePatterns) {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        // 检查是否有对应的状态转换验证
        const stateValue = match[1]
        if (stateValue && !content.includes('switch') && !content.includes('if') && !content.includes('validState')) {
          this.addIssue({
            severity: 'medium',
            type: 'state-transition',
            file,
            message: `State value '${stateValue}' may lack transition validation`,
            suggestion: 'Add state machine pattern or validate state transitions',
          })
        }
      }
    }

    // 检查有限状态机模式
    if (content.includes('status') || content.includes('state')) {
      // 检查是否有无效状态的处理
      if (!content.includes('default:') && !content.includes('else') && content.includes('switch')) {
        this.addIssue({
          severity: 'low',
          type: 'state-transition',
          file,
          message: 'Switch statement without default case may miss invalid states',
          suggestion: 'Add default case to handle unexpected state values',
        })
      }
    }
  }

  /**
   * 检查业务规则
   */
  private checkBusinessRules(file: string, content: string): void {
    // 检查金额计算
    if (content.includes('price') || content.includes('amount') || content.includes('total') || content.includes('sum')) {
      // 检查浮点数运算
      if (content.includes('+') && !content.includes('toFixed') && !content.includes('BigInt') && !content.includes('Decimal')) {
        this.addIssue({
          severity: 'high',
          type: 'business-rule',
          file,
          message: 'Monetary calculation with floating-point may cause precision issues',
          suggestion: 'Use integer arithmetic (cents) or Decimal library for monetary calculations',
        })
      }

      // 检查是否缺少边界检查
      if (!content.includes('Math.max') && !content.includes('Math.min') && !content.includes('> 0') && !content.includes('< 0')) {
        this.addIssue({
          severity: 'medium',
          type: 'business-rule',
          file,
          message: 'Monetary calculations may lack boundary checks',
          suggestion: 'Add validation for negative values and overflow',
        })
      }
    }

    // 检查日期处理
    if (content.includes('Date') && !content.includes('moment') && !content.includes('date-fns')) {
      if (content.includes('new Date') && !content.includes('timezone') && !content.includes('UTC')) {
        this.addIssue({
          severity: 'low',
          type: 'date-handling',
          file,
          message: 'Date handling without timezone consideration may cause issues',
          suggestion: 'Consider using date libraries with timezone support',
        })
      }
    }

    // 检查权限检查
    if (content.includes('user') || content.includes('role') || content.includes('permission')) {
      const hasAuthCheck = content.includes('auth') || content.includes('can') || content.includes('allowed') || content.includes('permission')
      const hasSensitiveOp = content.includes('delete') || content.includes('update') || content.includes('create') || content.includes('admin')

      if (hasSensitiveOp && !hasAuthCheck) {
        this.addIssue({
          severity: 'high',
          type: 'authorization',
          file,
          message: 'Sensitive operation may lack authorization check',
          suggestion: 'Add authorization checks before performing sensitive operations',
        })
      }
    }
  }

  /**
   * 检查数据完整性
   */
  private checkDataIntegrity(file: string, content: string): void {
    // 检查事务处理
    if (content.includes('create') || content.includes('update') || content.includes('delete')) {
      const hasTransaction = content.includes('transaction') || content.includes('beginTransaction')
      const hasMultipleOps = (content.match(/await/g) || []).length > 1

      if (hasMultipleOps && !hasTransaction && (content.includes('prisma') || content.includes('sequelize') || content.includes('typeorm'))) {
        this.addIssue({
          severity: 'high',
          type: 'data-integrity',
          file,
          message: 'Multiple database operations without transaction may cause partial updates',
          suggestion: 'Wrap related operations in a transaction',
        })
      }
    }

    // 检查外键约束
    if (content.includes('delete') && !content.includes('cascade') && !content.includes('onDelete')) {
      this.addIssue({
        severity: 'medium',
        type: 'data-integrity',
        file,
        message: 'Delete operation may leave orphaned records',
        suggestion: 'Add cascade delete or handle related records explicitly',
      })
    }

    // 检查唯一性约束
    if (content.includes('create') && content.includes('email') && !content.includes('unique')) {
      this.addIssue({
        severity: 'medium',
        type: 'data-integrity',
        file,
        message: 'Email field creation may need uniqueness constraint',
        suggestion: 'Add unique constraint or check existence before creation',
      })
    }
  }

  /**
   * 检查边界情况
   */
  private checkEdgeCases(file: string, content: string): void {
    // 检查空值处理
    const hasObjectAccess = content.match(/\w+\.\w+/g)
    const hasNullCheck = content.includes('?.') || content.includes('null') || content.includes('undefined') || content.includes('if')

    if (hasObjectAccess && !hasNullCheck) {
      this.addIssue({
        severity: 'medium',
        type: 'null-handling',
        file,
        message: 'Property access without null check may cause errors',
        suggestion: 'Use optional chaining (?.) or add null checks',
      })
    }

    // 检查数组边界
    if (content.includes('[0]') && !content.includes('length') && !content.includes('?.')) {
      this.addIssue({
        severity: 'medium',
        type: 'array-boundary',
        file,
        message: 'Array index access without length check may cause out-of-bounds error',
        suggestion: 'Check array.length before accessing index',
      })
    }

    // 检查空数组处理
    if (content.includes('.map(') || content.includes('.forEach(')) {
      const hasEmptyCheck = content.includes('.length') || content.includes('if') || content.includes('?')
      if (!hasEmptyCheck) {
        this.addIssue({
          severity: 'low',
          type: 'empty-handling',
          file,
          message: 'Array iteration without empty check',
          suggestion: 'Consider adding check for empty array case',
        })
      }
    }

    // 检查除零
    if (content.includes('/') && !content.includes('=== 0') && !content.includes('!== 0')) {
      this.addIssue({
        severity: 'medium',
        type: 'division-by-zero',
        file,
        message: 'Division operation may cause divide-by-zero error',
        suggestion: 'Add check for zero divisor',
      })
    }
  }

  /**
   * 检查错误处理
   */
  private checkErrorHandling(file: string, content: string): void {
    // 检查try-catch覆盖
    const hasAsync = content.includes('async') || content.includes('await')
    const hasTryCatch = content.includes('try') && content.includes('catch')

    if (hasAsync && !hasTryCatch) {
      this.addIssue({
        severity: 'medium',
        type: 'error-handling',
        file,
        message: 'Async operation without error handling',
        suggestion: 'Add try-catch block for proper error handling',
      })
    }

    // 检查空catch块
    const emptyCatch = content.match(/catch\s*\([^)]*\)\s*\{\s*\}/g)
    if (emptyCatch) {
      this.addIssue({
        severity: 'high',
        type: 'error-handling',
        file,
        message: 'Empty catch block silently swallows errors',
        suggestion: 'Log or handle the error appropriately',
      })
    }

    // 检查错误传递
    if (content.includes('catch') && !content.includes('throw') && !content.includes('return') && !content.includes('log')) {
      this.addIssue({
        severity: 'medium',
        type: 'error-handling',
        file,
        message: 'Error caught but not re-thrown or handled',
        suggestion: 'Either re-throw, return error response, or log the error',
      })
    }
  }

  /**
   * 检查验证
   */
  private checkValidation(file: string, content: string): void {
    // 检查输入验证
    if (content.includes('req.body') || content.includes('params') || content.includes('query')) {
      const hasValidation = content.includes('validate') || content.includes('schema') || content.includes('check') || content.includes('zod') || content.includes('joi')

      if (!hasValidation) {
        this.addIssue({
          severity: 'high',
          type: 'input-validation',
          file,
          message: 'Request input lacks validation',
          suggestion: 'Add input validation using schema validators like Zod or Joi',
        })
      }
    }

    // 检查类型强制转换
    const coercionPatterns = [
      /Number\([^)]+\)/g,
      /parseInt\([^)]+\)/g,
      /parseFloat\([^)]+\)/g,
      /Boolean\([^)]+\)/g,
    ]

    for (const pattern of coercionPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        // 检查是否有NaN检查
        if (!content.includes('isNaN') && !content.includes('Number.isNaN')) {
          this.addIssue({
            severity: 'low',
            type: 'type-coercion',
            file,
            message: 'Type coercion may produce NaN without validation',
            suggestion: 'Add NaN check or use validation library',
          })
        }
      }
    }
  }
}

// 注册
import { registerSubagent } from '../../subagent-registry'
registerSubagent('ReviewBusinessLogic', (config) => new ReviewBusinessLogicAgent(config as Partial<ReviewConfig>))
