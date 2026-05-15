import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import { WorkspaceToolHandler } from './workspace-tool.handler';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('agent/chat')
@UseGuards(TenantGuard)
export class WorkspaceResultController {
  constructor(private readonly handler: WorkspaceToolHandler) {}

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
    return { received: true };
  }
}
