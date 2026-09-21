import { Injectable, Logger } from '@nestjs/common';
import { AgentService } from '../agent.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IsolationContext } from '../../common/services/base-isolated.service';

/**
 * 子代理调用参数
 */
export interface SubAgentRunParams {
  /** 目标子智能体标识（code 或 id） */
  agentCode: string;
  /** 交给子智能体处理的任务描述 */
  query: string;
  /** 祖先调用链（不含当前 agent 自身），用于深度与防环校验 */
  chain: string[];
  /** 当前（父）智能体 code，用于拼接子代理调用链 */
  parentCode?: string;
  /** 调用链追踪ID（整条链共享） */
  traceId?: string;
  /** 直接父智能体ID */
  parentAgentId?: bigint;
  /** 直接父会话ID */
  parentConversationId?: string;
  /** 隔离上下文（透传应用作用域） */
  isolationContext?: IsolationContext;
  /** 用户唯一标识（透传） */
  uid?: string;
  /** 客户端IP（透传） */
  clientIp?: string;
}

/**
 * 子代理执行结果
 */
export interface SubAgentResult {
  ok: boolean;
  response?: string;
  message: string;
}

/**
 * 子代理执行服务
 *
 * 负责调用其他智能体（子代理）执行任务，并保证：
 * - 嵌套深度上限（防无限递归）
 * - 调用链防环（同一智能体不可重复出现在调用链中）
 * - 单次执行超时（防止父会话挂死）
 * - 结果长度截断（防止撑爆父代理上下文）
 * - 应用作用域透传（隔离校验由 AgentService.getAgent 完成）
 * - 错误兜底（失败以文本返回，不抛出中断父代理）
 */
@Injectable()
export class SubAgentService {
  private readonly logger = new Logger(SubAgentService.name);

  /** 子代理嵌套最大层数（顶层=1，子代理=2，以此类推） */
  static readonly MAX_DEPTH = 3;

  /** 子代理单次执行超时（毫秒） */
  static readonly TIMEOUT_MS = 120_000;

  /** 子代理结果最大返回长度（字符），超出部分截断 */
  static readonly MAX_RESULT_CHARS = 8000;

  constructor(
    private readonly agentService: AgentService,
    private readonly prisma: PrismaService,
  ) {}

  async run(params: SubAgentRunParams): Promise<SubAgentResult> {
    const { agentCode, query, chain, parentCode } = params;

    if (!agentCode || !query) {
      return { ok: false, message: '调用子代理缺少必要参数（agent_code / query）' };
    }

    // 深度校验：子代理将处于第 chain.length + 2 层（顶层=1）
    const nextDepth = chain.length + 2;
    if (nextDepth > SubAgentService.MAX_DEPTH) {
      this.logger.warn(`子代理嵌套深度超限: chain=[${chain.join(' -> ')}], target=${agentCode}`);
      return {
        ok: false,
        message: `子代理嵌套深度超过上限（${SubAgentService.MAX_DEPTH} 层），已拒绝调用智能体 ${agentCode}。请由当前智能体直接完成该任务。`,
      };
    }

    // 防环校验：目标智能体不允许出现在祖先调用链中
    if (chain.includes(agentCode)) {
      this.logger.warn(`子代理循环调用拦截: chain=[${chain.join(' -> ')}], target=${agentCode}`);
      return {
        ok: false,
        message: `检测到循环调用：智能体 ${agentCode} 已在当前调用链中，已拒绝调用以避免死循环。请由当前智能体直接完成该任务。`,
      };
    }

    // 子代理存在性 + 可被调用白名单校验（与应用作用域一致的隔离语义）
    const subAgent = await this.findSubAgent(agentCode, params.isolationContext);
    if (!subAgent) {
      return {
        ok: false,
        message: `子代理 ${agentCode} 不存在或当前环境不可访问`,
      };
    }
    if (!subAgent.status) {
      return {
        ok: false,
        message: `子代理 ${agentCode} 已禁用，无法调用`,
      };
    }
    const whitelistCheck = this.checkCallableByAgents(subAgent.callableByAgents, parentCode);
    if (!whitelistCheck.ok) {
      return whitelistCheck;
    }

    // 拼接子代理自己的调用链（父链 + 父自身 code）
    const childChain = parentCode ? [...chain, parentCode] : chain;

    const dto = { agentId: agentCode, message: query };

    try {
      const result = await this.withTimeout(
        this.agentService.syncChat(
          dto as any,
          params.clientIp || 'sub-agent',
          params.uid,
          params.isolationContext?.appCode || undefined,
          {
            traceId: params.traceId,
            parentAgentId: params.parentAgentId,
            parentConversationId: params.parentConversationId,
            subAgentChain: childChain,
          },
        ),
        SubAgentService.TIMEOUT_MS,
      );

      const response = this.truncate(String(result.response ?? ''));
      return { ok: true, response, message: response };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.warn(`子代理调用失败 [${agentCode}]: ${message}`);
      return {
        ok: false,
        message: `子代理 ${agentCode} 执行失败：${message}`,
      };
    }
  }

  /**
   * 查询子代理（与应用作用域一致的隔离语义：公共或同应用可见）
   */
  private async findSubAgent(
    agentCode: string,
    isolationContext?: IsolationContext,
  ): Promise<{ id: bigint; code: string; status: boolean; callableByAgents: string | null } | null> {
    const appCode = isolationContext?.appCode || null;
    const where: Record<string, unknown> = appCode
      ? { OR: [{ code: agentCode, appCode }, { code: agentCode, appCode: null }] }
      : { code: agentCode, appCode: null };

    return this.prisma.agent.findFirst({
      where,
      select: { id: true, code: true, status: true, callableByAgents: true },
    });
  }

  /**
   * 可被调用白名单校验
   * @param callableByAgents 白名单JSON（null=不限制，[]=禁止，数组=仅允许列表中的code）
   * @param parentCode 调用方（父）智能体code
   */
  private checkCallableByAgents(
    callableByAgents: string | null | undefined,
    parentCode?: string,
  ): SubAgentResult {
    // null/未配置：不限制
    if (callableByAgents === null || callableByAgents === undefined) {
      return { ok: true, message: '' };
    }

    let allowed: unknown;
    try {
      allowed = JSON.parse(callableByAgents);
    } catch {
      this.logger.warn(`callableByAgents 配置非法，按禁止处理: ${callableByAgents}`);
      allowed = [];
    }

    // 非数组按禁止处理（配置异常时保守拒绝）
    if (!Array.isArray(allowed)) {
      return { ok: false, message: `智能体配置异常（callableByAgents 格式非法），已拒绝调用` };
    }

    // 空数组：禁止被任何智能体调用
    if (allowed.length === 0) {
      return { ok: false, message: `智能体不允许被其他智能体调用（已配置为禁止）` };
    }

    // 白名单：仅允许列表中的 code
    if (!parentCode || !allowed.includes(parentCode)) {
      return { ok: false, message: `智能体未授权被 ${parentCode || '当前智能体'} 调用` };
    }

    return { ok: true, message: '' };
  }

  /**
   * 带超时的 Promise 执行
   * 注意：超时后子代理执行无法强制中断（AI 调用不支持 abort），
   * 子代理会在后台继续执行并正常落库，此处仅放弃等待以避免父会话挂死。
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`子代理执行超时（超过 ${Math.round(ms / 1000)} 秒）`)),
        ms,
      );
    });

    try {
      return Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }

  /**
   * 截断过长的子代理结果，避免污染父代理上下文
   */
  private truncate(text: string): string {
    const max = SubAgentService.MAX_RESULT_CHARS;
    if (text.length <= max) {
      return text;
    }
    return `${text.slice(0, max)}\n\n...(结果已截断，原始长度 ${text.length} 字符)`;
  }
}
