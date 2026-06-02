# Task Center Navigation Intent Bridge Design

## Goal

Represent `open_transcript` and `open_timeline` actions as explicit navigation intents so Task Center can show where the user requested to navigate without changing App routing yet.

## Scope

Add navigation intent state to `engineeringTaskStateStore` and show it in Task Center control feedback.

## Store state

Add:

```ts
type EngineeringTaskNavigationTarget = 'transcript' | 'timeline'

interface EngineeringTaskNavigationIntent {
  taskId: string
  target: EngineeringTaskNavigationTarget
  requestedAt: string
}
```

Store field:

```ts
lastNavigationIntent?: EngineeringTaskNavigationIntent
```

## Flow

When `dispatchTaskAction(taskId, action)` receives:

```text
open_transcript
open_timeline
```

and permission is allowed and dispatcher returns accepted, set:

```text
open_transcript -> target transcript
open_timeline   -> target timeline
```

## UI

`TaskCenterPanel` displays the active task's pending navigation intent in the existing `Control feedback` section:

```text
Navigation pending
Target: transcript / timeline
Requested: timestamp
```

## Non-goals

- No actual panel switching.
- No URL/router changes.
- No transcript/timeline data loading changes.
