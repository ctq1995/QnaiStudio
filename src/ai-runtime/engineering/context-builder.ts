import { createDefaultEngineeringContextProviderRegistry } from './context-provider'
import { loadEngineeringInstructions } from './instruction-loader'
import { buildProjectFingerprint } from './project-fingerprint'
import { buildEngineeringRepoMap } from './repo-map'
import { calculateContextBudget } from './token-budget'
import type { EngineeringContext, EngineeringRunInput } from './types'

export interface EngineeringContextBuilderDeps {
  readTextFile?: (path: string, workspaceDir: string) => Promise<string>
  fileExists?: (path: string, workspaceDir: string) => Promise<boolean>
}

const DEFAULT_CANDIDATES = [
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tsconfig.json',
  'src/main.tsx',
  'src/App.tsx',
  'src-tauri/Cargo.toml',
  'src-tauri/src/lib.rs',
  'src-tauri/src/main.rs',
]

const KEYWORD_FILE_HINTS: Array<{ keywords: string[]; files: string[] }> = [
  { keywords: ['设置', 'settings', '配置', 'config'], files: ['src/stores/configStore.ts', 'src/components/Settings/SettingsPage.tsx'] },
  { keywords: ['聊天', 'chat', '会话', 'session'], files: ['src/stores/chat/chatSessionStore.ts', 'src/stores/eventChatStore.ts'] },
  { keywords: ['文件', 'file', '编辑器', 'editor'], files: ['src/stores/fileEditorStore.ts', 'src/components/Editor/EditorPanel.tsx'] },
  { keywords: ['agent', '工程', '执行', 'runtime'], files: ['src/ai-runtime/index.ts', 'src/ai-runtime/task-manager.ts'] },
  { keywords: ['tauri', 'rust', '后端'], files: ['src-tauri/src/lib.rs', 'src-tauri/Cargo.toml'] },
]

export async function buildEngineeringContext(
  input: EngineeringRunInput,
  deps: EngineeringContextBuilderDeps = {}
): Promise<EngineeringContext> {
  const selectedFiles = normalizeFiles(input.selectedFiles || [])
  const candidateFiles = new Set<string>([...selectedFiles, ...DEFAULT_CANDIDATES])
  const request = input.userRequest.toLowerCase()

  for (const hint of KEYWORD_FILE_HINTS) {
    if (hint.keywords.some((keyword) => request.includes(keyword.toLowerCase()))) {
      for (const file of hint.files) candidateFiles.add(file)
    }
  }

  const scripts = await readPackageScripts(input.workspaceDir, deps)
  const instructions = await loadEngineeringInstructions(input.workspaceDir, deps)
  const hasTauri = await exists('src-tauri/Cargo.toml', input.workspaceDir, deps)
  const hasFrontend = await exists('package.json', input.workspaceDir, deps)
  const packageManager = await detectPackageManager(input.workspaceDir, deps)
  const fingerprint = buildProjectFingerprint({
    files: Array.from(candidateFiles),
    packageScripts: scripts,
  })
  const repoMap = buildEngineeringRepoMap(Array.from(candidateFiles))
  const budget = calculateContextBudget([
    input.userRequest,
    ...selectedFiles,
    ...Array.from(candidateFiles),
    instructions.merged,
  ])
  const providerRegistry = createDefaultEngineeringContextProviderRegistry()
  const providers = await providerRegistry.collect({
    selectedFiles,
    instructions,
    repoMap,
    fingerprint,
    diagnostics: input.diagnostics || [],
  })

  const context: EngineeringContext = {
    workspaceDir: input.workspaceDir,
    selectedFiles,
    candidateFiles: Array.from(candidateFiles).sort(),
    repoMap,
    instructions,
    budget,
    providers,
    projectSignals: {
      hasFrontend,
      hasTauri,
      packageManager,
      buildTools: fingerprint.buildSystems.filter((system) => system !== 'unknown'),
      scripts,
      fingerprint,
    },
    summary: '',
  }

  context.summary = buildContextSummary(context)
  return context
}

function normalizeFiles(files: string[]): string[] {
  return Array.from(new Set(files.map((file) => file.replace(/\\/g, '/').replace(/^\.\//, '')).filter(Boolean))).sort()
}

async function readPackageScripts(workspaceDir: string, deps: EngineeringContextBuilderDeps): Promise<Record<string, string>> {
  if (!deps.readTextFile) return {}
  try {
    const content = await deps.readTextFile('package.json', workspaceDir)
    const parsed = JSON.parse(content) as { scripts?: Record<string, string> }
    return parsed.scripts || {}
  } catch {
    return {}
  }
}

async function detectPackageManager(workspaceDir: string, deps: EngineeringContextBuilderDeps): Promise<string | undefined> {
  if (await exists('pnpm-lock.yaml', workspaceDir, deps)) return 'pnpm'
  if (await exists('yarn.lock', workspaceDir, deps)) return 'yarn'
  if (await exists('package-lock.json', workspaceDir, deps)) return 'npm'
  if (await exists('package.json', workspaceDir, deps)) return 'npm'
  return undefined
}

async function exists(path: string, workspaceDir: string, deps: EngineeringContextBuilderDeps): Promise<boolean> {
  if (!deps.fileExists) return false
  try {
    return await deps.fileExists(path, workspaceDir)
  } catch {
    return false
  }
}

function buildContextSummary(context: EngineeringContext): string {
  const signals = context.projectSignals
  const parts = [
    `Workspace: ${context.workspaceDir}`,
    `Selected files: ${context.selectedFiles.length}`,
    `Candidate files: ${context.candidateFiles.length}`,
    `Frontend: ${signals.hasFrontend ? 'yes' : 'no'}`,
    `Tauri: ${signals.hasTauri ? 'yes' : 'no'}`,
  ]

  if (signals.packageManager) parts.push(`Package manager: ${signals.packageManager}`)
  if (context.instructions.files.length > 0) parts.push(`Instruction files: ${context.instructions.files.map((file) => file.path).join(', ')}`)
  const scriptNames = Object.keys(signals.scripts)
  if (scriptNames.length > 0) parts.push(`Scripts: ${scriptNames.join(', ')}`)

  return parts.join('\n')
}
