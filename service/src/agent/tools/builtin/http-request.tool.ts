import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { BaseTool } from '../abstract/base-tool';
import { ToolDefinition, ToolExecutionContext } from '../abstract/tool.interface';
import { AgentTool } from '../decorators';
import { buildSkillHint } from './tool-hint.constants';

export interface HttpRequestResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  duration: number;
  error?: string;
}

/**
 * HTTP 请求工具
 * 用于发起 HTTP 请求，调用外部 API、发送 webhook、获取远程数据等
 */
@AgentTool({
  name: 'http_request',
  enabled: true,
  category: 'builtin',
})
export class HttpRequestTool extends BaseTool {
  readonly name = 'http_request';

  readonly definition: ToolDefinition = {
    name: 'http_request',
    description: `发起 HTTP 请求。用于调用外部 API、发送 webhook、获取远程数据等。
${buildSkillHint('了解正确的 URL、参数和认证方式')}
注意：禁止访问内网地址，响应体有大小限制。`,
    parameters: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
          description: 'HTTP 方法',
        },
        url: { type: 'string', description: '完整的请求 URL（含协议）' },
        headers: {
          type: 'object',
          description: '请求头，如 {"Authorization": "Bearer xxx", "Content-Type": "application/json"}',
        },
        query: { type: 'object', description: 'URL 查询参数（GET 请求时自动拼接）' },
        body: { description: '请求体（POST/PUT/PATCH 时使用）。可以是 JSON 对象或字符串' },
        timeout: { type: 'number', description: '超时时间（毫秒），默认 30000' },
      },
      required: ['method', 'url'],
    },
    type: 'builtin',
  };

  private readonly blockedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '169.254.',
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    '192.168.',
  ];

  async execute(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
    const startTime = Date.now();
    const method = this.getArg<string>(args, 'method');
    const url = this.getArg<string>(args, 'url');
    const headers = this.getArg<Record<string, string>>(args, 'headers');
    const query = this.getArg<Record<string, string>>(args, 'query');
    const body = args.body;
    const timeout = this.getArg<number>(args, 'timeout', 30000);

    this.validateUrl(url);

    try {
      const response = await axios({
        method: method.toLowerCase(),
        url,
        headers,
        params: query,
        data: body,
        timeout,
        maxRedirects: 5,
        maxContentLength: 1024 * 1024,
        maxBodyLength: 1024 * 1024,
        validateStatus: () => true,
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

  /**
   * 验证 URL 是否为允许访问的地址
   * @param url 请求 URL
   */
  private validateUrl(url: string): void {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      throw new HttpException(`无效的 URL: ${url}`, HttpStatus.BAD_REQUEST);
    }

    for (const blocked of this.blockedHosts) {
      if (hostname === blocked || hostname.startsWith(blocked)) {
        throw new HttpException(`不允许访问内网地址: ${hostname}`, HttpStatus.FORBIDDEN);
      }
    }
  }

  /**
   * 截断过大的响应数据
   * @param data 响应数据
   * @param maxSize 最大尺寸
   * @returns 处理后的数据
   */
  private truncateIfNeeded(data: unknown, maxSize = 100 * 1024): unknown {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    if (str.length > maxSize) {
      return { _truncated: true, _original_size: str.length, preview: str.slice(0, maxSize) };
    }
    return data;
  }
}
