import { describe, expect, it } from 'vitest'
import { routeEngineeringAgentTask } from './agent-router'
import { EngineeringExecutionPipeline, type EngineeringExecutionPipelineDeps } from './execution-pipeline'
import { buildProjectFingerprint } from './project-fingerprint'
import type { EngineeringContext, EngineeringRunEvent, EngineeringRunInput, ReviewResult, VerificationCommand, VerificationResult } from './types'

const workspaceDir = 'E:/workspace/project'
const frontendDiff = 'diff --git a/src/App.tsx b/src/App.tsx\nindex 111..222 100644\n--- a/src/App.tsx\n+++ b/src/App.tsx\n'

describe('EngineeringExecutionPipeline router decisions', () => {
  it('runs context only for explain routes', async () => {
    const calls = createCallTracker()
    const pipeline = createPipeline(calls)
    const input = createInput('explain how authentication works')

    const summary = await pipeline.run(input, { routeDecision: routeEngineeringAgentTask(input) })

    expect(summary.success).toBe(true)
    expect(calls.snapshot).toBe(0)
    expect(calls.execute).toBe(0)
    expect(calls.diff).toBe(0)
    expect(calls.verify).toBe(0)
    expect(calls.review).toBe(0)
    expect(calls.skippedStages).toEqual(['snapshot', 'execute', 'diff', 'verify', 'review'])
  })

  it('runs diff and review for review routes without executing the agent', async () => {
    const calls = createCallTracker()
    const pipeline = createPipeline(calls)
    const input = createInput('security review auth flow')

    const summary = await pipeline.run(input, { routeDecision: routeEngineeringAgentTask(input) })

    expect(summary.success).toBe(true)
    expect(calls.snapshot).toBe(0)
    expect(calls.execute).toBe(0)
    expect(calls.diff).toBe(1)
    expect(calls.review).toBe(1)
    expect(calls.reviewPrompts[0]).toContain('security focus')
    expect(calls.strategyEvents).toContainEqual(expect.objectContaining({
      type: 'review_strategy_selected',
      subtype: 'review.security',
      focus: 'security',
    }))
  })

  it('runs diff and verification for verify routes without executing the agent', async () => {
    const calls = createCallTracker()
    const pipeline = createPipeline(calls)
    const input = createInput('run lint')
    const routeDecision = routeEngineeringAgentTask(input)

    const summary = await pipeline.run(input, { routeDecision })

    expect(summary.success).toBe(true)
    expect(calls.snapshot).toBe(0)
    expect(calls.execute).toBe(0)
    expect(calls.diff).toBe(1)
    expect(calls.verify).toBe(1)
    expect(calls.review).toBe(0)
    expect(summary.verificationResults).toHaveLength(1)
    expect(calls.verificationCommandIds).toEqual(['npm-lint'])
    expect(calls.strategyEvents).toContainEqual(expect.objectContaining({
      type: 'verification_strategy_selected',
      subtype: 'verify.lint',
      commandIds: ['npm-lint'],
    }))
  })

  it('runs the full pipeline for execute routes', async () => {
    const calls = createCallTracker()
    const pipeline = createPipeline(calls)
    const input = createInput('实现 dark mode setting')

    const summary = await pipeline.run(input, { routeDecision: routeEngineeringAgentTask(input) })

    expect(summary.success).toBe(true)
    expect(calls.snapshot).toBe(1)
    expect(calls.execute).toBe(1)
    expect(calls.diff).toBe(1)
    expect(calls.verify).toBe(1)
    expect(calls.review).toBe(1)
  })
})

function createInput(userRequest: string): EngineeringRunInput {
  return {
    taskId: 'task-router-test',
    userRequest,
    workspaceDir,
  }
}

function createPipeline(calls: ReturnType<typeof createCallTracker>): EngineeringExecutionPipeline {
  const deps: EngineeringExecutionPipelineDeps = {
    onEvent: (event) => {
      if (event.type === 'stage_skipped') {
        calls.skippedStages.push(event.stage)
      }
      if (event.type === 'verification_strategy_selected' || event.type === 'review_strategy_selected') {
        calls.strategyEvents.push(event)
      }
    },
    createSnapshot: async () => {
      calls.snapshot += 1
      return { versionId: 'snapshot-1' }
    },
    executeAgentTask: async () => {
      calls.execute += 1
      return { success: true, content: 'agent done' }
    },
    getGitDiff: async () => {
      calls.diff += 1
      return frontendDiff
    },
    runVerification: async (commands) => {
      calls.verify += 1
      calls.verificationCommandIds.push(...commands.map((command) => command.id))
      return commands.map(createVerificationResult)
    },
    runReview: async (prompt): Promise<ReviewResult> => {
      calls.review += 1
      calls.reviewPrompts.push(prompt)
      return { success: true, content: 'review ok' }
    },
    contextRuntime: {
      prepare: async () => ({ context: createContext(), overflowAdvice: [] }),
      projectMessages: () => ({ messages: [], droppedMessages: 0, estimatedTokens: 0, truncatedToolResults: 0, budget: { maxTokens: 1000, reservedOutputTokens: 100, estimatedTokens: 0, remainingTokens: 900, overflow: false } }),
      budgetToolResult: (content: string) => ({ content, truncated: false, originalLength: content.length, omittedChars: 0 }),
      buildOverflowAdvice: () => [],
      compactMessages: (messages: unknown[]) => ({ messages, actions: [], beforeBudget: { maxTokens: 1000, reservedOutputTokens: 100, estimatedTokens: 0, remainingTokens: 900, overflow: false }, afterBudget: { maxTokens: 1000, reservedOutputTokens: 100, estimatedTokens: 0, remainingTokens: 900, overflow: false } }),
      snapshot: () => ({ capabilities: [] }),
    } as any,
  }

  return new EngineeringExecutionPipeline(deps)
}

function createVerificationResult(command: VerificationCommand): VerificationResult {
  return {
    command,
    success: true,
    output: 'ok',
  }
}

function createContext(): EngineeringContext {
  return {
    workspaceDir,
    selectedFiles: [],
    candidateFiles: ['src/App.tsx'],
    instructions: { files: [], merged: '' },
    budget: {
      maxTokens: 1000,
      reservedOutputTokens: 100,
      estimatedTokens: 10,
      remainingTokens: 890,
      overflow: false,
    },
    providers: [],
    projectSignals: {
      hasFrontend: true,
      hasTauri: false,
      packageManager: 'npm',
      buildTools: ['vite'],
      scripts: { build: 'vite build', test: 'vitest run', lint: 'eslint .', typecheck: 'tsc --noEmit' },
      fingerprint: buildProjectFingerprint({
        files: ['package.json', 'src/App.tsx'],
        packageScripts: { build: 'vite build', test: 'vitest run', lint: 'eslint .', typecheck: 'tsc --noEmit' },
      }),
    },
    summary: 'context summary',
  }
}

function createCallTracker() {
  return {
    snapshot: 0,
    execute: 0,
    diff: 0,
    verify: 0,
    review: 0,
    verificationCommandIds: [] as string[],
    reviewPrompts: [] as string[],
    skippedStages: [] as string[],
    strategyEvents: [] as EngineeringRunEvent[],
  }
}
