import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { ChatMessage } from '../../types'
import { extractMermaidBlocks } from '../../utils/markdown'
import './FloatingWindow.css'

marked.setOptions({
  breaks: true,
  gfm: true,
})

const DEFAULT_THEME = 'dark'

function resolveThemeFromStorage(): 'dark' | 'light' | null {
  try {
    const stored = localStorage.getItem('view-store')
    if (!stored) {
      return null
    }
    const parsed = JSON.parse(stored) as { state?: { theme?: string } }
    const theme = parsed?.state?.theme
    if (theme === 'light' || theme === 'dark') {
      return theme
    }
  } catch (error) {
    console.error('[FloatingWindow] 读取主题失败:', error)
  }
  return null
}

function applyTheme(theme: string): void {
  const nextTheme = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', nextTheme)
}

function formatContent(content: string): string {
  try {
    const raw = marked.parse(content) as string
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'div', 'mark'],
      ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
    })
  } catch {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
  }
}

interface FloatingWindowConfig {
  enabled: boolean
  mode: 'auto' | 'manual'
  expandOnHover: boolean
}

export function FloatingWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [input, setInput] = useState('')
  const [config, setConfig] = useState<FloatingWindowConfig>({
    enabled: true,
    mode: 'auto',
    expandOnHover: true,
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const loadConfig = () => {
      try {
        const stored = localStorage.getItem('app_config')
        if (stored) {
          const appConfig = JSON.parse(stored)
          if (appConfig.floatingWindow) {
            setConfig(appConfig.floatingWindow)
          }
        }
      } catch (error) {
        console.error('[FloatingWindow] 加载配置失败:', error)
      }
    }

    const loadTheme = () => {
      const theme = resolveThemeFromStorage()
      applyTheme(theme ?? DEFAULT_THEME)
    }

    const loadMessages = () => {
      try {
        const stored = localStorage.getItem('chat_messages_sync')
        const streaming = localStorage.getItem('chat_is_streaming')
        if (stored) {
          setMessages(JSON.parse(stored))
        }
        if (streaming) {
          setIsStreaming(JSON.parse(streaming))
        }
      } catch (error) {
        console.error('[FloatingWindow] 加载消息失败:', error)
      }
    }

    loadConfig()
    loadTheme()
    loadMessages()

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'chat_messages_sync' && event.newValue) {
        setMessages(JSON.parse(event.newValue))
      }
      if (event.key === 'chat_is_streaming' && event.newValue) {
        setIsStreaming(JSON.parse(event.newValue))
      }
      if (event.key === 'app_config' && event.newValue) {
        const appConfig = JSON.parse(event.newValue)
        if (appConfig.floatingWindow) {
          setConfig(appConfig.floatingWindow)
        }
      }
      if (event.key === 'view-store' && event.newValue) {
        const theme = resolveThemeFromStorage()
        applyTheme(theme ?? DEFAULT_THEME)
      }
    }

    window.addEventListener('storage', handleStorage)

    const unlistenStreaming = listen<{ isStreaming: boolean }>('chat:streaming_changed', (event) => {
      setIsStreaming(event.payload.isStreaming)
    })

    const unlistenConfig = listen<{ config: { floatingWindow?: FloatingWindowConfig } }>('config:updated', (event) => {
      if (event.payload.config.floatingWindow) {
        setConfig(event.payload.config.floatingWindow)
      }
    })

    return () => {
      window.removeEventListener('storage', handleStorage)
      unlistenStreaming.then((fn) => fn())
      unlistenConfig.then((fn) => fn())
    }
  }, [])

  const handleExpand = useCallback(async () => {
    try {
      await invoke('show_main_window')
    } catch (error) {
      console.error('[FloatingWindow] 展开主窗口失败:', error)
    }
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (!config.enabled || !config.expandOnHover || config.mode !== 'auto') {
      return
    }

    hoverTimerRef.current = setTimeout(() => {
      void handleExpand()
    }, 200)
  }, [config.enabled, config.expandOnHover, config.mode, handleExpand])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const handleSend = async () => {
    const message = input.trim()
    if (!message || isStreaming) {
      return
    }

    try {
      await invoke('emit_event_to_main_window', {
        event: 'floating:send_message',
        payload: { message },
      })
      setInput('')
    } catch (error) {
      console.error('[FloatingWindow] 发送消息失败:', error)
    }
  }

  const handleInterrupt = async () => {
    try {
      await invoke('emit_event_to_main_window', {
        event: 'floating:interrupt_chat',
        payload: {},
      })
    } catch (error) {
      console.error('[FloatingWindow] 中断失败:', error)
    }
  }

  const TextBlockRenderer = useMemo(() => {
    return function TextBlockRenderer({ content }: { content: string }) {
      const { cleanedMarkdown, mermaidBlocks } = extractMermaidBlocks(content)

      const formattedContent = useMemo(() => formatContent(cleanedMarkdown), [cleanedMarkdown])
      const hasMermaid = mermaidBlocks.length > 0

      return (
        <div className="prose prose-invert prose-sm max-w-none">
          {formattedContent && <div dangerouslySetInnerHTML={{ __html: formattedContent }} />}
          {hasMermaid && (
            <div className="my-3 rounded border border-border-subtle bg-background-surface p-3 text-xs">
              <div className="flex items-center gap-2 text-text-tertiary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>包含 {mermaidBlocks.length} 个图表，请在主窗口查看</span>
              </div>
            </div>
          )}
        </div>
      )
    }
  }, [])

  return (
    <div className="floating-window" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="floating-header" data-tauri-drag-region>
        <div className="floating-title">
          <img className="floating-title-logo" src="/qnai.png" alt="QnAI Studio" />
          <span>QnAI Studio</span>
        </div>
        <button className="floating-expand-btn" onClick={handleExpand} title="展开主窗口">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>

      <div className="floating-messages">
        {messages.length === 0 ? (
          <div className="floating-empty">
            <span>开始对话吧</span>
          </div>
        ) : (
          <div className="floating-messages-content">
            {messages.map((msg) => (
              <div key={msg.id} className={`floating-message-${msg.type}`}>
                {msg.type === 'user' ? (
                  <div className="floating-user-message">
                    <span className="floating-message-sender">用户</span>
                    <span className="floating-message-content">{msg.content}</span>
                  </div>
                ) : msg.type === 'assistant' && 'blocks' in msg ? (
                  <div className="floating-assistant-message">
                    <span className="floating-message-sender">QnAI</span>
                    <div className="floating-message-content">
                      {msg.blocks.map((block, idx) => {
                        if (block.type === 'text') {
                          return <TextBlockRenderer key={idx} content={block.content} />
                        }
                        return null
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="floating-system-message">
                    <span className="floating-message-content">{'content' in msg ? msg.content : ''}</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="floating-input-area">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleSend()
            }
          }}
          placeholder="输入消息..."
          className="floating-input"
        />
        {isStreaming ? (
          <button className="floating-send-btn" onClick={handleInterrupt} title="停止生成">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button className="floating-send-btn" onClick={() => void handleSend()} title="发送">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
