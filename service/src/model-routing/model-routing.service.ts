import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { ModelService } from "../model/model.service";
import { IntentRoutingLogService } from "../intent/routing-log/routing-log.service";
import {
  CreateModelRoutingStrategyDto,
  UpdateModelRoutingStrategyDto,
  CreateModelRoutingRuleDto,
  UpdateModelRoutingRuleDto,
  StrategyType,
  CircuitStatus,
} from "./dto/model-routing.dto";
import { INTENT_TO_MODEL_TYPE, INTENT_TO_CAPABILITY } from "../intent/dto/intent.dto";
import { Model } from "@prisma/client";

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
      throw new HttpException("策略不存在", HttpStatus.NOT_FOUND);
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
   * 根据模型ID获取对应的策略配置
   * @param modelId 模型ID
   * @returns {Promise<Object|null>} 策略配置，模型不存在时返回null
   */
  private async getStrategyByModelId(modelId: string) {
    const model = await this.prisma.model.findUnique({
      where: { id: modelId as any },
      select: { type: true },
    });
    if (!model) return null;
    return this.prisma.modelRoutingStrategy.findUnique({
      where: { modelType: model.type },
    });
  }

  /**
   * 获取所有模型路由策略
   * @returns {Promise<Object[]> 策略列表
   */
  async getAllStrategies() {
    return this.prisma.modelRoutingStrategy.findMany({
      orderBy: { createdAt: "desc" },
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
  async upsertRule(
    modelId: string,
    dto: CreateModelRoutingRuleDto | UpdateModelRoutingRuleDto,
  ) {
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
      return this.createRule({ modelId: modelId as any, ...dto });
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
      rule = await this.createRule({ modelId: modelId as any });
    }

    return rule;
  }

  /**
   * 根据策略选择最优模型
   * @param modelType 模型类型
   * @returns {Promise<Model>} 选中的模型
   */
  async selectModel(modelType: string): Promise<Model> {
    const startTime = Date.now();
    const strategy = await this.getStrategy(modelType);
    const models = await this.modelService.getAvailableModels(modelType);

    if (!models.length) {
      this.routingLogService
        .log({
          userMessage: "",
          detectedIntent: modelType,
          confidence: 1.0,
          source: "auto",
          modelType,
          isDegraded: false,
          costMs: Date.now() - startTime,
          success: false,
          errorMessage: "无可用模型",
        })
        .catch(() => {});
      throw new HttpException("无可用模型", HttpStatus.SERVICE_UNAVAILABLE);
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
          const fallbackModel = await this.modelService.findOne(
            strategy.fallbackModelId,
          );
          this.routingLogService
            .log({
              userMessage: "",
              detectedIntent: modelType,
              confidence: 1.0,
              source: "auto",
              selectedModelId: Number(fallbackModel.id),
              selectedModelCode: fallbackModel.code,
              modelType,
              isDegraded: true,
              degradeReason: "所有模型熔断，使用降级模型",
              costMs: Date.now() - startTime,
              success: true,
            })
            .catch(() => {});
          return fallbackModel;
        } catch {
          this.logger.warn(
            `降级模型 ${strategy.fallbackModelId} 不可用，尝试兜底模型`,
          );
        }
      }

      // 兜底逻辑：尝试使用第一个可用模型（忽略熔断状态）
      if (models.length > 0) {
        const fallbackModel = models[0];
        this.logger.warn(`所有模型熔断，使用兜底模型: ${fallbackModel.code}`);
        this.routingLogService
          .log({
            userMessage: "",
            detectedIntent: modelType,
            confidence: 1.0,
            source: "auto",
            selectedModelId: Number(fallbackModel.id),
            selectedModelCode: fallbackModel.code,
            modelType,
            isDegraded: true,
            degradeReason: "所有模型熔断，使用兜底模型",
            costMs: Date.now() - startTime,
            success: true,
          })
          .catch(() => {});
        return fallbackModel;
      }

      this.routingLogService
        .log({
          userMessage: "",
          detectedIntent: modelType,
          confidence: 1.0,
          source: "auto",
          modelType,
          isDegraded: true,
          degradeReason: "所有模型不可用",
          costMs: Date.now() - startTime,
          success: false,
          errorMessage: "所有模型不可用",
        })
        .catch(() => {});
      throw new HttpException("所有模型不可用", HttpStatus.SERVICE_UNAVAILABLE);
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

    // 记录路由日志
    this.routingLogService
      .log({
        userMessage: "",
        detectedIntent: modelType,
        confidence: 1.0,
        source: "auto",
        selectedModelId: Number(selectedModel.id),
        selectedModelCode: selectedModel.code,
        modelType,
        isDegraded: false,
        costMs: Date.now() - startTime,
        success: true,
      })
      .catch(() => {});

    this.logger.log(
      `模型调度: modelType=${modelType}, selected=${selectedModel.code}`,
    );
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
   * 支持 Omni 模型优先调度 + 专用模型降级
   * 所有模型统一通过 capabilities 进行能力匹配
   * 
   * @param modelType 调用方传入的模型类型（兜底用）
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

    // 1. 指定模型能力校验（用户指定的模型优先级最高）
    if (specifiedModelCode) {
      try {
        const model = await this.modelService.findByCode(specifiedModelCode);
        if (this.isModelCompatibleForIntent(model, intent)) {
          this.routingLogService
            .log({
              userMessage: "",
              detectedIntent: intent,
              confidence: 1.0,
              source: "specified",
              selectedModelId: Number(model.id),
              selectedModelCode: model.code,
              modelType,
              isDegraded: false,
              costMs: Date.now() - startTime,
              success: true,
            })
            .catch(() => {});
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

    // 2. 获取意图的模型类型优先级列表
    const preferredTypes = INTENT_TO_MODEL_TYPE[intent] || [modelType];

    // 3. 按优先级遍历类型
    for (const preferredType of preferredTypes) {
      let models = await this.modelService.getAvailableModels(preferredType);
      if (!models.length) continue;

      // 按能力筛选（所有类型统一走 capabilities）
      models = this.filterByIntent(models, intent, preferredType);
      if (!models.length) continue;

      // 过滤熔断模型
      const strategy = await this.getStrategy(preferredType);
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
            const fallbackModel = await this.modelService.findOne(
              strategy.fallbackModelId,
            );
            if (preferredType !== preferredTypes[0]) {
              isDegraded = true;
              degradeReason = `首选类型 ${preferredTypes[0]} 不可用，降级至 ${fallbackModel.code}`;
            }
            this.routingLogService
              .log({
                userMessage: "",
                detectedIntent: intent,
                confidence: 1.0,
                source: "auto",
                selectedModelId: Number(fallbackModel.id),
                selectedModelCode: fallbackModel.code,
                modelType,
                isDegraded: true,
                degradeReason: "所有模型熔断，使用降级模型",
                costMs: Date.now() - startTime,
                success: true,
              })
              .catch(() => {});
            return fallbackModel;
          } catch {
            this.logger.warn(
              `降级模型 ${strategy.fallbackModelId} 不可用，尝试兜底模型`,
            );
          }
        }

        // 兜底逻辑：尝试使用第一个可用模型（忽略熔断状态）
        if (models.length > 0) {
          const fallbackModel = models[0];
          this.logger.warn(`所有模型熔断，使用兜底模型: ${fallbackModel.code}`);
          if (preferredType !== preferredTypes[0]) {
            isDegraded = true;
            degradeReason = `首选类型 ${preferredTypes[0]} 不可用，降级至 ${fallbackModel.code}`;
          }
          this.routingLogService
            .log({
              userMessage: "",
              detectedIntent: intent,
              confidence: 1.0,
              source: "auto",
              selectedModelId: Number(fallbackModel.id),
              selectedModelCode: fallbackModel.code,
              modelType,
              isDegraded: true,
              degradeReason: "所有模型熔断，使用兜底模型",
              costMs: Date.now() - startTime,
              success: true,
            })
            .catch(() => {});
          return fallbackModel;
        }

        continue;
      }

      // 按策略选择
      let selectedModel: Model;
      switch (strategy.strategy) {
        case StrategyType.WEIGHT:
          selectedModel = this.selectByWeight(availableModels);
          break;
        case StrategyType.RANDOM:
          selectedModel = this.selectByRandom(availableModels);
          break;
        case StrategyType.ROUND_ROBIN:
          selectedModel = this.selectByRoundRobin(preferredType, availableModels);
          break;
        case StrategyType.FAILOVER:
          selectedModel = availableModels[0];
          break;
        default:
          selectedModel = this.selectByWeight(availableModels);
      }

      // 记录降级信息
      if (isDegraded || preferredType !== preferredTypes[0]) {
        isDegraded = true;
        degradeReason = degradeReason
          ? `${degradeReason}，自动调度切换至 ${selectedModel.code}`
          : `首选类型 ${preferredTypes[0]} 不可用，降级至 ${selectedModel.code}`;
      }

      this.routingLogService
        .log({
          userMessage: "",
          detectedIntent: intent,
          confidence: 1.0,
          source: "auto",
          selectedModelId: Number(selectedModel.id),
          selectedModelCode: selectedModel.code,
          modelType,
          isDegraded,
          degradeReason,
          costMs: Date.now() - startTime,
          success: true,
        })
        .catch(() => {});

      this.logger.log(
        `意图调度: intent=${intent}, modelType=${preferredType}, selected=${selectedModel.code}`,
      );
      return selectedModel;
    }

    // 4. 全部不可用 → 报错
    this.routingLogService
      .log({
        userMessage: "",
        detectedIntent: intent,
        confidence: 1.0,
        source: "auto",
        modelType,
        isDegraded,
        degradeReason: degradeReason || "无可用模型",
        costMs: Date.now() - startTime,
        success: false,
        errorMessage: "无可用模型",
      })
      .catch(() => {});
    throw new HttpException("无可用模型", HttpStatus.SERVICE_UNAVAILABLE);
  }

  /**
   * 检查指定模型是否与意图兼容
   * 用于用户指定模型场景的校验，所有类型统一走 capabilities
   * 
   * @param model 模型信息
   * @param intent 对话意图
   * @returns {boolean} 是否兼容
   */
  private isModelCompatibleForIntent(model: Model, intent: string): boolean {
    const requiredCaps = INTENT_TO_CAPABILITY[intent];
    if (!requiredCaps || requiredCaps.length === 0) return true;

    // image/tts/asr/s2s/embedding 类型：type 匹配即可，capabilities 非硬性
    if (['image', 'tts', 'asr', 'embedding', 's2s'].includes(model.type)) {
      return model.type === intent;
    }

    // llm/lmm/omni 类型：严格按 capabilities 校验
    return this.hasRequiredCapabilities(model, requiredCaps);
  }

  /**
   * 检查模型是否支持指定意图（含能力过滤）
   * 用于自动调度时的严格校验
   * 
   * @param model 模型信息
   * @param intent 对话意图
   * @param modelType 模型技术类型
   * @returns {boolean} 是否支持
   */
  modelSupportsIntent(
    model: Model,
    intent: string,
    modelType: string,
  ): boolean {
    if (intent === "general") return true;

    const requiredCaps = INTENT_TO_CAPABILITY[intent];
    if (!requiredCaps || requiredCaps.length === 0) return true;

    // image/tts/asr/s2s 类型：type 匹配即可
    if (['image', 'tts', 'asr', 'embedding', 's2s'].includes(intent)) {
      return model.type === intent;
    }

    // llm/lmm/omni 类型：按 capabilities 校验
    if (modelType === 'llm' || modelType === 'lmm' || modelType === 'omni') {
      return this.hasRequiredCapabilities(model, requiredCaps);
    }

    return true;
  }

  /**
   * 按能力筛选模型列表
   * 
   * 所有模型类型统一通过 capabilities 进行能力匹配。
   * image/tts/asr/s2s/embedding 类型：capabilities 不作为硬性要求，type 本身已足够表达意图
   * llm/lmm/omni 类型：严格按 capabilities 匹配
   * 
   * @param models 模型列表
   * @param intent 对话意图
   * @param modelType 模型技术类型
   * @returns {Model[]} 筛选后的模型列表
   */
  filterByIntent(models: Model[], intent: string, modelType: string): Model[] {
    if (intent === 'general') return models;

    const requiredCaps = INTENT_TO_CAPABILITY[intent] || [];
    if (requiredCaps.length === 0) return models;

    // image/tts/asr/s2s/embedding 类型：type 已足够表达意图
    if (['image', 'tts', 'asr', 'embedding', 's2s'].includes(modelType)) {
      return models;
    }

    // llm/lmm/omni 类型：严格按 capabilities 能力匹配
    const filtered = models.filter(m => this.hasRequiredCapabilities(m, requiredCaps));

    // 如果没有精确匹配，回退到所有模型（兜底）
    if (filtered.length === 0) {
      this.logger.warn(`意图 ${intent} 无能力匹配的模型，回退到全部可用模型`);
      return models;
    }

    return filtered;
  }

  /**
   * 检查模型是否具备所需能力
   * 
   * @param model 模型信息
   * @param requiredCapabilities 所需能力列表
   * @returns {boolean} 是否具备全部所需能力
   */
  private hasRequiredCapabilities(model: Model, requiredCapabilities: string[]): boolean {
    if (!model.capabilities) {
      return true;
    }

    try {
      const declaredCaps = JSON.parse(model.capabilities) as string[];
      return requiredCapabilities.every(cap => declaredCaps.includes(cap));
    } catch {
      this.logger.warn(`模型 ${model.code} 的 capabilities 格式无效: ${model.capabilities}`);
      return true;
    }
  }

  /**
   * 检查熔断状态
   * @param modelId 模型ID
   * @returns {Promise<boolean>} 是否可以调用
   */
  async checkCircuit(modelId: string): Promise<boolean> {
    const rule = await this.getRule(modelId);
    const strategy = await this.getStrategyByModelId(modelId);

    if (!strategy?.enableCircuit) {
      return true;
    }

    if (rule.circuitStatus === CircuitStatus.OPEN) {
      const circuitOpenTime = rule.circuitOpenTime?.getTime() || 0;
      const now = Date.now();
      if (now - circuitOpenTime >= strategy.circuitTimeout) {
        // 原子更新，防止多个并发请求同时设为 HALF_OPEN
        const result = await this.prisma.modelRoutingRule.updateMany({
          where: {
            id: rule.id,
            circuitStatus: CircuitStatus.OPEN,
          },
          data: {
            circuitStatus: CircuitStatus.HALF_OPEN,
          },
        });

        if (result.count > 0) {
          this.logger.log(`模型 ${modelId} 熔断超时，进入半开探测状态`);
        }
        return true;
      }
      throw new HttpException("模型熔断中", HttpStatus.SERVICE_UNAVAILABLE);
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
    const strategy = await this.getStrategyByModelId(modelId);

    const updateData: Record<string, unknown> = {
      lastErrorTime: new Date(),
    };

    // HALF_OPEN 状态下失败，立即重新熔断
    if (rule.circuitStatus === CircuitStatus.HALF_OPEN) {
      updateData.circuitStatus = CircuitStatus.OPEN;
      updateData.circuitOpenTime = new Date();
      updateData.errorCount = rule.errorCount + 1;
      this.logger.warn(`模型 ${modelId} 半开探测失败，立即重新熔断`);
    } else {
      const errorCount = rule.errorCount + 1;
      updateData.errorCount = errorCount;

      // 检查是否需要熔断
      if (
        strategy?.enableCircuit &&
        errorCount >= (strategy.circuitThreshold || 5)
      ) {
        updateData.circuitStatus = CircuitStatus.OPEN;
        updateData.circuitOpenTime = new Date();
        this.logger.warn(`模型 ${modelId} 触发熔断，错误次数: ${errorCount}`);
      }
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

    const updateData: Record<string, unknown> = {};

    // 半开状态恢复为关闭状态，重置错误计数
    if (rule.circuitStatus === CircuitStatus.HALF_OPEN) {
      updateData.circuitStatus = CircuitStatus.CLOSED;
      updateData.errorCount = 0;
      this.logger.log(`模型 ${modelId} 半开探测成功，熔断恢复`);
    }
    // CLOSED 状态下不重置 errorCount，维持错误累积计数

    await this.prisma.modelRoutingRule.update({
      where: { id: rule.id },
      data: updateData,
    });
  }

  /**
   * 检查并发限制（原子操作，避免竞态条件）
   * @param modelId 模型ID
   * @returns {Promise<boolean>} 是否可以执行
   */
  async checkConcurrency(modelId: string): Promise<boolean> {
    const rule = await this.getRule(modelId);

    // 使用 updateMany 原子操作：仅当 currentConcurrent < maxConcurrent 时才递增
    const result = await this.prisma.modelRoutingRule.updateMany({
      where: {
        id: rule.id,
        currentConcurrent: { lt: rule.maxConcurrent },
      },
      data: {
        currentConcurrent: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new HttpException("模型并发数已满", HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  /**
   * 释放并发计数（原子操作，避免竞态条件）
   * @param modelId 模型ID
   * @returns {Promise<void>}
   */
  async releaseConcurrency(modelId: string): Promise<void> {
    const rule = await this.getRule(modelId);

    // 原子递减，仅在 currentConcurrent > 0 时执行
    await this.prisma.modelRoutingRule.updateMany({
      where: {
        id: rule.id,
        currentConcurrent: { gt: 0 },
      },
      data: {
        currentConcurrent: { decrement: 1 },
      },
    });
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
      throw new HttpException("规则不存在", HttpStatus.NOT_FOUND);
    }

    return this.prisma.modelRoutingRule.delete({
      where: { id: rule.id },
    });
  }

  /**
   * 获取所有模型状态（批量查询优化）
   * @returns {Promise<Array>} 模型状态列表
   */
  async getAllModelStatus() {
    const models = await this.prisma.model.findMany();
    const modelIds = models.map((m) => m.id);

    // 批量获取所有路由规则
    const allRules = await this.prisma.modelRoutingRule.findMany({
      where: { modelId: { in: modelIds as any } },
    });
    const ruleMap = new Map<bigint, (typeof allRules)[number]>();
    for (const rule of allRules) {
      ruleMap.set(rule.modelId, rule);
    }

    // 按模型类型获取策略
    const modelTypes = [...new Set(models.map((m) => m.type))];
    const allStrategies = await this.prisma.modelRoutingStrategy.findMany({
      where: { modelType: { in: modelTypes } },
    });
    const strategyMap = new Map<string, (typeof allStrategies)[number]>();
    for (const s of allStrategies) {
      strategyMap.set(s.modelType, s);
    }

    // 计算最近60秒的时间点
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // 批量获取最近60秒统计数据
    const successStats = await this.prisma.aiInvokeLog.groupBy({
      by: ["modelId"],
      where: {
        modelId: { in: modelIds as any },
        success: true,
        createdAt: { gte: oneMinuteAgo },
      },
      _count: { id: true },
    });

    const failureStats = await this.prisma.aiInvokeLog.groupBy({
      by: ["modelId"],
      where: {
        modelId: { in: modelIds as any },
        success: false,
        createdAt: { gte: oneMinuteAgo },
      },
      _count: { id: true },
    });

    const successMap = new Map<bigint | null, number>();
    for (const s of successStats) {
      successMap.set(s.modelId, s._count.id);
    }

    const failureMap = new Map<bigint | null, number>();
    for (const s of failureStats) {
      failureMap.set(s.modelId, s._count.id);
    }

    const statuses = [];

    for (const model of models) {
      const rule = ruleMap.get(model.id);
      const strategy = strategyMap.get(model.type);
      const circuitTimeout = strategy?.circuitTimeout || 300000;

      const successCount = successMap.get(model.id) || 0;
      const failureCount = failureMap.get(model.id) || 0;

      // 计算下次重试时间（仅在熔断开启状态）
      let nextRetryTime: string | undefined;
      if (rule?.circuitStatus === CircuitStatus.OPEN && rule?.circuitOpenTime) {
        const retryTime = new Date(
          rule.circuitOpenTime.getTime() + circuitTimeout,
        );
        if (retryTime > new Date()) {
          nextRetryTime = retryTime.toISOString();
        }
      }

      statuses.push({
        modelId: model.id,
        modelCode: model.code,
        modelName: model.name,
        status: model.status,
        circuitStatus: rule?.circuitStatus || "closed",
        errorCount: rule?.errorCount || 0,
        currentConcurrent: rule?.currentConcurrent || 0,
        maxConcurrent: rule?.maxConcurrent || 5,
        qpsLimit: rule?.qpsLimit || 10,
        lastErrorTime: rule?.lastErrorTime?.toISOString(),
        circuitOpenTime: rule?.circuitOpenTime?.toISOString(),
        nextRetryTime,
        successCount,
        failureCount,
      });
    }

    return statuses;
  }
}
