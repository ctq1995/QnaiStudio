import type { EngineeringToolKind } from './permission-policy'

export interface EngineeringToolCall<TInput = unknown, TResult = unknown> {
  id: string
  name: string
  kind: EngineeringToolKind
  input: TInput
  isConcurrencySafe: boolean
  run: () => Promise<TResult>
}

export interface EngineeringToolCallResult<TResult = unknown> {
  id: string
  name: string
  success: boolean
  result?: TResult
  error?: string
}

export async function executeEngineeringToolCalls(
  calls: EngineeringToolCall[]
): Promise<EngineeringToolCallResult[]> {
  const resultSlots = new Array<EngineeringToolCallResult | undefined>(calls.length)
  const concurrentIndices: number[] = []
  const sequentialIndices: number[] = []

  calls.forEach((call, index) => {
    if (call.isConcurrencySafe) concurrentIndices.push(index)
    else sequentialIndices.push(index)
  })

  await Promise.all(concurrentIndices.map(async (index) => {
    resultSlots[index] = await executeOne(calls[index])
  }))

  for (const index of sequentialIndices) {
    resultSlots[index] = await executeOne(calls[index])
  }

  return resultSlots as EngineeringToolCallResult[]
}

async function executeOne(call: EngineeringToolCall): Promise<EngineeringToolCallResult> {
  try {
    return {
      id: call.id,
      name: call.name,
      success: true,
      result: await call.run(),
    }
  } catch (error) {
    return {
      id: call.id,
      name: call.name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
