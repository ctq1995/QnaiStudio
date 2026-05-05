#!/usr/bin/env python3
"""Extract key type definitions from chat.ts"""
import re

lines = open(r'E:\Polaris\QnaiStudio\src\types\chat.ts', 'r', encoding='utf-8').readlines()

# Find ToolCallBlock
for i, l in enumerate(lines):
    if 'export interface ToolCallBlock' in l:
        j = i
        while j < len(lines) and (j - i) < 50:
            s = lines[j].rstrip()
            if s:
                print(f'ToolCallBlock L{j+1}: {s}')
            j += 1
            if s and s.startswith('}'):
                break
        print('---')

# Find ContentBlock
for i, l in enumerate(lines):
    if 'export type ContentBlock' in l:
        print(f'ContentBlock L{i+1}: {l.rstrip()}')
        break

# Find AssistantChatMessage
for i, l in enumerate(lines):
    if 'export interface AssistantChatMessage' in l:
        j = i
        while j < len(lines) and (j - i) < 40:
            s = lines[j].rstrip()
            if s:
                print(f'AssistantChatMessage L{j+1}: {s}')
            j += 1
            if s and s.startswith('}'):
                break
        break

# Find TextBlock
for i, l in enumerate(lines):
    if 'export interface TextBlock' in l:
        j = i
        while j < len(lines) and (j - i) < 20:
            s = lines[j].rstrip()
            if s:
                print(f'TextBlock L{j+1}: {s}')
            j += 1
            if s and s.startswith('}'):
                break
        break
