import { Subject } from 'rxjs';
import { StreamEvent, StreamEventType } from './stream-event';

/**
 * 流式发射器
 * 
 * 统一管理流式事件的发射、缓冲和生命周期。
 * 所有服务层通过 emit() 发射统一事件，控制器层通过 toObservable() 获取 Observable。
 * 
 * 内置 UTF-8 不完整字节缓冲，确保每次发射的文本都是完整的 Unicode 字符，
 * 解决 AI 模型流式输出时多字节字符（如中文）被截断导致乱码的问题。
 * 
 * @example
 * ```ts
 * const emitter = new StreamEmitter();
 * 
 * // 服务层发射事件
 * emitter.emitTextDelta('你好');
 * emitter.emitDone();
 * 
 * // 控制层获取 Observable
 * const observable = emitter.toObservable();
 * ```
 */
export class StreamEmitter {
  private readonly subject = new Subject<MessageEvent>();
  private _completed = false;
  /** UTF-8 不完整字节缓冲区 */
  private _utf8Buffer = '';

  /**
   * 发射一个流式事件
   * @param event 统一流式事件
   */
  emit(event: StreamEvent): void {
    if (this._completed) {
      return;
    }

    const data = this.encodeEvent(event);
    this.subject.next(new MessageEvent('message', { data }));
  }

  /**
   * 发射文本增量（便捷方法）
   * 自动进行 UTF-8 安全处理，确保不发射不完整的多字节字符
   */
  emitTextDelta(delta: string): void {
    if (!delta) return;

    // 将缓冲区与新数据拼接
    const combined = this._utf8Buffer + delta;
    this._utf8Buffer = '';

    // 检查末尾是否有不完整的 UTF-8 字节序列
    const { safeText, remainder } = splitSafeUtf8(combined);
    this._utf8Buffer = remainder;

    if (safeText) {
      this.emit({
        type: StreamEventType.TEXT_DELTA,
        payload: { delta: safeText },
      });
    }
  }

  /**
   * 发射错误并完成流
   */
  emitError(message: string, code?: string): void {
    // 刷出缓冲区中剩余的文本
    this.flushBuffer();
    this.emit({
      type: StreamEventType.ERROR,
      payload: { message, code },
    });
    this.complete();
  }

  /**
   * 发射完成事件并完成流
   */
  emitDone(payload?: Record<string, unknown>): void {
    // 刷出缓冲区中剩余的文本
    this.flushBuffer();
    this.emit({
      type: StreamEventType.DONE,
      payload: payload || {},
    });
    this.complete();
  }

  /**
   * 完成流（不再接受新事件）
   */
  complete(): void {
    if (this._completed) return;
    this._completed = true;
    this.subject.complete();
  }

  /**
   * 流是否已完成
   */
  get completed(): boolean {
    return this._completed;
  }

  /**
   * 转换为 Observable<MessageEvent>，用于 @Sse() 装饰器返回
   */
  toObservable() {
    return this.subject.asObservable();
  }

  /**
   * 将缓冲区中剩余的不完整字节作为安全文本发射
   * （在流结束时调用，此时不可能再有后续字节来补全，
   *  直接发射避免丢失数据）
   */
  private flushBuffer(): void {
    if (this._utf8Buffer) {
      const text = this._utf8Buffer;
      this._utf8Buffer = '';
      // 尝试恢复为合法字符，替换无法恢复的部分
      this.emit({
        type: StreamEventType.TEXT_DELTA,
        payload: { delta: sanitizeText(text) },
      });
    }
  }

  /**
   * 将 StreamEvent 编码为 SSE data 字符串
   * 
   * 编码规则：
   * - TEXT_DELTA: JSON 序列化（安全传输，避免 SSE 帧格式问题）
   * - 其他类型: JSON 序列化
   */
  private encodeEvent(event: StreamEvent): string {
    switch (event.type) {
      case StreamEventType.TEXT_DELTA:
        // JSON 序列化，确保多字节字符和特殊字符安全传输
        return JSON.stringify({
          type: event.type,
          delta: (event.payload as { delta: string }).delta,
        });

      case StreamEventType.DONE:
        return '[DONE]';

      case StreamEventType.ERROR: {
        const payload = event.payload as { message: string; code?: string };
        return `[ERROR] ${payload.message}`;
      }

      default:
        // 其他事件类型统一 JSON 序列化
        return JSON.stringify({
          type: event.type,
          ...event.payload,
        });
    }
  }
}

/**
 * 检测字符串末尾是否包含不完整的 UTF-8 字节序列，
 * 将安全部分与不完整部分分离。
 * 
 * UTF-8 编码规则：
 * - 1 字节: 0xxxxxxx (0x00-0x7F)
 * - 2 字节: 110xxxxx 10xxxxxx (0xC0-0xDF 开头)
 * - 3 字节: 1110xxxx 10xxxxxx 10xxxxxx (0xE0-0xEF 开头)
 * - 4 字节: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx (0xF0-0xF7 开头)
 * 
 * 当 AI 模型以 token 粒度流式输出时，底层可能以 UTF-8 字节流传输，
 * 导致一个多字节字符被截断到两个 chunk 中。
 * 
 * @param text 待检测的文本
 * @returns safeText 可安全发送的部分，remainder 不完整的尾部字节
 */
export function splitSafeUtf8(text: string): { safeText: string; remainder: string } {
  if (!text) return { safeText: '', remainder: '' };

  const bytes = Buffer.from(text, 'utf-8');
  const len = bytes.length;

  if (len === 0) return { safeText: '', remainder: '' };

  // 从末尾向前扫描，找到最后一个完整字符的结束位置
  let i = len - 1;

  // 跳过尾部可能的不完整连续字节（10xxxxxx: 0x80-0xBF）
  while (i >= 0 && (bytes[i] & 0xC0) === 0x80) {
    i--;
  }

  // i 现在指向首字节（或 -1）
  if (i < 0) {
    // 全部是连续字节，没有首字节——全部缓冲
    return { safeText: '', remainder: text };
  }

  const leadByte = bytes[i];
  let expectedLen: number;

  if ((leadByte & 0x80) === 0x00) {
    // ASCII 单字节字符
    expectedLen = 1;
  } else if ((leadByte & 0xE0) === 0xC0) {
    expectedLen = 2;
  } else if ((leadByte & 0xF0) === 0xE0) {
    expectedLen = 3;
  } else if ((leadByte & 0xF8) === 0xF0) {
    expectedLen = 4;
  } else {
    // 非法首字节，跳过此字节
    const safeBytes = bytes.subarray(0, i);
    const remainderBytes = bytes.subarray(i);
    return {
      safeText: safeBytes.length > 0 ? safeBytes.toString('utf-8') : '',
      remainder: remainderBytes.toString('latin1'),
    };
  }

  const actualLen = len - i;

  if (actualLen >= expectedLen) {
    // 末尾字符完整
    return { safeText: text, remainder: '' };
  }

  // 末尾字符不完整，需要缓冲
  const safeBytes = bytes.subarray(0, i);
  const remainderBytes = bytes.subarray(i);

  return {
    safeText: safeBytes.length > 0 ? safeBytes.toString('utf-8') : '',
    remainder: remainderBytes.toString('latin1'),
  };
}

/**
 * 清理文本中的非法字符（在流结束时应将缓冲区刷出）
 * 尝试将 latin1 编码的剩余字节恢复为 UTF-8
 */
function sanitizeText(text: string): string {
  if (!text) return '';
  try {
    const bytes = Buffer.from(text, 'latin1');
    return bytes.toString('utf-8');
  } catch {
    return text;
  }
}
