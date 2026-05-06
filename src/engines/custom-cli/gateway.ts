import {
  continueChat,
  getConfig,
  healthCheck,
  interruptChat,
  listenEvent,
  startChat,
} from '../../services/tauri'
import type { Config, HealthStatus } from '../../types'

export interface CustomCliChatEvent {
  type: string
  session_id?: string
  [key: string]: unknown
}

export interface CustomCliGateway {
  startChat(params: {
    message: string
    workDir?: string
    engineId: string
    sessionId: string
  }): Promise<string>
  continueChat(params: {
    sessionId: string
    message: string
    engineId: string
  }): Promise<void>
  interruptChat(sessionId: string): Promise<void>
  listenChatEvent(handler: (event: CustomCliChatEvent | null) => void): Promise<() => void>
  getConfig(): Promise<Config>
  healthCheck(): Promise<HealthStatus>
}

function parseChatEvent(payload: unknown): CustomCliChatEvent | null {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as CustomCliChatEvent
    } catch (error) {
      console.error('[CustomCliGateway] Failed to parse payload string:', error)
      return null
    }
  }

  if (payload && typeof payload === 'object') {
    return payload as CustomCliChatEvent
  }

  return null
}

export const tauriCustomCliGateway: CustomCliGateway = {
  startChat: (params) => startChat(params),
  continueChat: (params) => continueChat(params),
  interruptChat: (sessionId) => interruptChat(sessionId),
  listenChatEvent: async (handler) => listenEvent<unknown>('chat-event', (payload) => handler(parseChatEvent(payload))),
  getConfig,
  healthCheck,
}

export async function probeCustomCliAvailability(
  gateway: Pick<CustomCliGateway, 'getConfig' | 'healthCheck'> = tauriCustomCliGateway,
): Promise<boolean> {
  try {
    const [config, health] = await Promise.all([gateway.getConfig(), gateway.healthCheck()])
    return Boolean(config.customCli?.cliPath) && health.configValid && health.customCliAvailable
  } catch (error) {
    console.warn('[CustomCliGateway] Failed to probe availability:', error)
    return false
  }
}
