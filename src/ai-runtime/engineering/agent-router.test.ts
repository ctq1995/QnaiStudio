import { describe, expect, it } from 'vitest'
import { routeEngineeringAgentTask } from './agent-router'

const workspaceDir = 'E:/workspace/project'

describe('routeEngineeringAgentTask', () => {
  it('routes modifying feature requests to execute', () => {
    const decision = routeEngineeringAgentTask({
      userRequest: 'add a dark mode setting',
      workspaceDir,
    })

    expect(decision.route).toBe('execute')
    expect(decision.runModeDecision.mode).toBe('act')
    expect(decision.requiredCapabilities).toEqual(['context', 'snapshot', 'agent_execution', 'git_diff', 'verification', 'review'])
    expect(decision.riskLevel).toBe('high')
  })

  it('routes explanation requests to explain', () => {
    const decision = routeEngineeringAgentTask({
      userRequest: 'explain how authentication works',
      workspaceDir,
    })

    expect(decision.route).toBe('explain')
    expect(decision.runModeDecision.mode).toBe('plan')
    expect(decision.requiredCapabilities).toEqual(['context'])
    expect(decision.permissionMode).toBe('plan')
  })

  it('routes review requests to review', () => {
    const decision = routeEngineeringAgentTask({
      userRequest: 'review the current diff for bugs',
      workspaceDir,
    })

    expect(decision.route).toBe('review')
    expect(decision.requiredCapabilities).toEqual(['context', 'git_diff', 'review'])
    expect(decision.riskLevel).toBe('low')
  })

  it('routes ambiguous requests to unknown with conservative permissions', () => {
    const decision = routeEngineeringAgentTask({
      userRequest: 'handle this',
      workspaceDir,
    })

    expect(decision.route).toBe('unknown')
    expect(decision.permissionMode).toBe('plan')
    expect(decision.requiredCapabilities).toEqual(['context'])
  })
})
