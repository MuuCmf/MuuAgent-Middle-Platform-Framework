import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ExecutionContext } from '../interfaces/executor.interface';

/**
 * 上下文管理器参数接口
 */
export interface ContextManagerParams {
  clientIp: string;
  userAgent?: string;
  uid?: string;
  appCode?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 上下文管理器
 * 管理调用上下文的创建和追踪
 */
@Injectable()
export class ContextManager {
  /**
   * 创建执行上下文
   * @param params 上下文参数
   * @returns 执行上下文
   */
  create(params: ContextManagerParams): ExecutionContext {
    return {
      requestId: randomUUID(),
      startTime: Date.now(),
      clientIp: params.clientIp,
      userAgent: params.userAgent,
      uid: params.uid,
      appCode: params.appCode,
      conversationId: params.conversationId,
      metadata: params.metadata,
    };
  }

  /**
   * 计算耗时
   * @param context 执行上下文
   * @returns 耗时（毫秒）
   */
  calculateDuration(context: ExecutionContext): number {
    return Date.now() - context.startTime;
  }

  /**
   * 创建子上下文
   * @param parent 父上下文
   * @param metadata 额外元数据
   * @returns 子上下文
   */
  createChild(
    parent: ExecutionContext,
    metadata?: Record<string, unknown>,
  ): ExecutionContext {
    return {
      ...parent,
      requestId: randomUUID(),
      metadata: { ...parent.metadata, ...metadata },
    };
  }

  /**
   * 从现有数据创建上下文
   * @param clientIp 客户端 IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识
   * @param appCode 应用编码
   * @returns 执行上下文
   */
  createFromParams(
    clientIp: string,
    userAgent?: string,
    uid?: string,
    appCode?: string,
  ): ExecutionContext {
    return this.create({
      clientIp,
      userAgent,
      uid,
      appCode,
    });
  }
}
