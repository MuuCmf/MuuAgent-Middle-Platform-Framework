import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ModelService } from '../model/model.service';
import { IntentClassifierService } from '../intent/intent.service';
import { IntentRoutingLogService } from '../intent/routing-log/routing-log.service';
import {
  CreateModelRoutingStrategyDto,
  UpdateModelRoutingStrategyDto,
  CreateModelRoutingRuleDto,
  UpdateModelRoutingRuleDto,
  StrategyType,
  CircuitStatus,
} from './dto/model-routing.dto';
import { Model } from '@prisma/client';

/**
 * 模型路由调度核心服务
 * 负责模型路由、限流、熔断、降级
 */
@Injectable()
export class ModelRoutingService {
  /** 轮询计数器 */
  private roundRobinCounters: Map<string, number> = new Map();
  /** 日志器 */
  private readonly logger = new Logger(ModelRoutingService.name);

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param modelService 模型服务
   * @param intentClassifier 意图分类服务
   */
  constructor(
    private prisma: PrismaService,
    private modelService: ModelService,
    private intentClassifier: IntentClassifierService,
    private routingLogService: IntentRoutingLogService,
  ) {}

  /**
   * 创建模型路由策略
   * @param dto 创建策略DTO
   * @returns {Promise<Object>} 创建的策略
   */
  async createStrategy(dto: CreateModelRoutingStrategyDto) {
    return this.prisma.modelRoutingStrategy.create({
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
   * 更新模型路由策略
   * @param modelType 模型类型
   * @param dto 更新策略DTO
   * @returns {Promise<Object>} 更新后的策略
   */
  async updateStrategy(modelType: string, dto: UpdateModelRoutingStrategyDto) {
    const strategy = await this.prisma.modelRoutingStrategy.findUnique({
      where: { modelType },
    });
    if (!strategy) {
      throw new HttpException('策略不存在', HttpStatus.NOT_FOUND);
    }

    return this.prisma.modelRoutingStrategy.update({
      where: { modelType },
      data: dto,
    });
  }

  /**
   * 获取模型路由策略
   * @param modelType 模型类型
   * @returns {Promise<Object>} 策略详情
   */
  async getStrategy(modelType: string) {
    let strategy = await this.prisma.modelRoutingStrategy.findUnique({
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
   * 获取所有模型路由策略
   * @returns {Promise<Object[]> 策略列表
   */
  async getAllStrategies() {
    return this.prisma.modelRoutingStrategy.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 创建模型路由规则
   * @param dto 创建规则DTO
   * @returns {Promise<Object>} 创建的规则
   */
  async createRule(dto: CreateModelRoutingRuleDto) {
    return this.prisma.modelRoutingRule.create({
      data: {
        modelId: dto.modelId as any,
        qpsLimit: dto.qpsLimit ?? 10,
        maxConcurrent: dto.maxConcurrent ?? 5,
      },
    });
  }

  /**
   * 创建或更新模型路由规则
   * @param modelId 模型ID
   * @param dto 规则DTO
   * @returns {Promise<Object>} 创建或更新后的规则
   */
  async upsertRule(modelId: string, dto: CreateModelRoutingRuleDto | UpdateModelRoutingRuleDto) {
    const existingRule = await this.prisma.modelRoutingRule.findFirst({
      where: { modelId: modelId as any },
    });

    if (existingRule) {
      return this.prisma.modelRoutingRule.update({
        where: { id: existingRule.id },
        data: {
          qpsLimit: dto.qpsLimit ?? existingRule.qpsLimit,
          maxConcurrent: dto.maxConcurrent ?? existingRule.maxConcurrent,
        },
      });
    }

    return this.prisma.modelRoutingRule.create({
      data: {
        modelId: modelId as any,
        qpsLimit: dto.qpsLimit ?? 10,
        maxConcurrent: dto.maxConcurrent ?? 5,
      },
    });
  }

  /**
   * 更新模型路由规则
   * @param modelId 模型ID
   * @param dto 更新规则DTO
   * @returns {Promise<Object>} 更新后的规则
   */
  async updateRule(modelId: string, dto: UpdateModelRoutingRuleDto) {
    const rule = await this.prisma.modelRoutingRule.findFirst({
      where: { modelId: modelId as any },
    });
    if (!rule) {
      return this.createRule({ modelId : modelId as any, ...dto });
    }

    return this.prisma.modelRoutingRule.update({
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
    let rule = await this.prisma.modelRoutingRule.findFirst({
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
          this.logger.warn(`降级模型 ${strategy.fallbackModelId} 不可用，尝试兜底模型`);
        }
      }

      // 兜底逻辑：尝试使用第一个可用模型（忽略熔断状态）
      if (models.length > 0) {
        this.logger.warn(`所有模型熔断，使用兜底模型: ${models[0].code}`);
        return models[0];
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
   * 根据意图选择最优模型
   * @param modelType 模型技术类型
   * @param intent 对话意图
   * @param specifiedModelCode 用户指定的模型代码（可选）
   * @returns {Promise<Model>} 选中的模型
   */
  async selectModelByIntent(
    modelType: string,
    intent: string,
    specifiedModelCode?: string,
  ): Promise<Model> {
    const startTime = Date.now();
    let isDegraded = false;
    let degradeReason: string | undefined;

    // 1. 指定模型能力校验
    if (specifiedModelCode) {
      try {
        const model = await this.modelService.findByCode(specifiedModelCode);
        if (this.modelSupportsIntent(model, intent, modelType)) {
          // 记录路由日志
          this.routingLogService.log({
            userMessage: '',
            detectedIntent: intent,
            confidence: 1.0,
            source: 'specified',
            selectedModelId: Number(model.id),
            selectedModelCode: model.code,
            modelType,
            isDegraded: false,
            costMs: Date.now() - startTime,
            success: true,
          }).catch(() => {});
          return model;
        }
        isDegraded = true;
        degradeReason = `指定模型 ${specifiedModelCode} 不支持意图 ${intent}`;
        this.logger.warn(degradeReason);
      } catch {
        isDegraded = true;
        degradeReason = `指定模型 ${specifiedModelCode} 不存在`;
        this.logger.warn(degradeReason);
      }
    }

    // 2. 获取可用模型
    const strategy = await this.getStrategy(modelType);
    let models = await this.modelService.getAvailableModels(modelType);

    if (!models.length) {
      // 记录失败日志
      this.routingLogService.log({
        userMessage: '',
        detectedIntent: intent,
        confidence: 1.0,
        source: 'auto',
        modelType,
        isDegraded,
        degradeReason: degradeReason || '无可用模型',
        costMs: Date.now() - startTime,
        success: false,
        errorMessage: '无可用模型',
      }).catch(() => {});
      throw new HttpException('无可用模型', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // 3. 按意图筛选模型
    models = this.filterByIntent(models, intent, modelType);

    // 4. 过滤熔断模型
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
          const fallbackModel = await this.modelService.findOne(strategy.fallbackModelId);
          this.routingLogService.log({
            userMessage: '',
            detectedIntent: intent,
            confidence: 1.0,
            source: 'auto',
            selectedModelId: Number(fallbackModel.id),
            selectedModelCode: fallbackModel.code,
            modelType,
            isDegraded: true,
            degradeReason: '所有模型熔断，使用降级模型',
            costMs: Date.now() - startTime,
            success: true,
          }).catch(() => {});
          return fallbackModel;
        } catch {
          this.logger.warn(`降级模型 ${strategy.fallbackModelId} 不可用，尝试兜底模型`);
        }
      }

      // 兜底逻辑：尝试使用第一个可用模型（忽略熔断状态）
      if (models.length > 0) {
        const fallbackModel = models[0];
        this.logger.warn(`所有模型熔断，使用兜底模型: ${fallbackModel.code}`);
        this.routingLogService.log({
          userMessage: '',
          detectedIntent: intent,
          confidence: 1.0,
          source: 'auto',
          selectedModelId: Number(fallbackModel.id),
          selectedModelCode: fallbackModel.code,
          modelType,
          isDegraded: true,
          degradeReason: '所有模型熔断，使用兜底模型',
          costMs: Date.now() - startTime,
          success: true,
        }).catch(() => {});
        return fallbackModel;
      }

      this.routingLogService.log({
        userMessage: '',
        detectedIntent: intent,
        confidence: 1.0,
        source: 'auto',
        modelType,
        isDegraded: true,
        degradeReason: '所有模型不可用',
        costMs: Date.now() - startTime,
        success: false,
        errorMessage: '所有模型不可用',
      }).catch(() => {});
      throw new HttpException('所有模型不可用', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // 5. 按策略选择模型
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

    // 记录路由日志
    this.routingLogService.log({
      userMessage: '',
      detectedIntent: intent,
      confidence: 1.0,
      source: 'auto',
      selectedModelId: Number(selectedModel.id),
      selectedModelCode: selectedModel.code,
      modelType,
      isDegraded,
      degradeReason,
      costMs: Date.now() - startTime,
      success: true,
    }).catch(() => {});

    this.logger.log(`意图调度: intent=${intent}, modelType=${modelType}, selected=${selectedModel.code}`);
    return selectedModel;
  }

  /**
   * 检查模型是否支持指定意图
   * @param model 模型信息
   * @param intent 对话意图
   * @param modelType 模型技术类型
   * @returns {boolean} 是否支持
   */
  modelSupportsIntent(model: Model, intent: string, modelType: string): boolean {
    // image/tts/asr/embedding 类型：意图必须与模型类型匹配
    if (['image', 'tts', 'asr', 'embedding'].includes(intent)) {
      return model.type === intent;
    }

    // llm/multimodal 类型：检查 category 匹配
    if (modelType === 'llm' || modelType === 'multimodal') {
      // general 分类的模型支持所有意图
      if (!model.category || model.category === 'general') return true;
      // 精确匹配
      return model.category === intent;
    }

    return true;
  }

  /**
   * 按意图筛选模型列表
   * @param models 模型列表
   * @param intent 对话意图
   * @param modelType 模型技术类型
   * @returns {Model[]} 筛选后的模型列表
   */
  filterByIntent(models: Model[], intent: string, modelType: string): Model[] {
    // image/tts/asr 等特殊类型不需要按 category 筛选，直接返回
    if (['image', 'tts', 'asr', 'embedding'].includes(modelType)) {
      return models;
    }

    // LLM 类型按 category 筛选
    if (modelType === 'llm' || modelType === 'multimodal') {
      const filtered = models.filter(m =>
        !m.category || m.category === 'general' || m.category === intent,
      );

      // 如果没有精确匹配，回退到所有模型
      if (filtered.length === 0) {
        this.logger.warn(`意图 ${intent} 无匹配模型，回退到所有可用模型`);
        return models;
      }

      return filtered;
    }

    return models;
  }

  /**
   * 检查熔断状态
   * @param modelId 模型ID
   * @returns {Promise<boolean>} 是否可以调用
   */
  async checkCircuit(modelId: string): Promise<boolean> {
    const rule = await this.getRule(modelId);
    const strategy = await this.prisma.modelRoutingStrategy.findFirst();

    if (!strategy?.enableCircuit) {
      return true;
    }

    if (rule.circuitStatus === CircuitStatus.OPEN) {
      // 检查是否可以进入半开状态
      const circuitOpenTime = rule.circuitOpenTime?.getTime() || 0;
      const now = Date.now();
      if (now - circuitOpenTime >= strategy.circuitTimeout) {
        await this.prisma.modelRoutingRule.update({
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
    const strategy = await this.prisma.modelRoutingStrategy.findFirst();

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

    await this.prisma.modelRoutingRule.update({
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

    await this.prisma.modelRoutingRule.update({
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
    await this.prisma.modelRoutingRule.update({
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
      await this.prisma.modelRoutingRule.update({
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
    return this.prisma.modelRoutingRule.findMany({
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

    return this.prisma.modelRoutingRule.update({
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
    const rule = await this.prisma.modelRoutingRule.findFirst({
      where: { modelId: modelId as any },
    });

    if (!rule) {
      throw new HttpException('规则不存在', HttpStatus.NOT_FOUND);
    }

    return this.prisma.modelRoutingRule.delete({
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
    const strategy = await this.prisma.modelRoutingStrategy.findFirst();
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
