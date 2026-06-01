import { describe, expect, it } from 'vitest';
import type { AITask } from '../task';
import { createEngineeringTaskRunner } from './task-runner-adapter';

describe('createEngineeringTaskRunner afterRuntimeTurn', () => {
  it('invokes afterRuntimeTurn after a successful runtime turn', async () => {
    const calls: string[] = [];
    const runner = createEngineeringTaskRunner({
      sessionId: 'session-1',
      turnRunnerDeps: createTurnRunnerDeps(),
      afterRuntimeTurn: (runtime) => calls.push(runtime.snapshot().sessionId),
      mapTaskToRunInput: () => ({ userRequest: 'review code', workspaceDir: 'E:/workspace' }),
    });

    const result = await runner(createTask(), new AbortController().signal);

    expect(result.success).toBe(true);
    expect(calls).toEqual(['session-1']);
  });

  it('returns the task result when afterRuntimeTurn throws', async () => {
    const runner = createEngineeringTaskRunner({
      sessionId: 'session-1',
      turnRunnerDeps: createTurnRunnerDeps(),
      afterRuntimeTurn: () => {
        throw new Error('sync failed');
      },
      mapTaskToRunInput: () => ({ userRequest: 'review code', workspaceDir: 'E:/workspace' }),
    });

    const result = await runner(createTask(), new AbortController().signal);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

function createTurnRunnerDeps() {
  return {
    createTurnId: () => 'turn-1',
    pipeline: {
      run: async () => ({ success: true, finalMessage: 'ok', content: 'ok' }),
    } as any,
  };
}

function createTask(): AITask {
  return {
    id: 'task-1',
    kind: 'chat',
    input: {
      prompt: 'review code',
      extra: { workspaceDir: 'E:/workspace' },
    },
  };
}
