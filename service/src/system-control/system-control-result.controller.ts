import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import { SystemControlHandler } from './system-control.handler';
import { TenantGuard } from '../common/guards/tenant.guard';
import { success } from '../common/response/api.response';

@Controller('agent/chat')
@UseGuards(TenantGuard)
export class SystemControlResultController {
  constructor(private readonly handler: SystemControlHandler) {}

  /**
   * 接收系统控制工具调用结果
   * Electron 端执行完系统操作后，通过此接口回传结果
   * @param body 结果载荷
   * @returns {object} 确认响应
   */
  @Post('system-control-result')
  @HttpCode(200)
  async receiveResult(
    @Body() body: {
      /** 会话ID */
      conversationId: string;
      /** 调用ID */
      callId: string;
      /** 是否成功 */
      success: boolean;
      /** 执行结果 */
      result?: unknown;
      /** 错误信息 */
      error?: string;
    },
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
