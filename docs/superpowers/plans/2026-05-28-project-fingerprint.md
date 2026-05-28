# Project Fingerprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a path-based multi-language project fingerprint layer to make the engineering Agent useful across many language ecosystems.

**Architecture:** Implement a pure `project-fingerprint.ts` module that identifies languages, build systems, package files, lock files, entries, tests, configs, and suggested verification commands from file paths plus package scripts. Integrate the fingerprint into context, repo map classification, verification policy compatibility, summary output, and exports.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/project-fingerprint.ts`: multi-language fingerprint builder.
- Modify `src/ai-runtime/engineering/types.ts`: add fingerprint to `EngineeringProjectSignals`.
- Modify `src/ai-runtime/engineering/context-builder.ts`: create fingerprint from candidate files and scripts.
- Modify `src/ai-runtime/engineering/repo-map.ts`: expand file kinds and classification.
- Modify `src/ai-runtime/engineering/verification-policy.ts`: expose fingerprint-driven command merge helper while keeping existing function.
- Modify `src/ai-runtime/engineering/summary-builder.ts`: show languages/build systems/verification command count.
- Modify `src/ai-runtime/engineering/index.ts`: export fingerprint module.

---

### Task 1: Project Fingerprint Module

**Files:**
- Create: `src/ai-runtime/engineering/project-fingerprint.ts`

- [ ] **Step 1: Implement fingerprint module**

Create `src/ai-runtime/engineering/project-fingerprint.ts` with:

```ts
import type { VerificationCommand } from './types'

export type EngineeringLanguage = 'typescript' | 'javascript' | 'rust' | 'python' | 'go' | 'java' | 'kotlin' | 'csharp' | 'php' | 'ruby' | 'cpp' | 'dart' | 'swift' | 'unknown'
export type EngineeringBuildSystem = 'npm' | 'pnpm' | 'yarn' | 'cargo' | 'poetry' | 'pipenv' | 'uv' | 'pip' | 'go' | 'maven' | 'gradle' | 'dotnet' | 'composer' | 'bundler' | 'cmake' | 'make' | 'flutter' | 'xcode' | 'unknown'

export interface EngineeringProjectFingerprint {
  languages: EngineeringLanguage[]
  buildSystems: EngineeringBuildSystem[]
  packageFiles: string[]
  lockFiles: string[]
  entryFiles: string[]
  testFiles: string[]
  configFiles: string[]
  suggestedVerificationCommands: VerificationCommand[]
  summary: string
}

export interface BuildProjectFingerprintInput {
  files: string[]
  packageScripts?: Record<string, string>
}

export function buildProjectFingerprint(input: BuildProjectFingerprintInput): EngineeringProjectFingerprint {
  const files = Array.from(new Set(input.files.map(normalizePath))).sort()
  const languages = new Set<EngineeringLanguage>()
  const buildSystems = new Set<EngineeringBuildSystem>()
  const packageFiles = new Set<string>()
  const lockFiles = new Set<string>()
  const entryFiles = new Set<string>()
  const testFiles = new Set<string>()
  const configFiles = new Set<string>()

  for (const file of files) {
    detectFromFile(file, languages, buildSystems, packageFiles, lockFiles, entryFiles, testFiles, configFiles)
  }

  const sortedLanguages = sortValues(languages)
  const sortedBuildSystems = sortValues(buildSystems)
  const suggestedVerificationCommands = buildSuggestedVerificationCommands(sortedBuildSystems, input.packageScripts || {}, files)

  return {
    languages: sortedLanguages.length > 0 ? sortedLanguages : ['unknown'],
    buildSystems: sortedBuildSystems.length > 0 ? sortedBuildSystems : ['unknown'],
    packageFiles: sortValues(packageFiles),
    lockFiles: sortValues(lockFiles),
    entryFiles: sortValues(entryFiles),
    testFiles: sortValues(testFiles),
    configFiles: sortValues(configFiles),
    suggestedVerificationCommands,
    summary: buildFingerprintSummary(sortedLanguages, sortedBuildSystems, suggestedVerificationCommands),
  }
}

function detectFromFile(
  file: string,
  languages: Set<EngineeringLanguage>,
  buildSystems: Set<EngineeringBuildSystem>,
  packageFiles: Set<string>,
  lockFiles: Set<string>,
  entryFiles: Set<string>,
  testFiles: Set<string>,
  configFiles: Set<string>
): void {
  if (isTestFile(file)) testFiles.add(file)
  if (isConfigFile(file)) configFiles.add(file)
  if (isEntryFile(file)) entryFiles.add(file)

  if (file === 'package.json') { packageFiles.add(file); buildSystems.add('npm'); languages.add('javascript') }
  if (file === 'package-lock.json') { lockFiles.add(file); buildSystems.add('npm') }
  if (file === 'pnpm-lock.yaml') { lockFiles.add(file); buildSystems.add('pnpm') }
  if (file === 'yarn.lock') { lockFiles.add(file); buildSystems.add('yarn') }
  if (/\.(ts|tsx)$/.test(file) || file === 'tsconfig.json') languages.add('typescript')
  if (/\.(js|jsx|mjs|cjs)$/.test(file)) languages.add('javascript')

  if (file.endsWith('Cargo.toml')) { packageFiles.add(file); buildSystems.add('cargo'); languages.add('rust') }
  if (file.endsWith('Cargo.lock')) { lockFiles.add(file); buildSystems.add('cargo') }
  if (file.endsWith('.rs')) languages.add('rust')

  if (file === 'pyproject.toml') { packageFiles.add(file); buildSystems.add('poetry'); languages.add('python') }
  if (file === 'poetry.lock') { lockFiles.add(file); buildSystems.add('poetry') }
  if (file === 'Pipfile') { packageFiles.add(file); buildSystems.add('pipenv'); languages.add('python') }
  if (file === 'Pipfile.lock') { lockFiles.add(file); buildSystems.add('pipenv') }
  if (file === 'uv.lock') { lockFiles.add(file); buildSystems.add('uv') }
  if (file === 'requirements.txt' || file === 'setup.py') { packageFiles.add(file); buildSystems.add('pip'); languages.add('python') }
  if (file.endsWith('.py')) languages.add('python')

  if (file === 'go.mod') { packageFiles.add(file); buildSystems.add('go'); languages.add('go') }
  if (file === 'go.sum') { lockFiles.add(file); buildSystems.add('go') }
  if (file.endsWith('.go')) languages.add('go')

  if (file === 'pom.xml') { packageFiles.add(file); buildSystems.add('maven'); languages.add('java') }
  if (/build\.gradle(\.kts)?$/.test(file) || /settings\.gradle(\.kts)?$/.test(file)) { packageFiles.add(file); buildSystems.add('gradle') }
  if (file.endsWith('.java')) languages.add('java')
  if (/\.(kt|kts)$/.test(file)) languages.add('kotlin')

  if (/\.(csproj|sln)$/.test(file)) { packageFiles.add(file); buildSystems.add('dotnet'); languages.add('csharp') }
  if (file.endsWith('.cs')) languages.add('csharp')

  if (file === 'composer.json') { packageFiles.add(file); buildSystems.add('composer'); languages.add('php') }
  if (file === 'composer.lock') { lockFiles.add(file); buildSystems.add('composer') }
  if (file.endsWith('.php')) languages.add('php')

  if (file === 'Gemfile' || file.endsWith('.gemspec')) { packageFiles.add(file); buildSystems.add('bundler'); languages.add('ruby') }
  if (file === 'Gemfile.lock') { lockFiles.add(file); buildSystems.add('bundler') }
  if (file.endsWith('.rb')) languages.add('ruby')

  if (file === 'CMakeLists.txt') { packageFiles.add(file); buildSystems.add('cmake'); languages.add('cpp') }
  if (file === 'Makefile') { packageFiles.add(file); buildSystems.add('make') }
  if (/\.(c|cc|cpp|cxx|h|hpp)$/.test(file)) languages.add('cpp')

  if (file === 'pubspec.yaml') { packageFiles.add(file); buildSystems.add('flutter'); languages.add('dart') }
  if (file === 'pubspec.lock') { lockFiles.add(file); buildSystems.add('flutter') }
  if (file.endsWith('.dart')) languages.add('dart')

  if (file === 'Package.swift') { packageFiles.add(file); buildSystems.add('xcode'); languages.add('swift') }
  if (file.endsWith('.swift')) languages.add('swift')
}

function buildSuggestedVerificationCommands(buildSystems: EngineeringBuildSystem[], scripts: Record<string, string>, files: string[]): VerificationCommand[] {
  const commands: VerificationCommand[] = []
  const hasTests = files.some(isTestFile)

  if (buildSystems.some((system) => ['npm', 'pnpm', 'yarn'].includes(system))) {
    if (scripts.typecheck) commands.push(cmd('npm-typecheck', 'Frontend typecheck', 'npm run typecheck'))
    if (scripts.lint) commands.push(cmd('npm-lint', 'Frontend lint', 'npm run lint'))
    if (scripts.test || hasTests) commands.push(cmd('npm-test', 'Frontend tests', scripts.test ? 'npm test' : 'npm test'))
    if (scripts.build) commands.push(cmd('npm-build', 'Frontend build', 'npm run build'))
  }
  if (buildSystems.includes('cargo')) { commands.push(cmd('cargo-check', 'Rust cargo check', 'cargo check', 'src-tauri')); commands.push(cmd('cargo-test', 'Rust tests', 'cargo test', 'src-tauri')) }
  if (buildSystems.some((system) => ['poetry', 'pipenv', 'uv', 'pip'].includes(system))) commands.push(cmd('python-pytest', 'Python tests', 'python -m pytest'))
  if (buildSystems.includes('go')) commands.push(cmd('go-test', 'Go tests', 'go test ./...'))
  if (buildSystems.includes('maven')) commands.push(cmd('maven-test', 'Maven tests', 'mvn test'))
  if (buildSystems.includes('gradle')) commands.push(cmd('gradle-test', 'Gradle tests', './gradlew test'))
  if (buildSystems.includes('dotnet')) { commands.push(cmd('dotnet-build', '.NET build', 'dotnet build')); commands.push(cmd('dotnet-test', '.NET tests', 'dotnet test')) }
  if (buildSystems.includes('composer')) commands.push(cmd('composer-test', 'Composer tests', 'composer test'))
  if (buildSystems.includes('bundler')) commands.push(cmd('ruby-test', 'Ruby tests', 'bundle exec rake test'))
  if (buildSystems.includes('cmake')) commands.push(cmd('cmake-build', 'CMake build', 'cmake --build build'))
  if (buildSystems.includes('make')) commands.push(cmd('make-test', 'Make tests', 'make test'))
  if (buildSystems.includes('flutter')) { commands.push(cmd('flutter-analyze', 'Flutter analyze', 'flutter analyze')); commands.push(cmd('flutter-test', 'Flutter tests', 'flutter test')) }

  return dedupeCommands(commands)
}

function cmd(id: string, label: string, command: string, cwd?: string): VerificationCommand {
  return { id, label, command, cwd, risk: 'safe' }
}

function isTestFile(file: string): boolean {
  return /(^|\/)(tests|test|__tests__)\//.test(file) || /\.(test|spec)\.[tj]sx?$/.test(file) || /(^|\/)test_.*\.py$/.test(file) || /_test\.(py|go)$/.test(file) || /Test\.java$/.test(file)
}

function isEntryFile(file: string): boolean {
  return ['src/main.tsx', 'src/App.tsx', 'src/main.rs', 'src/lib.rs', 'src-tauri/src/main.rs', 'src-tauri/src/lib.rs', 'main.go', 'main.py', 'lib/main.dart', 'Package.swift'].includes(file)
}

function isConfigFile(file: string): boolean {
  return /(^|\/)(package\.json|tsconfig.*\.json|vite\.config\.ts|Cargo\.toml|pyproject\.toml|go\.mod|pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|composer\.json|pubspec\.yaml|CMakeLists\.txt|Makefile)$/.test(file) || /\.(csproj|sln|gemspec)$/.test(file)
}

function buildFingerprintSummary(languages: EngineeringLanguage[], buildSystems: EngineeringBuildSystem[], commands: VerificationCommand[]): string {
  return [`Languages: ${languages.length > 0 ? languages.join(', ') : 'unknown'}`, `Build systems: ${buildSystems.length > 0 ? buildSystems.join(', ') : 'unknown'}`, `Suggested verification commands: ${commands.length}`].join('\n')
}

function dedupeCommands(commands: VerificationCommand[]): VerificationCommand[] {
  const seen = new Set<string>()
  return commands.filter((command) => {
    const key = `${command.cwd || ''}:${command.command}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sortValues<T extends string>(values: Set<T>): T[] {
  return Array.from(values).sort()
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}
```

- [ ] **Step 2: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 2: Context and Repo Map Integration

**Files:**
- Modify: `src/ai-runtime/engineering/types.ts`
- Modify: `src/ai-runtime/engineering/context-builder.ts`
- Modify: `src/ai-runtime/engineering/repo-map.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Add fingerprint to project signals**

In `types.ts`, import `EngineeringProjectFingerprint` from `project-fingerprint` and add `fingerprint: EngineeringProjectFingerprint` to `EngineeringProjectSignals`.

- [ ] **Step 2: Build fingerprint in context builder**

In `context-builder.ts`, import `buildProjectFingerprint` and compute:

```ts
const fingerprint = buildProjectFingerprint({
  files: Array.from(candidateFiles),
  packageScripts: scripts,
})
```

Add `fingerprint` to `projectSignals`.

- [ ] **Step 3: Expand repo map kinds**

In `repo-map.ts`, extend `RepoMapFileKind` with `rust`, `python`, `go`, `java`, `kotlin`, `csharp`, `php`, `ruby`, `cpp`, `dart`, `swift`, and classify by extension/path before falling back to existing kinds.

- [ ] **Step 4: Export fingerprint module**

In `index.ts`, add:

```ts
export * from './project-fingerprint'
```

- [ ] **Step 5: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 3: Verification and Summary Integration

**Files:**
- Modify: `src/ai-runtime/engineering/verification-policy.ts`
- Modify: `src/ai-runtime/engineering/summary-builder.ts`

- [ ] **Step 1: Add fingerprint command merge helper**

In `verification-policy.ts`, export:

```ts
export function mergeVerificationCommands(commands: VerificationCommand[]): VerificationCommand[] {
  const seen = new Set<string>()
  return commands.filter((command) => {
    const key = `${command.cwd || ''}:${command.command}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
```

Use it from `selectVerificationCommands` instead of private dedupe.

- [ ] **Step 2: Add fingerprint to summary**

In `summary-builder.ts`, inside `if (summary.context)`, add:

```ts
const fingerprint = summary.context.projectSignals.fingerprint
lines.push(`- 语言：${fingerprint.languages.join(', ')}`)
lines.push(`- 构建系统：${fingerprint.buildSystems.join(', ')}`)
lines.push(`- 建议验证命令：${fingerprint.suggestedVerificationCommands.length} 个`)
```

- [ ] **Step 3: Final build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/ai-runtime/engineering docs/superpowers/plans/2026-05-28-project-fingerprint.md
git commit -m "feat: add project fingerprint detection"
```

Expected: commit succeeds.

---

## Self-Review

- Spec coverage: multi-language detection, build systems, package/lock/config/test/entry files, suggested verification commands, context integration, repo map classification, summary output, and export are covered.
- Placeholder scan: No placeholders are present.
- Type consistency: `EngineeringProjectFingerprint` is introduced before `EngineeringProjectSignals` references it.
