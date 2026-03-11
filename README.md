# QnAI Studio

> 多引擎 CLI 智能编程工作台

## 简介

QnAI Studio 是基于 Polaris 二次开发的桌面端 AI 编程工作台，支持 Claude Code / Codex CLI / Gemini CLI / IFlow 等多引擎，提供统一的对话、文件浏览与代码编辑体验。

## 功能亮点

- 多引擎对话与快速切换
- 会话历史与工具调用可视化
- 文件浏览与工作区管理
- 内置代码编辑器（CodeMirror 6）
- 悬浮窗模式与界面主题切换

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |
| 代码编辑 | CodeMirror 6 |
| 桌面框架 | Tauri 2.x (Rust) |

## 环境要求

- Node.js >= 18
- Rust >= 1.70
- 相关引擎 CLI（按需配置）

## 开发与运行

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建

```bash
# 构建前端
npm run build

# 构建 Tauri 应用
npm run tauri build
```

### 其他脚本

```bash
npm run dev          # 仅启动前端开发服务器
npm run preview      # 预览生产构建
```

## 鸣谢

- 原项目 Polaris：https://github.com/misxzaiz/Polaris

## 许可

MIT

---

> 说明：本项目为社区二次开发版本，非官方客户端。
