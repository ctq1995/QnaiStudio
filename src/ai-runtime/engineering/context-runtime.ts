import { buildEngineeringContext, type EngineeringContextBuilderDeps } from './context-builder'
import type { EngineeringMessage, ProjectedEngineeringMessages } from './message-projector'
import { projectEngineeringMessages } from './message-projector'
import { buildOverflowRecoveryAdvice } from './overflow-recovery'
import type { BudgetedToolResult, ToolResultBudgetOptions } from './tool-result-budget'
import { budgetToolResult as applyToolResultBudget } from './tool-result-budget'
import type { EngineeringContextBudget, EngineeringContextBudgetOptions } from './token-budget'
import type { EngineeringContext, EngineeringRunInput } from './types'

export interface EngineeringContextRuntimeDeps extends EngineeringContextBuilderDeps {
  projectionBudgetOptions?: EngineeringContextBudgetOptions
}

export interface EngineeringContextRuntimePrepareResult {
  context: EngineeringContext
  overflowAdvice: string[]
}

export interface EngineeringContextRuntimeSnapshot {
  capabilities: Array<'prepare' | 'projectMessages' | 'budgetToolResult' | 'buildOverflowAdvice'>
  projectionBudgetOptions?: EngineeringContextBudgetOptions
}

export class EngineeringContextRuntime {
  constructor(private readonly deps: EngineeringContextRuntimeDeps = {}) {}

  async prepare(input: EngineeringRunInput): Promise<EngineeringContextRuntimePrepareResult> {
    const context = await buildEngineeringContext(input, this.deps)
    return {
      context,
      overflowAdvice: this.buildOverflowAdvice(context.budget),
    }
  }

  projectMessages(messages: EngineeringMessage[], options: EngineeringContextBudgetOptions = this.deps.projectionBudgetOptions || {}): ProjectedEngineeringMessages {
    return projectEngineeringMessages(messages, options)
  }

  budgetToolResult(content: string, options: ToolResultBudgetOptions = {}): BudgetedToolResult {
    return applyToolResultBudget(content, options)
  }

  buildOverflowAdvice(budget: EngineeringContextBudget): string[] {
    return buildOverflowRecoveryAdvice(budget)
  }

  snapshot(): EngineeringContextRuntimeSnapshot {
    return {
      capabilities: ['prepare', 'projectMessages', 'budgetToolResult', 'buildOverflowAdvice'],
      projectionBudgetOptions: this.deps.projectionBudgetOptions ? { ...this.deps.projectionBudgetOptions } : undefined,
    }
  }
}

export function createEngineeringContextRuntime(deps: EngineeringContextRuntimeDeps = {}): EngineeringContextRuntime {
  return new EngineeringContextRuntime(deps)
}
