import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { IAgentTool, ToolDefinition, ToolExecutionContext } from './abstract/tool.interface';

export interface HttpRequestResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  duration: number;
  error?: string;
}

@Injectable()
export class HttpRequestTool implements IAgentTool {
  private readonly logger = new Logger(HttpRequestTool.name);

  readonly name = 'http_request';

  private readonly blockedHosts = [
    'localhost', '127.0.0.1', '0.0.0.0', '::1',
    '169.254.', '10.', '172.16.', '172.17.', '172.18.',
    '172.19.', '172.20.', '172.21.', '172.22.', '172.23.',
    '172.24.', '172.25.', '172.26.', '172.27.', '172.28.',
    '172.29.', '172.30.', '172.31.', '192.168.',
  ];

  readonly definition: ToolDefinition = {
    name: 'http_request',
    description: `发起 HTTP 请求。用于调用外部 API、发送 webhook、获取远程数据等。
使用前请确保已通过 use_skill 加载相关技能指令，了解正确的 URL、参数和认证方式。
注意：禁止访问内网地址，响应体有大小限制。`,
    parameters: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'], description: 'HTTP 方法' },
        url: { type: 'string', description: '完整的请求 URL（含协议）' },
        headers: { type: 'object', description: '请求头，如 {"Authorization": "Bearer xxx", "Content-Type": "application/json"}' },
        query: { type: 'object', description: 'URL 查询参数（GET 请求时自动拼接）' },
        body: { description: '请求体（POST/PUT/PATCH 时使用）。可以是 JSON 对象或字符串' },
        timeout: { type: 'number', description: '超时时间（毫秒），默认 30000' },
      },
      required: ['method', 'url'],
    },
    type: 'builtin',
  };

  constructor() {}

  async execute(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
    const startTime = Date.now();
    const method = args.method as string;
    const url = args.url as string;
    const headers = args.headers as Record<string, string> | undefined;
    const query = args.query as Record<string, string> | undefined;
    const body = args.body as unknown;
    const timeout = args.timeout as number | undefined;

    this.validateUrl(url);

    try {
      const response = await axios({
        method: method.toLowerCase(),
        url,
        headers,
        params: query,
        data: body,
        timeout: timeout || 30000,
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
      throw new HttpException(`HTTP 请求失败: ${(error as Error).message}`, HttpStatus.INTERNAL_SERVER_ERROR);
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
        throw new HttpException(`不允许访问内网地址: ${hostname}`, HttpStatus.FORBIDDEN);
      }
    }
  }

  private truncateIfNeeded(data: unknown, maxSize = 100 * 1024): unknown {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    if (str.length > maxSize) {
      return { _truncated: true, _original_size: str.length, preview: str.slice(0, maxSize) };
    }
    return data;
  }
}
