import { httpClient } from './request'
import { API_ENDPOINTS } from './config'

export interface WorkspaceToolCallPayload {
  callId: string
  toolName: string
  args: Record<string, unknown>
}

export interface WorkspaceToolResultPayload {
  callId: string
  success: boolean
  result?: unknown
  error?: string
}

export async function submitWorkspaceResult(
  conversationId: string,
  result: WorkspaceToolResultPayload,
): Promise<void> {
  await httpClient.getInstance().post(`${API_ENDPOINTS.agents}/chat/workspace-result`, {
    conversationId,
    ...result,
  })
}
