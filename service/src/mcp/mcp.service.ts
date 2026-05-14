import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ModelService } from '../model/model.service';
import {
  CreateMcpStrategyDto,
  UpdateMcpStrategyDto,
  CreateMcpRuleDto,
  UpdateMcpRuleDto,
  StrategyType,
  CircuitStatus,
} from './dto/mcp.dto';
import { Model } from '@prisma/client';

/**
 * MCP调度核心服务
 * 负责模型路由、限流、熔断、降级
 */
@Injectable()
export class McpService {
  /** 轮询计数器 */
  private roundRobinCounters: Map<string, number> = new Map();

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param modelService 模型服务
   */
  constructor(
    private prisma: PrismaService,
    private modelService: ModelService,
  ) {}

  /**
   * 创建MCP策略
   * @param dto 创建策略DTO
   * @returns {Promise<Object>} 创建的策略
   */
  async createStrategy(dto: CreateMcpStrategyDto) {
    return this.prisma.mcpStrategy.create({
      data: {
        modelType: dto.modelType,
        strategy: dto.strategy,
        retryCount: dto.retryCount ?? 3,
        timeout: dto.timeout ?? 30000,
        fallbackModelId: dto.fallbackModelId,
        enableCircuit: dto.enableCircuit ?? true,
        circuitThreshold: dto.circuitThreshold ?? 5,
        circuitTimeout: dto.circuitTimeout ?? 300000,
      },
    });
  }

  /**
   * 更新MCP策略
   * @param modelType 模型类型
   * @param dto 更新策略DTO
   * @returns {Promise<Object>} 更新后的策略
   */
  async updateStrategy(modelType: string, dto: UpdateMcpStrategyDto) {
    const strategy = await this.prisma.mcpStrategy.findUnique({
      where: { modelType },
    });
    if (!strategy) {
      throw new HttpException('策略不存在', HttpStatus.NOT_FOUND);
    }

    return this.prisma.mcpStrategy.update({
      where: { modelType },
      data: dto,
    });
  }

  /**
   * 获取MCP策略
   * @param modelType 模型类型
   * @returns {Promise<Object>} 策略详情
   */
  async getStrategy(modelType: string) {
    let strategy = await this.prisma.mcpStrategy.findUnique({
      where: { modelType },
    });

    if (!strategy) {
      strategy = await this.createStrategy({
        modelType,
        strategy: StrategyType.WEIGHT,
      });
    }

    return strategy;
  }

  /**
   * 获取所有MCP策略
   * @returns {Promise<Object[]> 策略列表
   */
  async getAllStrategies() {
    return this.prisma.mcpStrategy.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 创建MCP规则
   * @param dto 创建规则DTO
   * @returns {Promise<Object>} 创建的规则
   */
  async createRule(dto: CreateMcpRuleDto) {
    return this.prisma.mcpRule.create({
      data: {
        modelId: dto.modelId as any,
        qpsLimit: dto.qpsLimit ?? 10,
        maxConcurrent: dto.maxConcurrent ?? 5,
      },
    });
  }

  /**
   * 创建或更新MCP规则
   * @param modelId 模型ID
   * @param dto 规则DTO
   * @returns {Promise<Object>} 创建或更新后的规则
   */
  async upsertRule(modelId: string, dto: CreateMcpRuleDto | UpdateMcpRuleDto) {
    const existingRule = await this.prisma.mcpRule.findFirst({
      where: { modelId: modelId as any },
    });

    if (existingRule) {
      return this.prisma.mcpRule.update({
        where: { id: existingRule.id },
        data: {
          qpsLimit: dto.qpsLimit ?? existingRule.qpsLimit,
          maxConcurrent: dto.maxConcurrent ?? existingRule.maxConcurrent,
        },
      });
    }

    return this.prisma.mcpRule.create({
      data: {
        modelId: modelId as any,
        qpsLimit: dto.qpsLimit ?? 10,
        maxConcurrent: dto.maxConcurrent ?? 5,
      },
    });
  }

  /**
   * 更新MCP规则
   * @param modelId 模型ID
   * @param dto 更新规则DTO
   * @returns {Promise<Object>} 更新后的规则
   */
  async updateRule(modelId: string, dto: UpdateMcpRuleDto) {
    const rule = await this.prisma.mcpRule.findFirst({
      where: { modelId: modelId as any },
    });
    if (!rule) {
      return this.createRule({ modelId : modelId as any, ...dto });
    }

    return this.prisma.mcpRule.update({
      where: { id: rule.id },
      data: dto,
    });
  }

  /**
   * 获取模型规则
   * @param modelId 模型ID
   * @returns {Promise<Object>} 规则详情
   */
  async getRule(modelId: string) {
    let rule = await this.prisma.mcpRule.findFirst({
      where: { modelId: modelId as any },
    });

    if (!rule) {
      rule = await this.createRule({ modelId : modelId as any });
    }

    return rule;
  }

  /**
   * 根据策略选择最优模型
   * @param modelType 模型类型
   * @returns {Promise<Model>} 选中的模型
   */
  async selectModel(modelType: string): Promise<Model> {
    const strategy = await this.getStrategy(modelType);
    const models = await this.modelService.getAvailableModels(modelType);

    if (!models.length) {
      throw new HttpException('无可用模型', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // 过滤掉熔断的模型
    const availableModels: Model[] = [];
    for (const model of models) {
      const rule = await this.getRule(model.id as any);
      if (rule.circuitStatus !== CircuitStatus.OPEN) {
        availableModels.push(model);
      }
    }

    if (!availableModels.length) {
      // 所有模型都熔断，尝试使用降级模型
      if (strategy.fallbackModelId) {
        try {
          return await this.modelService.findOne(strategy.fallbackModelId);
        } catch {
          throw new HttpException('所有模型不可用', HttpStatus.SERVICE_UNAVAILABLE);
        }
      }
      throw new HttpException('所有模型不可用', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // 根据策略选择模型
    let selectedModel: Model;
    switch (strategy.strategy) {
      case StrategyType.WEIGHT:
        selectedModel = this.selectByWeight(availableModels);
        break;
      case StrategyType.RANDOM:
        selectedModel = this.selectByRandom(availableModels);
        break;
      case StrategyType.ROUND_ROBIN:
        selectedModel = this.selectByRoundRobin(modelType, availableModels);
        break;
      case StrategyType.FAILOVER:
        selectedModel = availableModels[0];
        break;
      default:
        selectedModel = this.selectByWeight(availableModels);
    }

    return selectedModel;
  }

  /**
   * 权重选择算法
   * @param models 模型列表
   * @returns {Model} 选中的模型
   */
  private selectByWeight(models: Model[]): Model {
    const totalWeight = models.reduce((sum, m) => sum + m.weight, 0);
    let random = Math.random() * totalWeight;

    for (const model of models) {
      random -= model.weight;
      if (random <= 0) {
        return model;
      }
    }

    return models[0];
  }

  /**
   * 随机选择算法
   * @param models 模型列表
   * @returns {Model} 选中的模型
   */
  private selectByRandom(models: Model[]): Model {
    const index = Math.floor(Math.random() * models.length);
    return models[index];
  }

  /**
   * 轮询选择算法
   * @param modelType 模型类型
   * @param models 模型列表
   * @returns {Model} 选中的模型
   */
  private selectByRoundRobin(modelType: string, models: Model[]): Model {
    const counter = this.roundRobinCounters.get(modelType) || 0;
    const index = counter % models.length;
    this.roundRobinCounters.set(modelType, counter + 1);
    return models[index];
  }

  /**
   * 检查熔断状态
   * @param modelId 模型ID
   * @returns {Promise<boolean>} 是否可以调用
   */
  async checkCircuit(modelId: string): Promise<boolean> {
    const rule = await this.getRule(modelId);
    const strategy = await this.prisma.mcpStrategy.findFirst();

    if (!strategy?.enableCircuit) {
      return true;
    }

    if (rule.circuitStatus === CircuitStatus.OPEN) {
      // 检查是否可以进入半开状态
      const circuitOpenTime = rule.circuitOpenTime?.getTime() || 0;
      const now = Date.now();
      if (now - circuitOpenTime >= strategy.circuitTimeout) {
        await this.prisma.mcpRule.update({
          where: { id: rule.id },
          data: {
            circuitStatus: CircuitStatus.HALF_OPEN,
          },
        });
        return true;
      }
      throw new HttpException('模型熔断中', HttpStatus.SERVICE_UNAVAILABLE);
    }

    return true;
  }

  /**
   * 报告模型错误
   * @param modelId 模型ID
   * @returns {Promise<void>}
   */
  async reportError(modelId: string): Promise<void> {
    const rule = await this.getRule(modelId);
    const strategy = await this.prisma.mcpStrategy.findFirst();

    const errorCount = rule.errorCount + 1;
    const updateData: Record<string, unknown> = {
      errorCount,
      lastErrorTime: new Date(),
    };

    // 检查是否需要熔断
    if (strategy?.enableCircuit && errorCount >= (strategy.circuitThreshold || 5)) {
      updateData.circuitStatus = CircuitStatus.OPEN;
      updateData.circuitOpenTime = new Date();
      console.warn(`模型 ${modelId} 触发熔断`);
    }

    await this.prisma.mcpRule.update({
      where: { id: rule.id },
      data: updateData,
    });
  }

  /**
   * 报告模型成功
   * @param modelId 模型ID
   * @returns {Promise<void>}
   */
  async reportSuccess(modelId: string): Promise<void> {
    const rule = await this.getRule(modelId);

    const updateData: Record<string, unknown> = {
      errorCount: 0,
    };

    // 如果是半开状态，恢复为关闭状态
    if (rule.circuitStatus === CircuitStatus.HALF_OPEN) {
      updateData.circuitStatus = CircuitStatus.CLOSED;
      console.log(`模型 ${modelId} 熔断恢复`);
    }

    await this.prisma.mcpRule.update({
      where: { id: rule.id },
      data: updateData,
    });
  }

  /**
   * 检查并发限制
   * @param modelId 模型ID
   * @returns {Promise<boolean>} 是否可以执行
   */
  async checkConcurrency(modelId: string): Promise<boolean> {
    const rule = await this.getRule(modelId);

    if (rule.currentConcurrent >= rule.maxConcurrent) {
      throw new HttpException('模型并发数已满', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 增加并发计数
    await this.prisma.mcpRule.update({
      where: { id: rule.id },
      data: {
        currentConcurrent: rule.currentConcurrent + 1,
      },
    });

    return true;
  }

  /**
   * 释放并发计数
   * @param modelId 模型ID
   * @returns {Promise<void>}
   */
  async releaseConcurrency(modelId: string): Promise<void> {
    const rule = await this.getRule(modelId);

    if (rule.currentConcurrent > 0) {
      await this.prisma.mcpRule.update({
        where: { id: rule.id },
        data: {
          currentConcurrent: rule.currentConcurrent - 1,
        },
      });
    }
  }

  /**
   * 获取所有熔断规则
   * @returns {Promise<Array>} 所有规则列表
   */
  async getAllRules() {
    return this.prisma.mcpRule.findMany({
      include: {
        model: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });
  }

  /**
   * 手动重置熔断状态
   * @param modelId 模型ID
   * @returns {Promise<Object>} 更新后的规则
   */
  async resetCircuit(modelId: string) {
    const rule = await this.getRule(modelId);

    return this.prisma.mcpRule.update({
      where: { id: rule.id },
      data: {
        circuitStatus: CircuitStatus.CLOSED,
        errorCount: 0,
        circuitOpenTime: null,
      },
    });
  }

  /**
   * 删除熔断规则
   * @param modelId 模型ID
   * @returns {Promise<Object>} 删除的规则
   */
  async deleteRule(modelId: string) {
    const rule = await this.prisma.mcpRule.findFirst({
      where: { modelId: modelId as any },
    });

    if (!rule) {
      throw new HttpException('规则不存在', HttpStatus.NOT_FOUND);
    }

    return this.prisma.mcpRule.delete({
      where: { id: rule.id },
    });
  }

  /**
   * 获取所有模型状态
   * @returns {Promise<Array>} 模型状态列表
   */
  async getAllModelStatus() {
    const models = await this.prisma.model.findMany();
    const statuses = [];

    // 获取策略配置
    const strategy = await this.prisma.mcpStrategy.findFirst();
    const circuitTimeout = strategy?.circuitTimeout || 300000;

    // 计算最近60秒的时间点
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    for (const model of models) {
      const rule = await this.getRule(model.id as any);
      
      // 查询最近60秒内的成功调用次数
      const successCount = await this.prisma.aiInvokeLog.count({
        where: {
          modelId: model.id,
          success: true,
          createdAt: {
            gte: oneMinuteAgo,
          },
        },
      });

      // 查询最近60秒内的失败调用次数
      const failureCount = await this.prisma.aiInvokeLog.count({
        where: {
          modelId: model.id as any,
          success: false,
          createdAt: {
            gte: oneMinuteAgo,
          },
        },
      });

      // 计算下次重试时间（仅在熔断开启状态）
      let nextRetryTime: string | undefined;
      if (rule.circuitStatus === CircuitStatus.OPEN && rule.circuitOpenTime) {
        const retryTime = new Date(rule.circuitOpenTime.getTime() + circuitTimeout);
        if (retryTime > new Date()) {
          nextRetryTime = retryTime.toISOString();
        }
      }

      statuses.push({
        modelId: model.id,
        modelCode: model.code,
        modelName: model.name,
        status: model.status,
        circuitStatus: rule.circuitStatus,
        errorCount: rule.errorCount,
        currentConcurrent: rule.currentConcurrent,
        maxConcurrent: rule.maxConcurrent,
        qpsLimit: rule.qpsLimit,
        lastErrorTime: rule.lastErrorTime?.toISOString(),
        circuitOpenTime: rule.circuitOpenTime?.toISOString(),
        nextRetryTime,
        successCount,
        failureCount,
      });
    }

    return statuses;
  }
}
