import type { EngineeringExecutionPipelineDeps, VerificationCommand, VerificationResult } from '../ai-runtime/engineering'

export interface ControlledVerificationCommandResult {
  exitCode: number
  stdout?: string
  stderr?: string
}

export type ControlledVerificationCommandExecutor = (command: VerificationCommand, workspaceDir: string) => Promise<ControlledVerificationCommandResult>

export interface ControlledVerificationRunnerInput {
  executeCommand: ControlledVerificationCommandExecutor
}

export function createControlledVerificationRunner(input: ControlledVerificationRunnerInput): EngineeringExecutionPipelineDeps['runVerification'] {
  return async (commands, workspaceDir): Promise<VerificationResult[]> => {
    const results: VerificationResult[] = []

    for (const command of commands) {
      try {
        const result = await input.executeCommand(command, command.cwd || workspaceDir)
        results.push({
          command,
          success: result.exitCode === 0,
          output: formatCommandOutput(result.stdout, result.stderr),
          error: result.exitCode === 0 ? undefined : `Command exited with code ${result.exitCode}`,
        })
      } catch (error) {
        results.push({
          command,
          success: false,
          output: '',
          error: stringifyError(error),
        })
      }
    }

    return results
  }
}

function formatCommandOutput(stdout?: string, stderr?: string): string {
  return [stdout?.trim(), stderr?.trim()].filter(Boolean).join('\n')
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
