#!/usr/bin/env python3
"""Extract detailed type definitions from chat.ts"""
lines = open(r'E:\Polaris\QnaiStudio\src\types\chat.ts', 'r', encoding='utf-8').readlines()

targets = [
    ('ToolCallBlock', 'export interface ToolCallBlock {'),
    ('AssistantChatMessage', 'export interface AssistantChatMessage'),
    ('TextBlock', 'export interface TextBlock {'),
    ('ChatRunStatus', 'export interface ChatRunStatus'),
]

for name, pattern in targets:
    for i, l in enumerate(lines):
        if pattern in l:
            j = i
            count = 0
            while j < len(lines) and count < 30:
                s = lines[j].rstrip()
                if s:
                    print(f'{name} L{j+1}: {s}')
                    count += 1
                j += 1
                if s and s.startswith('}'):
                    break
            print()
            break
