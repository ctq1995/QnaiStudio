/**
 * 鑱婂ぉ杈撳叆缁勪欢 - 鏀寔鏂滄潬鍛戒护銆佸伐浣滃尯寮曠敤銆佹枃浠跺紩鐢ㄥ拰 Git 涓婁笅鏂?
 *
 * 鏀寔鐨勮娉曪細
 * - /command          鏂滄潬鍛戒护
 * - @workspace/path   寮曠敤鎸囧畾宸ヤ綔鍖虹殑鏂囦欢
 * - @/path            寮曠敤褰撳墠宸ヤ綔鍖虹殑鏂囦欢
 * - @git              Git 涓婁笅鏂囷紙diff, commit, log 绛夛級
 *
 * 鏂板鍔熻兘锛?
 * - 涓婁笅鏂囪姱鐗囧彲瑙嗗寲鏄剧ず
 * - Git 鎻愪氦閫夋嫨
 * - 绌洪棿浼樺寲鐨勭揣鍑戝竷灞€
 */

import { useState, useRef, KeyboardEvent, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../Common';
import { IconSend, IconStop } from '../Common/Icons';
import { useCommandStore, useWorkspaceStore } from '../../stores';
import { parseCommandInput, generateCommandsListMessage, generateHelpMessage } from '../../services/commandService';
import { FileSuggestion, CommandSuggestion, WorkspaceSuggestion } from './FileSuggestion';
import { GitSuggestion, getGitRootSuggestions, commitsToSuggestionItems, type GitSuggestionItem } from './GitSuggestion';
import { ContextChips } from './ContextChips';
import type { FileMatch } from '../../services/fileSearch';
import type { Workspace } from '../../types';
import type { ContextChipWithId } from '../../types/context';
import { addChipId } from '../../types/context';
import { AutoResizingTextarea } from './AutoResizingTextarea';
import { useFileSearch } from '../../hooks/useFileSearch';
import { getGitCommits } from '../../services/gitContextService';
import { getAccessibleWorkspacesByScope } from '../../utils/workspaceScope';

interface ChatInputProps {
  onSend: (message: string, workspaceDir?: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onInterrupt?: () => void;
  currentWorkDir?: string | null;
}

type SuggestionMode = 'command' | 'workspace' | 'file' | 'git' | null;

export function ChatInput({
  onSend,
  disabled = false,
  isStreaming = false,
  onInterrupt,
  currentWorkDir,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 涓婁笅鏂囪姱鐗囩姸鎬?
  const [contextChips, setContextChips] = useState<ContextChipWithId[]>([]);

  // 鍛戒护寤鸿鐘舵€?
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [commandPosition, setCommandPosition] = useState({ top: 0, left: 0 });

  // 宸ヤ綔鍖哄缓璁姸鎬?
  const [showWorkspaceSuggestions, setShowWorkspaceSuggestions] = useState(false);
  const [selectedWorkspaceIndex, setSelectedWorkspaceIndex] = useState(0);
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const [workspacePosition, setWorkspacePosition] = useState({ top: 0, left: 0 });

  // 鏂囦欢寤鸿鐘舵€?
  const [showFileSuggestions, setShowFileSuggestions] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [filePosition, setFilePosition] = useState({ top: 0, left: 0 });
  const [fileWorkspace, setFileWorkspace] = useState<Workspace | null>(null);

  // Git 寤鸿鐘舵€?
  const [showGitSuggestions, setShowGitSuggestions] = useState(false);
  const [gitMode, setGitMode] = useState<'root' | 'commit'>('root');
  const [gitQuery, setGitQuery] = useState('');
  const [selectedGitIndex, setSelectedGitIndex] = useState(0);
  const [gitPosition, setGitPosition] = useState({ top: 0, left: 0 });
  const [gitCommits, setGitCommits] = useState<Array<{ hash: string; shortHash: string; message: string; author: string; timestamp: number }>>([]);
  const [isGitLoading, setIsGitLoading] = useState(false);

  const { getCommands, searchCommands } = useCommandStore();
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const contextWorkspaceIds = useWorkspaceStore((state) => state.contextWorkspaceIds);
  const accessibleWorkspaces = useMemo(
    () => getAccessibleWorkspacesByScope(workspaces, currentWorkspaceId, contextWorkspaceIds),
    [contextWorkspaceIds, currentWorkspaceId, workspaces],
  );
  const { fileMatches, searchFiles, clearResults } = useFileSearch();

  // 缂撳瓨鍛戒护鎼滅储缁撴灉
  const suggestedCommands = useMemo(
    () => searchCommands(commandQuery),
    [commandQuery, searchCommands]
  );

  // 杩囨护宸ヤ綔鍖哄垪琛?
  const filteredWorkspaces = useMemo(
    () => accessibleWorkspaces.filter(w =>
      w.name.toLowerCase().includes(workspaceQuery.toLowerCase())
    ),
    [accessibleWorkspaces, workspaceQuery]
  );

  // Git 寤鸿椤?
  const gitSuggestions = useMemo(() => {
    if (gitMode === 'root') {
      return getGitRootSuggestions();
    }
    if (gitMode === 'commit' && gitQuery) {
      return commitsToSuggestionItems(gitCommits);
    }
    return gitCommits.length > 0 ? commitsToSuggestionItems(gitCommits) : [];
  }, [gitMode, gitQuery, gitCommits]);

  // 褰撳墠寤鸿妯″紡
  const suggestionMode: SuggestionMode = useMemo(() => {
    if (showCommandSuggestions) return 'command';
    if (showWorkspaceSuggestions) return 'workspace';
    if (showFileSuggestions) return 'file';
    if (showGitSuggestions) return 'git';
    return null;
  }, [showCommandSuggestions, showWorkspaceSuggestions, showFileSuggestions, showGitSuggestions]);

  // 鏅鸿兘瀹氫綅寤鸿妗?
  const calculateSuggestionPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 0, left: 0, shouldShowAbove: false };

    const rect = textarea.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const suggestionHeight = 260;
    const shouldShowAbove = spaceBelow < suggestionHeight;

    return {
      top: shouldShowAbove ? rect.top - suggestionHeight - 8 : rect.bottom + 8,
      left: rect.left,
      shouldShowAbove,
    };
  }, []);

  // 妫€娴嬭Е鍙戠
  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    const textarea = textareaRef.current;
    if (!textarea || !containerRef.current) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPosition);

    // 1. 妫€娴?Git 涓婁笅鏂囧紩鐢?(@git)
    const gitMatch = textBeforeCursor.match(/@git(?::(\w*))?(?:\s([^\s]*))?$/);
    if (gitMatch) {
      const gitAction = gitMatch[1] || '';
      const query = gitMatch[2] || '';

      setShowGitSuggestions(true);
      setShowCommandSuggestions(false);
      setShowWorkspaceSuggestions(false);
      setShowFileSuggestions(false);
      clearResults();

      if (gitAction === 'commit' || (!gitAction && query)) {
        setGitMode('commit');
        setGitQuery(query);
        setSelectedGitIndex(0);

        // 鍔犺浇鎻愪氦鍒楄〃锛堝鏋滆繕娌″姞杞芥垨鏌ヨ鍙樺寲锛?
        if (currentWorkDir && gitCommits.length === 0) {
          setIsGitLoading(true);
          try {
            const commits = await getGitCommits(currentWorkDir, { limit: 50 });
            setGitCommits(commits);
          } finally {
            setIsGitLoading(false);
          }
        }
      } else {
        setGitMode('root');
        setGitQuery('');
        setSelectedGitIndex(0);
      }

      const position = calculateSuggestionPosition();
      setGitPosition({ top: position.top, left: position.left });
      return;
    }

    // 2. 妫€娴嬭法宸ヤ綔鍖哄紩鐢?(@workspace:path)
    const workspaceMatch = textBeforeCursor.match(/@([\w\u4e00-\u9fa5-]+):([^\s]*)$/);
    if (workspaceMatch) {
      const workspaceName = workspaceMatch[1];
      const pathPart = workspaceMatch[2] || '';

      const matchedWorkspace = accessibleWorkspaces.find((workspace) =>
        workspace.name.toLowerCase() === workspaceName.toLowerCase()
      );

      if (matchedWorkspace) {
        setShowWorkspaceSuggestions(false);
        setShowFileSuggestions(true);
        setShowCommandSuggestions(false);
        setShowGitSuggestions(false);
        setFileWorkspace(matchedWorkspace);
        setSelectedFileIndex(0);
        searchFiles(pathPart, matchedWorkspace);
      } else {
        setShowWorkspaceSuggestions(true);
        setShowFileSuggestions(false);
        setShowCommandSuggestions(false);
        setShowGitSuggestions(false);
        setWorkspaceQuery(workspaceName);
        setSelectedWorkspaceIndex(0);
      }

      const position = calculateSuggestionPosition();
      setWorkspacePosition({ top: position.top, left: position.left });
      return;
    }

    // 3. 妫€娴嬬敤鎴锋鍦ㄨ緭鍏ュ伐浣滃尯鍚?
    const partialWorkspaceMatch = textBeforeCursor.match(/@([\w\u4e00-\u9fa5-]*)$/);
    if (partialWorkspaceMatch) {
      const workspaceName = partialWorkspaceMatch[1];
      if (workspaceName.length > 0 && workspaceName !== 'git') {
        setShowWorkspaceSuggestions(true);
        setShowFileSuggestions(false);
        setShowCommandSuggestions(false);
        setShowGitSuggestions(false);
        setWorkspaceQuery(workspaceName);
        setSelectedWorkspaceIndex(0);

        const position = calculateSuggestionPosition();
        setWorkspacePosition({ top: position.top, left: position.left });
        return;
      }
    }

    // 4. 妫€娴嬪綋鍓嶅伐浣滃尯鏂囦欢寮曠敤 (@/path)
    const fileMatch = textBeforeCursor.match(/@\/(.*)$/);
    if (fileMatch) {
      setShowWorkspaceSuggestions(false);
      setShowFileSuggestions(true);
      setShowCommandSuggestions(false);
      setShowGitSuggestions(false);
      setFileWorkspace(null);
      setSelectedFileIndex(0);
      searchFiles(fileMatch[1]);

      const position = calculateSuggestionPosition();
      setFilePosition({ top: position.top, left: position.left });
      return;
    }

    // 5. 妫€娴嬪懡浠よЕ鍙?(/)
    const commandMatch = textBeforeCursor.match(/\/([^\s]*)$/);
    if (commandMatch) {
      setCommandQuery(commandMatch[1]);
      setSelectedCommandIndex(0);
      setShowCommandSuggestions(true);
      setShowWorkspaceSuggestions(false);
      setShowFileSuggestions(false);
      setShowGitSuggestions(false);

      const position = calculateSuggestionPosition();
      setCommandPosition({ top: position.top, left: position.left });
      return;
    }

    // 闅愯棌鎵€鏈夊缓璁?
    setShowCommandSuggestions(false);
    setShowWorkspaceSuggestions(false);
    setShowFileSuggestions(false);
    setShowGitSuggestions(false);
    clearResults();
  }, [accessibleWorkspaces, searchFiles, clearResults, calculateSuggestionPosition, gitCommits, currentWorkDir]);

  // 閫夋嫨鍛戒护
  const selectCommand = useCallback((name: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);

    const newText = textBeforeCursor.replace(/\/[^\s]*$/, `/${name} `) + textAfterCursor;
    setValue(newText);
    setShowCommandSuggestions(false);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newText.length - textAfterCursor.length, newText.length - textAfterCursor.length);
    }, 0);
  }, [value]);

  // 閫夋嫨宸ヤ綔鍖?
  const selectWorkspace = useCallback((workspace: Workspace) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);

    const newText = textBeforeCursor.replace(/@[\w\u4e00-\u9fa5-]*$/, `@${workspace.name}:`) + textAfterCursor;
    setValue(newText);
    setShowWorkspaceSuggestions(false);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = newText.length - textAfterCursor.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);
    }, 0);
  }, [value]);

  // 閫夋嫨鏂囦欢
  const selectFile = useCallback((file: FileMatch) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);

    let replacement: string;
    if (fileWorkspace) {
      replacement = textBeforeCursor.replace(/@[\w\u4e00-\u9fa5-]+:[^\s]*$/, `@${fileWorkspace.name}:${file.relativePath} `);
    } else {
      replacement = textBeforeCursor.replace(/@\/[^\s]*$/, `@/${file.relativePath} `);
    }

    const newText = replacement + textAfterCursor;
    setValue(newText);
    setShowFileSuggestions(false);

    // 娣诲姞鏂囦欢涓婁笅鏂囪姱鐗?
    const newChip = addChipId({
      type: 'file',
      path: fileWorkspace ? `${fileWorkspace.name}:${file.relativePath}` : file.relativePath,
      size: file.size || 0,
      workspace: fileWorkspace ?? undefined,
    });
    setContextChips(prev => [...prev, newChip]);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newText.length - textAfterCursor.length, newText.length - textAfterCursor.length);
    }, 0);
  }, [value, fileWorkspace]);

  // 閫夋嫨 Git 寤鸿
  const selectGitSuggestion = useCallback((item: GitSuggestionItem) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);

    let newText = '';
    if (item.type === 'action') {
      if (item.id === 'diff') {
        newText = textBeforeCursor.replace(/@git(?::\w*)?\s?[^\s]*$/, '@git:diff ') + textAfterCursor;
      } else if (item.id === 'diff-staged') {
        newText = textBeforeCursor.replace(/@git(?::\w*)?\s?[^\s]*$/, '@git:diff:staged ') + textAfterCursor;
      } else if (item.id === 'commit') {
        newText = textBeforeCursor.replace(/@git(?::\w*)?\s?[^\s]*$/, '@git:commit ') + textAfterCursor;
        setGitMode('commit');
        setShowGitSuggestions(true);
        setValue(newText);
        setTimeout(() => {
          textarea.focus();
          const newCursorPos = newText.length - textAfterCursor.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
        return;
      } else {
        newText = textBeforeCursor.replace(/@git(?::\w*)?\s?[^\s]*$/, `@git:${item.id} `) + textAfterCursor;
      }
    } else if (item.type === 'commit' && item.commit) {
      newText = textBeforeCursor.replace(/@git(?::commit)?\s?[^\s]*$/, `@git:commit:${item.commit.shortHash} `) + textAfterCursor;

      // 娣诲姞鎻愪氦涓婁笅鏂囪姱鐗?
      const newChip = addChipId({
        type: 'commit',
        hash: item.commit.hash,
        shortHash: item.commit.shortHash,
        message: item.commit.message,
        author: item.commit.author,
        timestamp: item.commit.timestamp,
      });
      setContextChips(prev => [...prev, newChip]);
    }

    setValue(newText);
    setShowGitSuggestions(false);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newText.length - textAfterCursor.length, newText.length - textAfterCursor.length);
    }, 0);
  }, [value]);

  // 绉婚櫎涓婁笅鏂囪姱鐗?
  const removeContextChip = useCallback((chip: ContextChipWithId) => {
    setContextChips(prev => prev.filter(c => c.id !== chip.id));
  }, []);

  // 閿洏浜嬩欢澶勭悊
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // 濡傛灉寤鸿妗嗘墦寮€锛岄€夋嫨寤鸿
      if (showCommandSuggestions) {
        e.preventDefault();
        if (suggestedCommands.length > 0) {
          selectCommand(suggestedCommands[selectedCommandIndex].name);
        }
        return;
      }

      if (showWorkspaceSuggestions) {
        e.preventDefault();
        if (filteredWorkspaces.length > 0) {
          selectWorkspace(filteredWorkspaces[selectedWorkspaceIndex]);
        }
        return;
      }

      if (showFileSuggestions) {
        e.preventDefault();
        if (fileMatches.length > 0) {
          selectFile(fileMatches[selectedFileIndex]);
        }
        return;
      }

      if (showGitSuggestions) {
        e.preventDefault();
        if (gitSuggestions.length > 0) {
          selectGitSuggestion(gitSuggestions[selectedGitIndex]);
        }
        return;
      }

      // 姝ｅ父鍙戦€?
      e.preventDefault();
      handleSend();
      return;
    }

    // 涓婁笅绠ご閫夋嫨寤鸿
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        (showCommandSuggestions || showWorkspaceSuggestions || showFileSuggestions || showGitSuggestions)) {
      e.preventDefault();

      let items: any[] = [];
      let setState: (fn: (prev: number) => number) => void;

      if (showCommandSuggestions) {
        items = suggestedCommands;
        setState = setSelectedCommandIndex;
      } else if (showWorkspaceSuggestions) {
        items = filteredWorkspaces;
        setState = setSelectedWorkspaceIndex;
      } else if (showFileSuggestions) {
        items = fileMatches;
        setState = setSelectedFileIndex;
      } else {
        items = gitSuggestions;
        setState = setSelectedGitIndex;
      }

      if (items.length === 0) return;

      const maxIndex = items.length - 1;
      const direction = e.key === 'ArrowUp' ? -1 : 1;

      setState(prev => {
        const newIndex = prev + direction;
        if (newIndex < 0) return maxIndex;
        if (newIndex > maxIndex) return 0;
        return newIndex;
      });
      return;
    }

    // ESC 鍏抽棴寤鸿
    if (e.key === 'Escape') {
      setShowCommandSuggestions(false);
      setShowWorkspaceSuggestions(false);
      setShowFileSuggestions(false);
      setShowGitSuggestions(false);
      clearResults();
      return;
    }

    // Tab 閫夋嫨寤鸿
    if (e.key === 'Tab' && !e.shiftKey) {
      if (showCommandSuggestions) {
        e.preventDefault();
        if (suggestedCommands.length > 0) {
          selectCommand(suggestedCommands[selectedCommandIndex].name);
        }
        return;
      }

      if (showWorkspaceSuggestions) {
        e.preventDefault();
        if (filteredWorkspaces.length > 0) {
          selectWorkspace(filteredWorkspaces[selectedWorkspaceIndex]);
        }
        return;
      }

      if (showFileSuggestions) {
        e.preventDefault();
        if (fileMatches.length > 0) {
          selectFile(fileMatches[selectedFileIndex]);
        }
        return;
      }

      if (showGitSuggestions) {
        e.preventDefault();
        if (gitSuggestions.length > 0) {
          selectGitSuggestion(gitSuggestions[selectedGitIndex]);
        }
        return;
      }
    }
  }, [
    showCommandSuggestions,
    showWorkspaceSuggestions,
    showFileSuggestions,
    showGitSuggestions,
    suggestedCommands,
    filteredWorkspaces,
    fileMatches,
    gitSuggestions,
    selectedCommandIndex,
    selectedWorkspaceIndex,
    selectedFileIndex,
    selectedGitIndex,
    selectCommand,
    selectWorkspace,
    selectFile,
    selectGitSuggestion,
    clearResults
  ]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;

    // 鏋勫缓鍖呭惈涓婁笅鏂囦俊鎭殑娑堟伅
    let finalMessage = trimmed;

    // 灏嗕笂涓嬫枃鑺墖淇℃伅闄勫姞鍒版秷鎭腑
    if (contextChips.length > 0) {
      const contextInfo = contextChips.map(chip => {
        switch (chip.type) {
          case 'file':
            return `[文件: ${chip.path}]`;
          case 'commit':
            return `[提交: ${chip.shortHash} - ${chip.message}]`;
          case 'diff':
            return `[差异: ${chip.target === 'staged' ? '已暂存' : '未暂存'}]`;
          case 'workspace':
            return `[工作区: ${chip.workspace.name}]`;
          case 'directory':
            return `[目录: ${chip.path}]`;
          case 'symbol':
            return `[符号: ${chip.name}]`;
          default:
            return '';
        }
      }).join('\n');
      finalMessage = `${contextInfo}\n\n${trimmed}`;
    }

    // 妫€鏌ユ槸鍚︽槸鍛戒护
    const commands = getCommands();
    const result = parseCommandInput(trimmed, commands);

    if (result.type === 'command') {
      const { command } = result;
      if (!command) return;

      if (command.name === 'commands') {
        onSend(generateCommandsListMessage(commands));
        resetInput();
        return;
      }

      if (command.name === 'help') {
        onSend(generateHelpMessage());
        resetInput();
        return;
      }

      const messageToSend = command.fullCommand || command.raw;
      onSend(messageToSend);
    } else {
      onSend(finalMessage);
    }

    resetInput();
  }, [value, disabled, isStreaming, getCommands, onSend, contextChips]);

  const resetInput = useCallback(() => {
    setValue('');
    setContextChips([]);
    setShowCommandSuggestions(false);
    setShowWorkspaceSuggestions(false);
    setShowFileSuggestions(false);
    setShowGitSuggestions(false);
    clearResults();
  }, [clearResults]);

  // 鐐瑰嚮澶栭儴鍏抽棴寤鸿
  useEffect(() => {
    const handleClickOutside = () => {
      setShowCommandSuggestions(false);
      setShowWorkspaceSuggestions(false);
      setShowFileSuggestions(false);
      setShowGitSuggestions(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="border-t border-border bg-background-elevated" ref={containerRef}>
      <div className="p-3">
        {/* 涓婁笅鏂囪姱鐗囨爮 */}
        <ContextChips chips={contextChips} onRemove={removeContextChip} />

        {/* 杈撳叆妗嗗鍣?- 绱у噾甯冨眬 */}
        <div className="relative flex items-end gap-2 bg-background-surface border border-border rounded-xl p-2 focus-within:ring-2 focus-within:ring-border focus-within:border-primary transition-all shadow-soft hover:shadow-medium">
          <AutoResizingTextarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送，Shift+Enter 换行，/命令，@工作区:文件，@git)"
            className="flex-1 px-2 py-1.5 bg-transparent text-text-primary placeholder:text-text-tertiary resize-none outline-none text-sm leading-relaxed"
            disabled={disabled}
            maxHeight={180}
            minHeight={36}
          />

          {isStreaming && onInterrupt ? (
            <Button
              variant="danger"
              size="sm"
              onClick={onInterrupt}
              className="shrink-0 h-8 px-3 text-xs"
            >
              <IconStop size={12} className="mr-1" />
              中断
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={disabled || isStreaming || !value.trim()}
              size="sm"
              className="shrink-0 h-8 px-3 text-xs shadow-glow"
            >
              <IconSend size={12} className="mr-1" />
              发送
            </Button>
          )}
        </div>

        {/* 绱у噾鐘舵€佹爮 - 浠呭湪蹇呰鏃舵樉绀?*/}
        {(isStreaming || suggestionMode || value.length > 0) && (
          <div className="flex items-center justify-between mt-1.5 px-1">
            <div className="text-xs text-text-tertiary">
              {isStreaming ? (
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-warning rounded-full animate-pulse" />
                  生成中
                </span>
              ) : suggestionMode === 'workspace' ? (
                <span>选择工作区</span>
              ) : suggestionMode === 'file' ? (
                <span>选择文件</span>
              ) : suggestionMode === 'git' ? (
                <span>Git 上下文</span>
              ) : (
                <span>Enter 发送 · Shift+Enter 换行</span>
              )}
            </div>
            {value.length > 0 && (
              <div className="text-xs text-text-tertiary">
                {value.length}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 鍛戒护寤鸿 */}
      {showCommandSuggestions && suggestedCommands.length > 0 && (
        <CommandSuggestion
          commands={suggestedCommands.map(c => ({ name: c.name, description: c.description }))}
          selectedIndex={selectedCommandIndex}
          onSelect={(cmd) => selectCommand(cmd.name)}
          onHover={setSelectedCommandIndex}
          position={commandPosition}
        />
      )}

      {/* 宸ヤ綔鍖哄缓璁?*/}
      {showWorkspaceSuggestions && filteredWorkspaces.length > 0 && (
        <WorkspaceSuggestion
          workspaces={filteredWorkspaces}
          currentWorkspaceId={currentWorkspaceId}
          selectedIndex={selectedWorkspaceIndex}
          onSelect={selectWorkspace}
          onHover={setSelectedWorkspaceIndex}
          position={workspacePosition}
        />
      )}

      {/* 鏂囦欢寤鸿 */}
      {showFileSuggestions && fileMatches.length > 0 && (
        <FileSuggestion
          files={fileMatches}
          selectedIndex={selectedFileIndex}
          onSelect={selectFile}
          onHover={setSelectedFileIndex}
          position={filePosition}
        />
      )}

      {/* Git 寤鸿 */}
      {showGitSuggestions && (
        <GitSuggestion
          mode={gitMode}
          items={gitSuggestions}
          selectedIndex={selectedGitIndex}
          query={gitQuery}
          onSelect={selectGitSuggestion}
          onHover={setSelectedGitIndex}
          position={gitPosition}
          isLoading={isGitLoading}
        />
      )}
    </div>
  );
}

