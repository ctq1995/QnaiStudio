import { invoke } from '@tauri-apps/api/core';
import type { ModelProviderConfig, ProviderKind } from '../types/config';

export interface FetchModelsOptions {
  kind: ProviderKind;
  baseUrl: string;
  apiKey?: string;
}

export async function fetchModels(options: FetchModelsOptions): Promise<string[]> {
  const { kind, baseUrl, apiKey } = options;

  const provider: ModelProviderConfig = {
    id: 'temporary-model-fetch',
    name: 'temporary-model-fetch',
    kind,
    baseUrl,
    apiKey: apiKey?.trim() ? apiKey.trim() : undefined,
  };

  return invoke<string[]>('fetch_models', { provider });
}

