import { request } from 'http';

/**
 * SSE 流式响应回调接口
 */
export interface StreamCallbacks {
  /** 消息内容回调 */
  onMessage: (content: string) => void;
  /** 错误回调 */
  onError: (error: Error) => void;
  /** 完成回调 */
  onComplete: () => void;
  /** 会话ID回调 */
  onConversationId?: (conversationId: string) => void;
}

/**
 * SSE 流式请求参数
 */
export interface StreamRequestParams {
  /** 请求 URL */
  url: string;
  /** 请求体 */
  body: Record<string, unknown>;
  /** 回调函数 */
  callbacks: StreamCallbacks;
  /** API Key */
  apiKey: string;
  /** 可选的 AbortSignal */
  signal?: AbortSignal;
}

/**
 * 通用 HTTP GET 请求
 * @param url 请求 URL
 * @param headers 请求头
 * @returns {Promise<Record<string, unknown>>} 响应数据
 */
export function httpGet(
  url: string,
  headers: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers,
    };

    const req = request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    req.end();
  });
}

/**
 * 处理 SSE 流式响应数据
 * @param data 原始数据字符串
 * @param callbacks 回调函数
 * @param completed 是否已完成
 * @returns {boolean} 是否触发了完成
 */
function handleSSEData(
  data: string,
  callbacks: StreamCallbacks,
  completed: { value: boolean },
): boolean {
  if (data === '[DONE]') {
    if (!completed.value) {
      completed.value = true;
      callbacks.onComplete();
    }
    return true;
  }

  if (data.startsWith('[ERROR]')) {
    callbacks.onError(new Error(data.replace('[ERROR] ', '')));
    return true;
  }

  if (data.startsWith('[CONVERSATION_ID]')) {
    const conversationId = data.replace('[CONVERSATION_ID]', '').trim();
    if (callbacks.onConversationId && conversationId) {
      callbacks.onConversationId(conversationId);
    }
    return false;
  }

  try {
    const parsed = JSON.parse(data);

    if (typeof parsed === 'string' || typeof parsed === 'number') {
      callbacks.onMessage(String(parsed));
      return false;
    }

    if (parsed.choices && parsed.choices[0]?.delta) {
      const delta = parsed.choices[0].delta;
      if (delta.content) {
        callbacks.onMessage(delta.content);
      } else if (delta.reasoning_content) {
        callbacks.onMessage(delta.reasoning_content);
      }
    } else if (parsed.choices && parsed.choices[0]?.message?.content) {
      callbacks.onMessage(parsed.choices[0].message.content);
    } else if (parsed.message) {
      callbacks.onMessage(parsed.message);
    } else if (parsed.type === 'conversation_id' && parsed.conversationId) {
      if (callbacks.onConversationId) {
        callbacks.onConversationId(parsed.conversationId);
      }
    } else if (parsed.type === 'text_delta' && parsed.delta) {
      callbacks.onMessage(parsed.delta);
    } else if (parsed.type === 'chunk' && parsed.content) {
      callbacks.onMessage(parsed.content);
    } else if (parsed.type === 'error' && parsed.content) {
      callbacks.onError(new Error(parsed.content));
    } else if (parsed.type === 'done') {
      if (!completed.value) {
        completed.value = true;
        callbacks.onComplete();
      }
      return true;
    }
  } catch {
    callbacks.onMessage(data);
  }

  return false;
}

/**
 * 发起 SSE 流式请求
 * @param params 请求参数
 * @returns {Promise<void>}
 */
export function streamRequest(params: StreamRequestParams): Promise<void> {
  const { url, body, callbacks, apiKey, signal } = params;
  const parsedUrl = new URL(url);
  const completed = { value: false };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = request(options, (res) => {
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', (chunk: Buffer) => {
          errData += chunk.toString();
        });
        res.on('end', () => {
          callbacks.onError(new Error(`HTTP ${res.statusCode}: ${errData}`));
          resolve();
        });
        return;
      }

      let buffer = '';

      res.on('data', (chunk: Buffer) => {
        if (signal?.aborted) {
          req.destroy();
          return;
        }

        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) {
            continue;
          }

          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim();
            if (data) {
              handleSSEData(data, callbacks, completed);
            }
          }
        }
      });

      res.on('end', () => {
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim();
            if (data) {
              handleSSEData(data, callbacks, completed);
            }
          }
        }
        if (!completed.value) {
          completed.value = true;
          callbacks.onComplete();
        }
        resolve();
      });
    });

    req.on('error', (err: Error) => {
      if (!completed.value) {
        completed.value = true;
        callbacks.onError(err);
      }
      resolve();
    });

    req.setTimeout(120000, () => {
      req.destroy();
      if (!completed.value) {
        completed.value = true;
        callbacks.onError(new Error('请求超时'));
      }
      resolve();
    });

    req.write(postData);
    req.end();
  });
}
