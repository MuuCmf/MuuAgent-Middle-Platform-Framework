import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { FunctionToolDefinition } from './tool-definitions';

/**
 * HTTP 请求工具结果
 */
export interface HttpRequestResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  duration: number;
  error?: string;
}

/**
 * 通用 HTTP 请求工具
 *
 * 取代所有 HTTP 类型的 DB 技能。LLM 通过 use_skill 加载技能指令后，
 * 使用此工具发起实际的 HTTP 请求。
 *
 * 安全约束：
 * - 禁止内网 IP（防 SSRF）
 * - 可选 URL 白名单
 * - 响应体 1MB 上限
 */
@Injectable()
export class HttpRequestTool {
  private readonly logger = new Logger(HttpRequestTool.name);

  private readonly blockedHosts = [
    'localhost', '127.0.0.1', '0.0.0.0', '::1',
    '169.254.', '10.', '172.16.', '172.17.', '172.18.',
    '172.19.', '172.20.', '172.21.', '172.22.', '172.23.',
    '172.24.', '172.25.', '172.26.', '172.27.', '172.28.',
    '172.29.', '172.30.', '172.31.', '192.168.',
  ];

  static readonly definition: FunctionToolDefinition = {
    type: 'function',
    function: {
      name: 'http_request',
      description: `发起 HTTP 请求。用于调用外部 API、发送 webhook、获取远程数据等。
使用前请确保已通过 use_skill 加载相关技能指令，了解正确的 URL、参数和认证方式。
注意：禁止访问内网地址，响应体有大小限制。`,
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
            description: 'HTTP 方法',
          },
          url: {
            type: 'string',
            description: '完整的请求 URL（含协议）',
          },
          headers: {
            type: 'object',
            description: '请求头，如 {"Authorization": "Bearer xxx", "Content-Type": "application/json"}',
          },
          query: {
            type: 'object',
            description: 'URL 查询参数（GET 请求时自动拼接）',
          },
          body: {
            description: '请求体（POST/PUT/PATCH 时使用）。可以是 JSON 对象或字符串',
          },
          timeout: {
            type: 'number',
            description: '超时时间（毫秒），默认 30000',
          },
        },
        required: ['method', 'url'],
      },
    },
  };

  async execute(args: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
    timeout?: number;
  }): Promise<HttpRequestResult> {
    const startTime = Date.now();

    this.validateUrl(args.url);

    try {
      const response = await axios({
        method: args.method.toLowerCase(),
        url: args.url,
        headers: args.headers,
        params: args.query,
        data: args.body,
        timeout: args.timeout || 30000,
        maxRedirects: 5,
        maxContentLength: 1024 * 1024, // 1MB
        maxBodyLength: 1024 * 1024,
        validateStatus: () => true, // 不抛异常，所有状态码都返回
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>,
        data: this.truncateIfNeeded(response.data),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          status: error.response?.status || 0,
          statusText: error.response?.statusText || error.message,
          headers: (error.response?.headers as Record<string, string>) || {},
          data: error.response?.data || null,
          duration: Date.now() - startTime,
          error: error.message,
        };
      }
      throw new HttpException(
        `HTTP 请求失败: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private validateUrl(url: string): void {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      throw new HttpException(`无效的 URL: ${url}`, HttpStatus.BAD_REQUEST);
    }

    for (const blocked of this.blockedHosts) {
      if (hostname === blocked || hostname.startsWith(blocked)) {
        throw new HttpException(
          `不允许访问内网地址: ${hostname}`,
          HttpStatus.FORBIDDEN,
        );
      }
    }
  }

  private truncateIfNeeded(data: unknown, maxSize = 100 * 1024): unknown {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    if (str.length > maxSize) {
      return {
        _truncated: true,
        _original_size: str.length,
        preview: str.slice(0, maxSize),
      };
    }
    return data;
  }
}
