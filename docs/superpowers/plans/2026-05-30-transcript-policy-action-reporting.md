# Transcript Policy Action Reporting Plan

## Goal

Make transcript payload policy auditable by returning both sanitized payloads and policy actions.

## Implementation

1. Extend `TranscriptPayloadPolicy` to return:
   - `payload`
   - `actions`
2. Record actions for:
   - redacted keys
   - truncated strings
   - truncated arrays
   - truncated objects
   - max-depth replacement
   - circular references
   - non-JSON value conversion
3. Preserve existing caller customization:
   - `filter`
   - `mapPayload`
   - `payloadPolicy`
4. Attach policy actions into transcript payload when actions exist.
5. Apply the same reporting behavior to AIEvent and RuntimeBridge transcript wiring.

## Non-goals

- No UI rendering for policy actions in this iteration.
- No full content-based secret scanner in this iteration.
- No transcript schema migration.

## Success Criteria

1. `npm run build` passes.
2. Policy actions explain redaction/truncation decisions.
3. Transcript payload remains compact and JSON-safe.
4. AIEvent and RuntimeBridge wiring share the same reporting behavior.
