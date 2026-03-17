import { invoke } from '@tauri-apps/api/core';

export interface FetchModelsOptions {
  baseUrl: string;
  apiKey?: string;
}

export async function fetchModels(options: FetchModelsOptions): Promise<string[]> {
  const { baseUrl, apiKey } = options;

  const normalizedKey = apiKey?.trim() ? apiKey.trim() : null;
  return invoke<string[]>('fetch_models', { baseUrl, apiKey: normalizedKey });
}

