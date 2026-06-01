import { beforeEach, describe, expect, it } from 'vitest';
import type { AITask, EngineeringTaskRunner } from '../ai-runtime';
import { buildProjectFingerprint } from '../ai-runtime/engineering/project-fingerprint';
import { useEngineeringTaskStateStore } from '../stores/engineeringTaskStateStore';
import { registerEngineeringPipelineRunner } from './engineering-runtime-bootstrap';

describe('registerEngineeringPipelineRunner task state auto sync', () => {
  beforeEach(() => {
    useEngineeringTaskStateStore.getState().clear();
  });

  it('uses the default runtime task state sync hook', async () => {
    const taskManager = createTaskManager();
    registerEngineeringPipelineRunner({
      taskManager: taskManager as any,
      ...createPipelineInput(),
    });

    await taskManager.runner(createTask(), new AbortController().signal);

    expect(useEngineeringTaskStateStore.getState().taskStates).toEqual([
      expect.objectContaining({ taskId: 'task-1', status: 'completed' }),
    ]);
  });

  it('respects caller-provided afterRuntimeTurn override', async () => {
    const calls: string[] = [];
    const taskManager = createTaskManager();
    registerEngineeringPipelineRunner({
      taskManager: taskManager as any,
      afterRuntimeTurn: (runtime) => calls.push(runtime.snapshot().sessionId),
      ...createPipelineInput(),
    });

    await taskManager.runner(createTask(), new AbortController().signal);

    expect(calls).toEqual(['engineering-session-task-1']);
    expect(useEngineeringTaskStateStore.getState().taskStates).toEqual([]);
  });
});

function createTaskManager() {
  const taskManager = {
    runner: undefined as unknown as EngineeringTaskRunner,
    setEngineeringRunner(runner: EngineeringTaskRunner) {
      this.runner = runner;
    },
  };
  return taskManager as typeof taskManager & { setEngineeringRunner: (runner: EngineeringTaskRunner) => void };
}

function createPipelineInput() {
  return {
    createSnapshot: async () => ({ versionId: 'snapshot-1' }),
    executeAgentTask: async () => ({ success: true, content: 'done' }),
    getGitDiff: async () => '',
    runVerification: async () => [],
    runReview: async () => ({ success: true, skipped: true }),
    contextRuntime: {
      prepare: async () => ({
        context: {
          workspaceDir: 'E:/workspace',
          selectedFiles: [],
          candidateFiles: [],
          instructions: { files: [], merged: '' },
          budget: { maxTokens: 1000, usedTokens: 0, remainingTokens: 1000, droppedMessages: 0, compacted: false },
          providers: [],
          summary: '',
          projectSignals: {
            workspaceDir: 'E:/workspace',
            selectedFiles: [],
            candidateFiles: [],
            openFiles: [],
            recentFiles: [],
            scripts: {},
            buildTools: [],
            fingerprint: buildProjectFingerprint({ files: [], packageScripts: {} }),
          },
          droppedMessages: 0,
          compacted: false,
        },
      }),
    } as any,
  };
}

function createTask(): AITask {
  return {
    id: 'task-1',
    kind: 'chat',
    input: {
      prompt: 'explain status',
      extra: { workspaceDir: 'E:/workspace' },
    },
  };
}
