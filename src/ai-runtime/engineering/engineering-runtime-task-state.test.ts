import { describe, expect, it } from 'vitest'
import type { EngineeringExecutionPipelineDeps } from './execution-pipeline'
import { createEngineeringRuntime } from './engineering-runtime'
import { buildProjectFingerprint } from './project-fingerprint'
import { EngineeringTaskStateTracker } from './task-state-tracker'
import { EngineeringTranscriptRecorder } from './transcript-recorder'
import { createEngineeringTurnRunnerDepsFromPipelineDeps, type EngineeringTurnEvent, type EngineeringTurnInput } from './turn-runner'
import type { EngineeringContext, EngineeringRunEvent, ReviewResult, VerificationCommand, VerificationResult } from './types'

const workspaceDir = 'E:/workspace/project'
const frontendDiff = 'diff --git a/src/App.tsx b/src/App.tsx\nindex 111..222 100644\n--- a/src/App.tsx\n+++ b/src/App.tsx\n'

describe('EngineeringRuntime task state wiring', () => {
  it('records turn and run events into runtime task state snapshots', async () => {
    const taskStateTracker = new EngineeringTaskStateTracker({ now: () => '2026-06-01T00:00:00.000Z' })
    const runtime = createRuntime({ taskStateTracker })

    await runtime.runTurn(createInput('security review auth flow'))

    expect(runtime.snapshot().taskStates).toContainEqual(expect.objectContaining({
      taskId: 'task-runtime-test',
      sessionId: 'session-runtime-test',
      status: 'completed',
      route: 'review',
      subtype: 'review.security',
      skippedStages: ['snapshot', 'execute', 'verify'],
      reviewStrategy: {
        subtype: 'review.security',
        focus: 'security',
      },
    }))
  })

  it('forwards caller turn and run event handlers', async () => {
    const events: Array<EngineeringRunEvent | { type: string }> = []
    const runtime = createRuntime({
      onTurnEvent: (event) => events.push(event),
      onRunEvent: (event) => events.push(event),
    })

    await runtime.runTurn(createInput('run lint'))

    expect(events).toContainEqual(expect.objectContaining({ type: 'route_decided' }))
    expect(events).toContainEqual(expect.objectContaining({ type: 'verification_strategy_selected' }))
    expect(runtime.snapshot().taskStates).toContainEqual(expect.objectContaining({
      taskId: 'task-runtime-test',
      verificationStrategy: {
        subtype: 'verify.lint',
        commandIds: ['npm-lint'],
      },
    }))
  })

  it('keeps transcript and caller callbacks running when task state tracker throws', async () => {
    const transcriptRecorder = new EngineeringTranscriptRecorder({ createEventId: () => 'event-runtime-test' })
    const turnEvents: string[] = []
    const throwingTracker = {
      recordTurnEvent: () => {
        throw new Error('tracker failed')
      },
      recordRunEvent: () => {
        throw new Error('tracker failed')
      },
      getAllTaskStates: () => [],
    } as unknown as EngineeringTaskStateTracker
    const runtime = createRuntime({
      transcriptRecorder,
      taskStateTracker: throwingTracker,
      onTurnEvent: (event) => turnEvents.push(event.type),
    })

    await runtime.runTurn(createInput('security review auth flow'))

    expect(turnEvents).toContain('route_decided')
    const transcriptSnapshot = await transcriptRecorder.snapshot()
    expect(transcriptSnapshot.events.length).toBeGreaterThan(0)
    expect(runtime.snapshot().taskStates).toEqual([])
  })
})

function createInput(userRequest: string): EngineeringTurnInput {
  return {
    taskId: 'task-runtime-test',
    sessionId: 'session-runtime-test',
    userRequest,
    workspaceDir,
  }
}

function createRuntime(options: {
  taskStateTracker?: EngineeringTaskStateTracker
  transcriptRecorder?: EngineeringTranscriptRecorder
  onTurnEvent?: (event: EngineeringTurnEvent) => void
  onRunEvent?: (event: EngineeringRunEvent) => void
} = {}) {
  const pipelineDeps = createPipelineDeps()
  const turnRunnerDeps = createEngineeringTurnRunnerDepsFromPipelineDeps(pipelineDeps)

  return createEngineeringRuntime({
    sessionId: 'session-runtime-test',
    transcriptRecorder: options.transcriptRecorder,
    taskStateTracker: options.taskStateTracker,
    turnRunnerDeps: {
      ...turnRunnerDeps,
      onTurnEvent: options.onTurnEvent,
      onRunEvent: options.onRunEvent,
    },
  })
}

function createPipelineDeps(): EngineeringExecutionPipelineDeps {
  return {
    createSnapshot: async () => ({ versionId: 'snapshot-1' }),
    executeAgentTask: async () => ({ success: true, content: 'agent done' }),
    getGitDiff: async () => frontendDiff,
    runVerification: async (commands) => commands.map(createVerificationResult),
    runReview: async (): Promise<ReviewResult> => ({ success: true, content: 'review ok' }),
    contextRuntime: {
      prepare: async () => ({ context: createContext(), overflowAdvice: [] }),
      projectMessages: () => ({ messages: [], droppedMessages: 0, estimatedTokens: 0, truncatedToolResults: 0, budget: { maxTokens: 1000, reservedOutputTokens: 100, estimatedTokens: 0, remainingTokens: 900, overflow: false } }),
      budgetToolResult: (content: string) => ({ content, truncated: false, originalLength: content.length, omittedChars: 0 }),
      buildOverflowAdvice: () => [],
      compactMessages: (messages: unknown[]) => ({ messages, actions: [], beforeBudget: { maxTokens: 1000, reservedOutputTokens: 100, estimatedTokens: 0, remainingTokens: 900, overflow: false }, afterBudget: { maxTokens: 1000, reservedOutputTokens: 100, estimatedTokens: 0, remainingTokens: 900, overflow: false } }),
      snapshot: () => ({ capabilities: [] }),
    } as any,
  }
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
