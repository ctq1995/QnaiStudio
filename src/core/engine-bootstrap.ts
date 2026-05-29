/**
 * Engine Bootstrap - AI 引擎启动注册
 */

import { getEngineRegistry, registerEngine } from '../ai-runtime'
import { ClaudeCodeEngine } from '../engines/claude-code'
import { CodexCliEngine } from '../engines/codex-cli'
import { IFlowEngine } from '../engines/iflow'
import { GeminiEngine } from '../engines/gemini'
import { CustomCliEngine } from '../engines/custom-cli'

export * from './engineering-runtime-bootstrap'

export const REGISTERED_ENGINE_IDS = ['claude-code', 'codex-cli', 'custom-cli', 'iflow', 'gemini'] as const
export type EngineId = typeof REGISTERED_ENGINE_IDS[number]

function createEngine(engineId: EngineId) {
  switch (engineId) {
    case 'codex-cli':
      return new CodexCliEngine()
    case 'iflow':
      return new IFlowEngine()
    case 'gemini':
      return new GeminiEngine()
    case 'custom-cli':
      return new CustomCliEngine()
    case 'claude-code':
    default:
      return new ClaudeCodeEngine()
  }
}

export async function bootstrapEngines(defaultEngineId: EngineId = 'claude-code'): Promise<void> {
  const registry = getEngineRegistry()
  registerEngine(createEngine(defaultEngineId), { asDefault: true })
  await registry.initializeAll()
  console.log('[EngineBootstrap] Initialized default engine:', defaultEngineId)
}

export async function registerEngineLazy(engineId: EngineId): Promise<void> {
  const registry = getEngineRegistry()
  if (registry.has(engineId)) {
    return
  }

  const engine = createEngine(engineId)
  registerEngine(engine)
  if (engine.initialize) {
    await engine.initialize()
  }

  console.log('[EngineBootstrap] Lazy registered engine:', engineId)
}

export function getDefaultEngine() {
  return getEngineRegistry().getDefault()
}

export function getEngine(engineId: EngineId) {
  return getEngineRegistry().get(engineId)
}

export function listEngines() {
  return getEngineRegistry().list()
}

export async function isEngineAvailable(engineId: EngineId): Promise<boolean> {
  return getEngineRegistry().isAvailable(engineId)
}
