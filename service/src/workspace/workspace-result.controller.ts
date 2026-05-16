import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import { WorkspaceToolHandler } from './workspace-tool.handler';
import { TenantGuard } from '../common/guards/tenant.guard';
import { success } from '../common/response/api.response';

@Controller('agent/chat')
@UseGuards(TenantGuard)
export class WorkspaceResultController {
  constructor(private readonly handler: WorkspaceToolHandler) {}

  /**
   * 接收工作目录调用结果
   */
  @Post('workspace-result')
  @HttpCode(200)
  async receiveResult(
    @Body() body: { conversationId: string; callId: string; success: boolean; result?: unknown; error?: string },
  ) {
    this.handler.resolveCall(body.callId, {
      callId: body.callId,
      success: body.success,
      result: body.result,
      error: body.error,
    });
    return success({ received: true });
  }
}
