import { Module } from '@nestjs/common';

/**
 * 流式调用基础模块
 * 
 * 提供统一的流式事件模型（StreamEvent）、发射器（StreamEmitter）和 SSE 响应构建器（SseResponseBuilder）。
 * 所有需要流式调用的模块（AI、Agent、Retrieval）均依赖此模块。
 * 
 * StreamEmitter 是纯内存对象（基于 RxJS Subject），无需注册为 Provider，
 * 由各服务方法内部 new StreamEmitter() 创建并传递。
 */
@Module({})
export class StreamModule {}
