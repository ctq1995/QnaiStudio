# Project Fingerprint Design

## 背景

QnaiStudio 的工程 Agent 能力已包含执行闭环、权限、审计、上下文预算、Repo Map。但当前项目识别仍偏 TS/Tauri，无法充分覆盖 Python、Go、Java、.NET、PHP、Ruby、C/C++、Dart、Swift 等通用工程。

本设计新增路径级 Project Fingerprint，多语言识别只基于文件路径和已知 scripts，不读取配置内容、不执行命令。

## 目标

1. 识别项目语言、构建系统、包文件、锁文件、入口文件、测试文件、配置文件。
2. 为多语言项目生成建议验证命令。
3. 将 fingerprint 接入 EngineeringContext。
4. 扩展 Repo Map 文件分类。
5. 扩展 Summary 输出。

## 非目标

- 不执行验证命令。
- 不安装依赖。
- 不解析 AST。
- 不读取 pyproject、pom、gradle 等文件内容。
- 不接入 LSP。
- 不修改 UI。

## 新增模块

```text
src/ai-runtime/engineering/project-fingerprint.ts
```

## 支持语言

```text
typescript
javascript
rust
python
go
java
kotlin
csharp
php
ruby
cpp
dart
swift
unknown
```

## 支持构建系统

```text
npm
pnpm
yarn
cargo
poetry
pipenv
uv
pip
go
maven
gradle
dotnet
composer
bundler
cmake
make
flutter
xcode
unknown
```

## 识别规则

根据路径识别：

- `package.json`、`tsconfig.json`、`*.ts`、`*.tsx` -> TypeScript / Node。
- `Cargo.toml`、`*.rs` -> Rust / Cargo。
- `pyproject.toml`、`requirements.txt`、`Pipfile`、`*.py` -> Python。
- `go.mod`、`*.go` -> Go。
- `pom.xml` -> Maven。
- `build.gradle`、`build.gradle.kts` -> Gradle。
- `*.java` -> Java。
- `*.kt`、`*.kts` -> Kotlin。
- `*.csproj`、`*.sln`、`*.cs` -> .NET / C#。
- `composer.json`、`*.php` -> PHP。
- `Gemfile`、`*.rb` -> Ruby。
- `CMakeLists.txt`、`Makefile`、`*.cpp`、`*.cc`、`*.c`、`*.hpp`、`*.h` -> C/C++。
- `pubspec.yaml`、`*.dart` -> Dart / Flutter。
- `Package.swift`、`*.swift` -> Swift / Xcode。

## 输出类型

```ts
interface EngineeringProjectFingerprint {
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
```

## 集成点

- `types.ts`：`EngineeringProjectSignals` 增加 `fingerprint`。
- `context-builder.ts`：基于 candidate files 和 package scripts 创建 fingerprint。
- `repo-map.ts`：扩展文件 kind。
- `verification-policy.ts`：导出 fingerprint 建议命令选择能力，保持原函数兼容。
- `summary-builder.ts`：输出语言和构建系统。
- `index.ts`：导出 project-fingerprint。

## 成功标准

1. 新模块可独立使用。
2. EngineeringContext 包含多语言 fingerprint。
3. Summary 显示识别语言、构建系统、建议验证命令数。
4. Repo Map 支持多语言分类。
5. `npm run build` 通过。
