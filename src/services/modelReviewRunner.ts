import type { EngineeringExecutionPipelineDeps, ReviewResult } from '../ai-runtime/engineering'

export interface ModelReviewRequest {
  prompt: string
  diff: string
  workspaceDir: string
}

export type ModelReviewExecutor = (request: ModelReviewRequest) => Promise<ReviewResult | string>

export interface ModelReviewRunnerInput {
  review: ModelReviewExecutor
}

export function createModelReviewRunner(input: ModelReviewRunnerInput): EngineeringExecutionPipelineDeps['runReview'] {
  return async (prompt, diff, workspaceDir): Promise<ReviewResult> => {
    try {
      const result = await input.review({ prompt, diff, workspaceDir })
      if (typeof result === 'string') {
        return {
          success: true,
          content: result,
        }
      }
      return result
    } catch (error) {
      return {
        success: false,
        error: stringifyError(error),
      }
    }
  }
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
