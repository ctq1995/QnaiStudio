import { describe, expect, it } from 'vitest'
import { selectVerificationCommands, selectVerificationCommandsForSubtype } from './verification-policy'

describe('verification subtype command selection', () => {
  const scripts = {
    build: 'vite build',
    test: 'vitest run',
    lint: 'eslint .',
    typecheck: 'tsc --noEmit',
  }

  it('preserves existing command selection when subtype is missing', () => {
    expect(selectVerificationCommandsForSubtype(undefined, ['src/App.tsx'], scripts)).toEqual(
      selectVerificationCommands(['src/App.tsx'], scripts),
    )
  })

  it('selects only build command for verify.build', () => {
    expect(selectVerificationCommandsForSubtype('verify.build', [], scripts).map((command) => command.id)).toEqual(['npm-build'])
  })

  it('selects only test command for verify.test', () => {
    expect(selectVerificationCommandsForSubtype('verify.test', [], scripts).map((command) => command.id)).toEqual(['npm-test'])
  })

  it('selects only lint command for verify.lint', () => {
    expect(selectVerificationCommandsForSubtype('verify.lint', [], scripts).map((command) => command.id)).toEqual(['npm-lint'])
  })

  it('selects only typecheck command for verify.typecheck', () => {
    expect(selectVerificationCommandsForSubtype('verify.typecheck', [], scripts).map((command) => command.id)).toEqual(['npm-typecheck'])
  })
})
