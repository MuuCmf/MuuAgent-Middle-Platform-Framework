import { Observable } from 'rxjs';
import { StreamEmitter } from './stream-emitter';

/**
 * SSE 响应构建器
 * 
 * 封装控制器层 SSE 响应的创建逻辑，将 StreamEmitter 转为 NestJS @Sse() 兼容的 Observable。
 * 控制器只需一行代码：`return SseResponseBuilder.create(emitter)`
 * 
 * @example
 * ```ts
 * @Post('chat/stream')
 * @Sse()
 * async chatStream(@Body() dto: ChatDto): Promise<Observable<MessageEvent>> {
 *   const emitter = new StreamEmitter();
 *   this.chatService.streamChat(dto, emitter); // 不 await
 *   return SseResponseBuilder.create(emitter);
 * }
 * ```
 */
export class SseResponseBuilder {
  /**
   * 从 StreamEmitter 创建 Observable<MessageEvent>
   * 
   * 这是控制器层唯一需要调用的方法。
   * 服务层通过 emitter 发射事件，控制器层通过此方法获取 Observable 返回给 @Sse() 装饰器。
   */
  static create(emitter: StreamEmitter): Observable<MessageEvent> {
    return emitter.toObservable();
  }
}
