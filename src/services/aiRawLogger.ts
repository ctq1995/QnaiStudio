import { listenEvent } from './tauri'
import { appendAiLog } from './aiLog'
import { useViewStore } from '../stores/viewStore'

const LOG_EVENT_NAME = 'chat-event'
const LOG_SOURCE = 'tauri'
const LOG_VERSION = 1
const LOG_PREFIX = '[AiRawLogger]'

interface AiRawLogEntry {
  version: number
  timestamp: string
  source: string
  payload: unknown
}

function buildLogLine(payload: unknown): string {
  const entry: AiRawLogEntry = {
    version: LOG_VERSION,
    timestamp: new Date().toISOString(),
    source: LOG_SOURCE,
    payload,
  }
  return JSON.stringify(entry)
}

export async function initAiRawLogger(): Promise<void> {
  await listenEvent<unknown>(LOG_EVENT_NAME, (payload) => {
    const { showDeveloperPanel } = useViewStore.getState()
    if (!showDeveloperPanel) return
    const line = buildLogLine(payload)
    appendAiLog(line).catch((error) => {
      console.error(`${LOG_PREFIX} Failed to append log line`, error)
    })
  })
}
