import { invoke } from '@tauri-apps/api/core'

export async function appendAiLog(line: string): Promise<void> {
  await invoke('append_ai_log', { line })
}
