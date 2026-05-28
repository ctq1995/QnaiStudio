export type RepoMapFileKind =
  | 'frontend'
  | 'tauri'
  | 'rust'
  | 'python'
  | 'go'
  | 'java'
  | 'kotlin'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'cpp'
  | 'dart'
  | 'swift'
  | 'config'
  | 'docs'
  | 'test'
  | 'script'
  | 'unknown'

export interface EngineeringRepoMapFile {
  path: string
  kind: RepoMapFileKind
  isEntry: boolean
}

export interface EngineeringRepoMap {
  files: EngineeringRepoMapFile[]
  entries: EngineeringRepoMapFile[]
  kindCounts: Record<RepoMapFileKind, number>
  summary: string
}

const IGNORED_SEGMENTS = new Set(['.git', 'node_modules', 'dist', 'build', 'target', '.next'])
const ENTRY_FILES = new Set([
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  'src/main.tsx',
  'src/App.tsx',
  'src-tauri/Cargo.toml',
  'src-tauri/src/lib.rs',
  'src-tauri/src/main.rs',
  'README.md',
  'SOUL.md',
  'USER.md',
])

export function buildEngineeringRepoMap(paths: string[]): EngineeringRepoMap {
  const files = Array.from(new Set(paths.map(normalizePath)))
    .filter((path) => path.length > 0 && !isIgnoredPath(path))
    .sort()
    .map((path) => ({
      path,
      kind: classifyRepoMapFile(path),
      isEntry: ENTRY_FILES.has(path),
    }))

  const entries = files.filter((file) => file.isEntry)
  const kindCounts = createEmptyKindCounts()
  for (const file of files) kindCounts[file.kind] += 1

  return {
    files,
    entries,
    kindCounts,
    summary: buildRepoMapSummary(files, entries, kindCounts),
  }
}

export function classifyRepoMapFile(path: string): RepoMapFileKind {
  const normalized = normalizePath(path)

  if (normalized.startsWith('src-tauri/')) return 'tauri'
  if (normalized.startsWith('docs/') || normalized.endsWith('.md')) return 'docs'
  if (/(^|\/)(tests|test|__tests__)\//.test(normalized) || /\.(test|spec)\.[tj]sx?$/.test(normalized)) return 'test'
  if (normalized.startsWith('scripts/') || /\.(ps1|sh|bat|cmd)$/.test(normalized)) return 'script'
  if (isConfigFile(normalized)) return 'config'
  if (/\.(rs)$/.test(normalized) || normalized.endsWith('Cargo.toml')) return 'rust'
  if (/\.(py)$/.test(normalized) || ['pyproject.toml', 'requirements.txt', 'Pipfile'].includes(normalized)) return 'python'
  if (/\.(go)$/.test(normalized) || ['go.mod', 'go.sum'].includes(normalized)) return 'go'
  if (/\.(java)$/.test(normalized) || normalized === 'pom.xml') return 'java'
  if (/\.(kt|kts)$/.test(normalized) || /gradle(\.kts)?$/.test(normalized)) return 'kotlin'
  if (/\.(cs|csproj|sln)$/.test(normalized)) return 'csharp'
  if (/\.(php)$/.test(normalized) || normalized === 'composer.json') return 'php'
  if (/\.(rb)$/.test(normalized) || normalized === 'Gemfile') return 'ruby'
  if (/\.(c|cc|cpp|cxx|h|hpp)$/.test(normalized) || ['CMakeLists.txt', 'Makefile'].includes(normalized)) return 'cpp'
  if (/\.(dart)$/.test(normalized) || normalized === 'pubspec.yaml') return 'dart'
  if (/\.(swift)$/.test(normalized) || normalized === 'Package.swift') return 'swift'
  if (normalized.startsWith('src/') && /\.(ts|tsx|js|jsx|css)$/.test(normalized)) return 'frontend'

  return 'unknown'
}

function buildRepoMapSummary(
  files: EngineeringRepoMapFile[],
  entries: EngineeringRepoMapFile[],
  kindCounts: Record<RepoMapFileKind, number>
): string {
  const counts = Object.entries(kindCounts)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${kind}: ${count}`)
    .join(', ')
  const entryList = entries.slice(0, 12).map((entry) => entry.path).join(', ')

  return [
    `Repo files: ${files.length}`,
    `Entries: ${entries.length}${entryList ? ` (${entryList})` : ''}`,
    `Kinds: ${counts || 'none'}`,
  ].join('\n')
}

function createEmptyKindCounts(): Record<RepoMapFileKind, number> {
  return {
    frontend: 0,
    tauri: 0,
    rust: 0,
    python: 0,
    go: 0,
    java: 0,
    kotlin: 0,
    csharp: 0,
    php: 0,
    ruby: 0,
    cpp: 0,
    dart: 0,
    swift: 0,
    config: 0,
    docs: 0,
    test: 0,
    script: 0,
    unknown: 0,
  }
}

function isConfigFile(path: string): boolean {
  return path === 'package.json' ||
    path === 'package-lock.json' ||
    path === 'vite.config.ts' ||
    path === 'tsconfig.json' ||
    path === 'tsconfig.node.json' ||
    path === 'Cargo.toml' ||
    path.endsWith('/Cargo.toml') ||
    path.endsWith('.config.ts') ||
    path.endsWith('.config.js')
}

function isIgnoredPath(path: string): boolean {
  return path.split('/').some((segment) => IGNORED_SEGMENTS.has(segment))
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}
