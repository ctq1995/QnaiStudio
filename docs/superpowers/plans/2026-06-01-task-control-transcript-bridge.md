# Task Control Transcript Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a service that records task control audit events into engineering transcripts.

**Architecture:** A bridge service accepts audit events plus optional transcript context and writes them to `EngineeringTranscriptRecorder` as typed transcript events.

**Tech Stack:** TypeScript, Vitest, EngineeringTranscriptRecorder.

---

### Task 1: Bridge service

**Files:**
- Create: `src/services/engineeringTaskControlTranscriptBridge.ts`
- Test: `src/services/engineeringTaskControlTranscriptBridge.test.ts`

- [ ] Add `recordEngineeringTaskControlAuditEvents(recorder, events, context?)`.
- [ ] Add `createEngineeringTaskControlTranscriptBridge(recorder, context?)`.
- [ ] Preserve each audit event as transcript payload.

### Task 2: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: record task control audit transcript`.
