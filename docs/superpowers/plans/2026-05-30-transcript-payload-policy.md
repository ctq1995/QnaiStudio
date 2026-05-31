# Transcript Payload Policy Plan

## Goal

Allow runtime transcript wiring to record useful payloads while reducing accidental sensitive-data exposure and unbounded payload growth.

## Implementation

1. Add `transcriptPayloadPolicy.ts` with a reusable policy factory.
2. Redact sensitive keys by default:
   - password / passwd / pwd
   - secret
   - token
   - api key
   - authorization
   - cookie
   - credential
   - private key
3. Enforce payload budgets:
   - max string length
   - max array items
   - max object keys
   - max object depth
   - circular reference protection
4. Apply policy to AIEvent transcript auto wiring.
5. Apply policy to RuntimeBridge transcript wiring.
6. Keep caller override hooks:
   - `filter`
   - `mapPayload`
   - `payloadPolicy`

## Non-goals

- No full secret scanning engine in this iteration.
- No persistent transcript encryption in this iteration.
- No UI replay changes.

## Success Criteria

1. `npm run build` passes.
2. Default transcript payloads are bounded.
3. Obvious sensitive keys are redacted.
4. Callers can override filtering, mapping, and policy behavior.
