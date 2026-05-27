/**
 * 记忆系统 - 核心类型定义
 *
 * 定义了 Agent 记忆系统的接口和数据结构。
 * 支持短期记忆、长期记忆和项目上下文。
 */

/**
 * 记忆类型
 */
export type MemoryType =
  | 'short_term'    // 短期记忆 - 当前会话
  | 'long_term'     // 长期记忆 - 持久化存储
  | 'episodic'      // 情景记忆 - 事件序列
  | 'semantic'      // 语义记忆 - 知识图谱
  | 'procedural'    // 程序记忆 - 技能和流程

/**
 * 记忆条目
 */
export interface MemoryEntry {
  /** 唯一标识 */
  id: string
  /** 记忆类型 */
  type: MemoryType
  /** 内容 */
  content: string
  /** 向量嵌入（用于语义检索） */
  embedding?: number[]
  /** 元数据 */
  metadata: MemoryMetadata
  /** 创建时间 */
  createdAt: number
  /** 最后访问时间 */
  lastAccessedAt: number
  /** 访问次数 */
  accessCount: number
  /** 重要性分数（0-1） */
  importance: number
  /** 是否已归档 */
  archived: boolean
  /** 过期时间（可选） */
  expiresAt?: number
}

/**
 * 记忆元数据
 */
export interface MemoryMetadata {
  /** 来源 */
  source: 'user' | 'assistant' | 'system' | 'tool' | 'external'
  /** 关联的会话 ID */
  sessionId?: string
  /** 关联的任务 ID */
  taskId?: string
  /** 关联的角色 ID */
  roleId?: string
  /** 关联的文件路径 */
  filePaths?: string[]
  /** 标签 */
  tags?: string[]
  /** 实体引用 */
  entities?: string[]
  /** 项目 ID */
  projectId?: string
  /** 自定义字段 */
  custom?: Record<string, unknown>
}

/**
 * 记忆查询条件
 */
export interface MemoryQuery {
  /** 查询文本 */
  query: string
  /** 记忆类型过滤 */
  types?: MemoryType[]
  /** 时间范围 */
  timeRange?: {
    start?: number
    end?: number
  }
  /** 标签过滤 */
  tags?: string[]
  /** 来源过滤 */
  sources?: MemoryMetadata['source'][]
  /** 项目过滤 */
  projectId?: string
  /** 会话过滤 */
  sessionId?: string
  /** 最小重要性 */
  minImportance?: number
  /** 最大结果数 */
  limit?: number
  /** 偏移量 */
  offset?: number
  /** 是否包含归档 */
  includeArchived?: boolean
  /** 相似度阈值（语义搜索时） */
  similarityThreshold?: number
}

/**
 * 记忆检索结果
 */
export interface MemorySearchResult {
  /** 匹配的记忆条目 */
  entries: MemoryEntry[]
  /** 总数 */
  total: number
  /** 是否有更多 */
  hasMore: boolean
  /** 查询耗时（毫秒） */
  duration: number
  /** 相似度分数（语义搜索时） */
  similarityScores?: Map<string, number>
}

/**
 * 记忆存储配置
 */
export interface MemoryStorageConfig {
  /** 存储类型 */
  backend: 'memory' | 'file' | 'sqlite' | 'vector-db'
  /** 存储路径 */
  storagePath?: string
  /** 最大短期记忆条目数 */
  maxShortTermEntries: number
  /** 最大长期记忆条目数 */
  maxLongTermEntries: number
  /** 嵌入模型 */
  embeddingModel?: string
  /** 嵌入维度 */
  embeddingDimensions?: number
  /** 自动过期时间（毫秒） */
  defaultExpiration?: number
  /** 自动归档阈值（天数） */
  autoArchiveDays?: number
}

/**
 * 项目上下文
 */
export interface ProjectMemoryContext {
  /** 项目 ID */
  projectId: string
  /** 项目名称 */
  projectName: string
  /** 项目路径 */
  projectPath: string
  /** 项目类型 */
  projectType: string
  /** 主要语言 */
  primaryLanguage?: string
  /** 框架 */
  frameworks?: string[]
  /** 关键文件 */
  keyFiles?: string[]
  /** 最近编辑的文件 */
  recentFiles?: string[]
  /** 项目摘要 */
  summary?: string
  /** 项目知识 */
  knowledge: ProjectKnowledge
  /** 最后更新时间 */
  updatedAt: number
}

/**
 * 项目知识
 */
export interface ProjectKnowledge {
  /** 架构决策记录 */
  architecturalDecisions: ArchitecturalDecision[]
  /** 代码模式 */
  codePatterns: CodePattern[]
  /** 常见问题解决方案 */
  commonSolutions: CommonSolution[]
  /** 项目约定 */
  conventions: ProjectConvention[]
  /** 依赖关系 */
  dependencies: DependencyInfo[]
}

/**
 * 架构决策记录
 */
export interface ArchitecturalDecision {
  /** ID */
  id: string
  /** 标题 */
  title: string
  /** 状态 */
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded'
  /** 上下文 */
  context: string
  /** 决策 */
  decision: string
  /** 后果 */
  consequences: string
  /** 创建时间 */
  createdAt: number
  /** 相关文件 */
  relatedFiles?: string[]
}

/**
 * 代码模式
 */
export interface CodePattern {
  /** ID */
  id: string
  /** 模式名称 */
  name: string
  /** 描述 */
  description: string
  /** 示例代码 */
  example?: string
  /** 适用场景 */
  applicableScenarios: string[]
  /** 标签 */
  tags: string[]
  /** 使用次数 */
  usageCount: number
}

/**
 * 常见解决方案
 */
export interface CommonSolution {
  /** ID */
  id: string
  /** 问题描述 */
  problem: string
  /** 解决方案 */
  solution: string
  /** 代码示例 */
  codeExample?: string
  /** 相关文件 */
  relatedFiles?: string[]
  /** 标签 */
  tags: string[]
  /** 成功率 */
  successRate: number
}

/**
 * 项目约定
 */
export interface ProjectConvention {
  /** ID */
  id: string
  /** 约定类型 */
  type: 'naming' | 'structure' | 'style' | 'process' | 'other'
  /** 名称 */
  name: string
  /** 描述 */
  description: string
  /** 示例 */
  examples?: string[]
  /** 是否强制 */
  mandatory: boolean
}

/**
 * 依赖信息
 */
export interface DependencyInfo {
  /** 依赖名称 */
  name: string
  /** 版本 */
  version: string
  /** 类型 */
  type: 'production' | 'development' | 'peer' | 'optional'
  /** 描述 */
  description?: string
  /** 主页 */
  homepage?: string
  /** 仓库 */
  repository?: string
}

/**
 * 记忆存储接口
 */
export interface MemoryStore {
  /** 存储配置 */
  readonly config: MemoryStorageConfig
  /**
   * 存储记忆
   * @param entry 记忆条目
   */
  store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>): Promise<MemoryEntry>
  /**
   * 批量存储
   * @param entries 记忆条目列表
   */
  storeBatch(entries: Array<Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>>): Promise<MemoryEntry[]>
  /**
   * 检索记忆
   * @param query 查询条件
   */
  retrieve(query: MemoryQuery): Promise<MemorySearchResult>
  /**
   * 获取单个记忆
   * @param id 记忆 ID
   */
  get(id: string): Promise<MemoryEntry | null>
  /**
   * 更新记忆
   * @param id 记忆 ID
   * @param updates 更新内容
   */
  update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null>
  /**
   * 删除记忆
   * @param id 记忆 ID
   */
  delete(id: string): Promise<boolean>
  /**
   * 归档记忆
   * @param id 记忆 ID
   */
  archive(id: string): Promise<boolean>
  /**
   * 清理过期记忆
   */
  cleanup(): Promise<number>
  /**
   * 获取统计信息
   */
  getStats(): Promise<MemoryStats>
}

/**
 * 记忆统计信息
 */
export interface MemoryStats {
  /** 总条目数 */
  totalEntries: number
  /** 按类型统计 */
  byType: Record<MemoryType, number>
  /** 总存储大小（字节） */
  totalSize: number
  /** 最旧条目时间 */
  oldestEntry?: number
  /** 最新条目时间 */
  newestEntry?: number
  /** 平均重要性 */
  averageImportance: number
  /** 归档条目数 */
  archivedCount: number
}

/**
 * 会话记忆
 */
export interface SessionMemory {
  /** 会话 ID */
  sessionId: string
  /** 会话开始时间 */
  startedAt: number
  /** 对话历史 */
  conversationHistory: ConversationTurn[]
  /** 提及的文件 */
  mentionedFiles: string[]
  /** 提及的实体 */
  mentionedEntities: string[]
  /** 执行的工具 */
  executedTools: string[]
  /** 关键决策 */
  keyDecisions: string[]
  /** 会话摘要 */
  summary?: string
}

/**
 * 对话轮次
 */
export interface ConversationTurn {
  /** 轮次 ID */
  id: string
  /** 角色 */
  role: 'user' | 'assistant' | 'system'
  /** 内容 */
  content: string
  /** 时间戳 */
  timestamp: number
  /** 关联的工具调用 */
  toolCalls?: string[]
  /** 关联的文件 */
  files?: string[]
  /** token 数量 */
  tokenCount?: number
}

/**
 * 创建记忆条目的辅助函数
 */
export function createMemoryEntry(
  partial: Partial<MemoryEntry> & { type: MemoryType; content: string }
): Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'> {
  return {
    metadata: { source: 'system' },
    importance: 0.5,
    archived: false,
    ...partial,
  }
}

/**
 * 创建会话记忆的辅助函数
 */
export function createSessionMemory(sessionId: string): SessionMemory {
  return {
    sessionId,
    startedAt: Date.now(),
    conversationHistory: [],
    mentionedFiles: [],
    mentionedEntities: [],
    executedTools: [],
    keyDecisions: [],
  }
}

/**
 * 默认记忆存储配置
 */
export const DEFAULT_MEMORY_CONFIG: MemoryStorageConfig = {
  backend: 'memory',
  maxShortTermEntries: 1000,
  maxLongTermEntries: 10000,
  defaultExpiration: 30 * 24 * 60 * 60 * 1000, // 30 天
  autoArchiveDays: 7,
}
