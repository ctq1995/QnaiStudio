/**
 * InMemoryMemoryStore - 内存记忆存储实现
 *
 * 提供基于内存的 MemoryStore 实现，适用于：
 * - 开发和测试环境
 * - 短期会话记忆
 * - 不需要持久化的场景
 */

import type {
  MemoryStore,
  MemoryStorageConfig,
  MemoryEntry,
  MemoryQuery,
  MemorySearchResult,
  MemoryStats,
  MemoryType,
} from './memory'

let idCounter = 0

function generateId(): string {
  idCounter += 1
  return `mem-${Date.now()}-${idCounter.toString(36).padStart(4, '0')}`
}

export class InMemoryMemoryStore implements MemoryStore {
  readonly config: MemoryStorageConfig
  private entries = new Map<string, MemoryEntry>()

  constructor(config?: Partial<MemoryStorageConfig>) {
    this.config = {
      backend: 'memory',
      maxShortTermEntries: 1000,
      maxLongTermEntries: 10000,
      ...config,
    }
  }

  async store(
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>
  ): Promise<MemoryEntry> {
    const now = Date.now()
    const fullEntry: MemoryEntry = {
      id: generateId(),
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      ...entry,
    }

    this.entries.set(fullEntry.id, fullEntry)
    return fullEntry
  }

  async storeBatch(
    entries: Array<Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>>
  ): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = []
    for (const entry of entries) {
      const stored = await this.store(entry)
      results.push(stored)
    }
    return results
  }

  async retrieve(query: MemoryQuery): Promise<MemorySearchResult> {
    const startTime = Date.now()
    const candidates: MemoryEntry[] = []

    for (const entry of this.entries.values()) {
      if (!query.includeArchived && entry.archived) {
        continue
      }

      if (query.types && query.types.length > 0) {
        if (!query.types.includes(entry.type)) {
          continue
        }
      }

      if (query.timeRange) {
        if (query.timeRange.start && entry.createdAt < query.timeRange.start) {
          continue
        }
        if (query.timeRange.end && entry.createdAt > query.timeRange.end) {
          continue
        }
      }

      if (query.tags && query.tags.length > 0) {
        const entryTags = entry.metadata.tags || []
        if (!query.tags.some((tag) => entryTags.includes(tag))) {
          continue
        }
      }

      if (query.sources && query.sources.length > 0) {
        if (!query.sources.includes(entry.metadata.source)) {
          continue
        }
      }

      if (query.projectId && entry.metadata.projectId !== query.projectId) {
        continue
      }

      if (query.sessionId && entry.metadata.sessionId !== query.sessionId) {
        continue
      }

      if (query.minImportance !== undefined && entry.importance < query.minImportance) {
        continue
      }

      candidates.push(entry)
    }

    const queryText = query.query.toLowerCase()
    let scored = candidates.map((entry) => {
      let score = 0
      const content = entry.content.toLowerCase()
      const index = content.indexOf(queryText)
      if (index !== -1) {
        score = 1 / (index + 1)
      }
      score += entry.importance * 0.1
      score += entry.accessCount * 0.01

      return { entry, score }
    })

    scored.sort((a, b) => b.score - a.score)

    const offset = query.offset || 0
    const limit = query.limit || 50
    const paginated = scored.slice(offset, offset + limit)

    return {
      entries: paginated.map((item) => item.entry),
      total: scored.length,
      hasMore: offset + limit < scored.length,
      duration: Date.now() - startTime,
    }
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const entry = this.entries.get(id)
    if (!entry) {
      return null
    }

    entry.lastAccessedAt = Date.now()
    entry.accessCount += 1
    return entry
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    const entry = this.entries.get(id)
    if (!entry) {
      return null
    }

    const updated: MemoryEntry = {
      ...entry,
      ...updates,
      id: entry.id,
      createdAt: entry.createdAt,
    }

    this.entries.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id)
  }

  async archive(id: string): Promise<boolean> {
    const entry = this.entries.get(id)
    if (!entry) {
      return false
    }

    entry.archived = true
    return true
  }

  async cleanup(): Promise<number> {
    const now = Date.now()
    const toDelete: string[] = []

    for (const entry of this.entries.values()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        toDelete.push(entry.id)
      }
    }

    for (const id of toDelete) {
      this.entries.delete(id)
    }

    return toDelete.length
  }

  async getStats(): Promise<MemoryStats> {
    const byType: Record<MemoryType, number> = {
      short_term: 0,
      long_term: 0,
      episodic: 0,
      semantic: 0,
      procedural: 0,
    }

    let totalSize = 0
    let oldestEntry: number | undefined
    let newestEntry: number | undefined
    let totalImportance = 0
    let archivedCount = 0

    for (const entry of this.entries.values()) {
      byType[entry.type] += 1
      totalSize += entry.content.length
      totalImportance += entry.importance
      if (entry.archived) {
        archivedCount += 1
      }
      if (oldestEntry === undefined || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt
      }
      if (newestEntry === undefined || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt
      }
    }

    const count = this.entries.size

    return {
      totalEntries: count,
      byType,
      totalSize,
      oldestEntry,
      newestEntry,
      averageImportance: count > 0 ? totalImportance / count : 0,
      archivedCount,
    }
  }
}

let globalInMemoryStore: InMemoryMemoryStore | null = null

export function getInMemoryMemoryStore(
  config?: Partial<MemoryStorageConfig>
): InMemoryMemoryStore {
  if (!globalInMemoryStore) {
    globalInMemoryStore = new InMemoryMemoryStore(config)
  }
  return globalInMemoryStore
}
