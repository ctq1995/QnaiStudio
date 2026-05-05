import { Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchModels } from '../../services/modelService';

interface ModelInputWithFetchProps {
  engineId: string;
  value: string;
  baseUrl: string;
  apiKey: string;
  placeholder: string;
  disabled?: boolean;
  dirty?: boolean;
  onChange: (value: string) => void;
}

function buildModelsEndpointPreview(baseUrl: string): string | null {
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\/+$/, '');
  if (normalized.endsWith('/v1/models')) {
    return normalized;
  }
  if (normalized.endsWith('/v1')) {
    return `${normalized}/models`;
  }
  return `${normalized}/v1/models`;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function ModelInputWithFetch({
  engineId,
  value,
  baseUrl,
  apiKey,
  placeholder,
  disabled,
  dirty = false,
  onChange,
}: ModelInputWithFetchProps) {
  const [models, setModels] = useState<string[] | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const datalistId = useMemo(() => `models-${engineId}`, [engineId]);
  const modelOptions = models ?? [];

  const tooltip = useMemo(() => {
    const endpoint = buildModelsEndpointPreview(baseUrl);
    if (!endpoint) {
      return '请先填写 API Base URL';
    }
    return `接口：${endpoint}`;
  }, [baseUrl]);

  const handleFetch = useCallback(async () => {
    const trimmedBaseUrl = baseUrl.trim();
    if (!trimmedBaseUrl) {
      setError('请先填写 API Base URL');
      return;
    }

    setIsFetching(true);
    setError(null);
    try {
      const items = await fetchModels({ baseUrl: trimmedBaseUrl, apiKey });
      setModels(items);
    } catch (e) {
      setModels(null);
      setError(normalizeErrorMessage(e));
    } finally {
      setIsFetching(false);
    }
  }, [apiKey, baseUrl]);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          list={datalistId}
          placeholder={placeholder}
          className={dirty ? 'border-primary' : ''}
        />

        <Button
          variant="outline"
          size="default"
          onClick={handleFetch}
          disabled={disabled || isFetching}
          title={tooltip}
          className="shrink-0"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '获取'}
        </Button>
      </div>

      {modelOptions.length > 0 && (
        <div className="mt-1.5 text-xs text-text-muted">
          已获取 {modelOptions.length} 个模型，可在输入框中下拉选择。
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <pre className="whitespace-pre-wrap break-words font-mono">{error}</pre>
        </div>
      )}

      <datalist id={datalistId}>
        {modelOptions.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
    </div>
  );
}
