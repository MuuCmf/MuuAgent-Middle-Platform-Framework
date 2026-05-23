import { Controller, Post, Body, HttpCode, UseGuards, Logger } from '@nestjs/common';
import { ClientToolRegistry } from './client-tool-registry';
import { ClientToolCallResult } from './client-tool-handler.interface';
import { TenantGuard } from '../common/guards/tenant.guard';
import { success as apiSuccess } from '../common/response/api.response';

/**
 * 统一客户端工具结果回传控制器
 *
 * 所有客户端工具（workspace、system_control 等）的执行结果
 * 统一通过此接口回传，无需为每个工具模块单独创建结果接口。
 *
 * 路由原理：
 * 1. handler.dispatchToClient() 生成 callId 时，同时注册 callId → handler 映射
 * 2. 客户端执行完成后，通过此统一接口提交结果
 * 3. Controller 通过 callId 查找对应的 handler，调用 resolveCall()
 *
 * 新增客户端工具模块时，只需实现 IClientToolHandler 接口，
 * 无需额外创建结果回传 Controller。
 */
@Controller('agent/chat')
@UseGuards(TenantGuard)
export class ClientToolResultController {
  private readonly logger = new Logger(ClientToolResultController.name);

  constructor(private readonly clientToolRegistry: ClientToolRegistry) {}

  /**
   * 统一接收客户端工具执行结果
   * @param body 结果载荷
   * @returns {object} 确认响应
   */
  @Post('client-tool-result')
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
    const { callId, success: isSuccessful, result, error } = body;

    const handler = this.clientToolRegistry.getHandlerByCallId(callId);
    if (!handler) {
      this.logger.warn(`收到未知 callId 的结果: ${callId}`);
      return apiSuccess({ received: false, reason: 'unknown_call_id' });
    }

    const callResult: ClientToolCallResult = {
      callId,
      success: isSuccessful,
      result,
      error,
    };

    handler.resolveCall(callId, callResult);
    return apiSuccess({ received: true });
  }
}
