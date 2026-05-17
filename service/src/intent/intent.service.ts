import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { IntentResult, INTENT_TO_MODEL_TYPE } from './dto/intent.dto';
import { DEFAULT_INTENT_KEYWORDS, KeywordRule } from './intent.keywords';
import { ModelService } from '../model/model.service';
import { PromptTemplateService } from '../prompt-template/prompt-template.service';
import * as crypto from 'crypto';
import axios from 'axios';

/**
 * 意图分类服务
 * 采用关键词快速匹配 + AI兜底的混合策略
 * AI分类使用独立HTTP调用，避免循环依赖
 * 关键词优先从数据库加载，数据库无数据时使用默认配置
 */
@Injectable()
export class IntentClassifierService implements OnModuleInit {
  private readonly logger = new Logger(IntentClassifierService.name);

  /** 运行时关键词规则缓存 */
  private keywordRules: Record<string, KeywordRule> = { ...DEFAULT_INTENT_KEYWORDS };

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param modelService 模型服务
   * @param promptTemplateService 提示词模板服务
   */
  constructor(
    private prisma: PrismaService,
    private modelService: ModelService,
    private promptTemplateService: PromptTemplateService,
  ) {}

  /**
   * 模块初始化时从数据库加载关键词
   */
  async onModuleInit() {
    await this.loadKeywordsFromDB();
  }

  /**
   * 从数据库加载关键词规则
   */
  async loadKeywordsFromDB(): Promise<void> {
    try {
      const keywords = await this.prisma.intentKeyword.findMany({
        where: { status: true },
        orderBy: [{ intent: 'asc' }, { weight: 'desc' }],
      });

      if (keywords.length === 0) {
        this.logger.log('数据库无关键词配置，使用默认关键词');
        return;
      }

      // 按意图分组构建规则
      const rules: Record<string, KeywordRule> = {};
      for (const kw of keywords) {
        if (!rules[kw.intent]) {
          rules[kw.intent] = { keywords: [], weight: 1 };
        }
        rules[kw.intent].keywords.push(kw.keyword);
        // 取最大权重作为该意图的权重
        if (kw.weight > rules[kw.intent].weight) {
          rules[kw.intent].weight = kw.weight;
        }
      }

      this.keywordRules = rules;
      this.logger.log(`从数据库加载了 ${keywords.length} 条关键词，覆盖 ${Object.keys(rules).length} 个意图`);
    } catch (error) {
      this.logger.warn(`从数据库加载关键词失败，使用默认配置: ${error}`);
    }
  }

  /**
   * 重新加载关键词（供管理端修改后调用）
   */
  async reloadKeywords(): Promise<void> {
    await this.loadKeywordsFromDB();
  }

  /**
   * 分类用户消息的意图
   * @param message 用户消息内容
   * @param useAI 是否启用AI分类（默认true）
   * @returns {Promise<IntentResult>} 意图分类结果
   */
  async classify(message: string, useAI: boolean = true): Promise<IntentResult> {
    if (!message || !message.trim()) {
      return { intent: 'general', confidence: 1.0, source: 'default' };
    }

    const trimmedMessage = message.trim();

    // 1. 检查缓存
    const cached = await this.getFromCache(trimmedMessage);
    if (cached) {
      this.logger.debug(`意图分类命中缓存: ${cached.intent}`);
      return cached;
    }

    // 2. 关键词匹配
    const keywordResult = this.matchByKeywords(trimmedMessage);
    if (keywordResult.confidence >= 0.8) {
      await this.saveToCache(trimmedMessage, keywordResult);
      this.logger.debug(`关键词匹配意图: ${keywordResult.intent} (置信度: ${keywordResult.confidence})`);
      return keywordResult;
    }

    // 3. AI分类（如果启用）
    if (useAI) {
      try {
        const aiResult = await this.classifyByAI(trimmedMessage);
        await this.saveToCache(trimmedMessage, aiResult);
        this.logger.debug(`AI分类意图: ${aiResult.intent} (置信度: ${aiResult.confidence})`);
        return aiResult;
      } catch (error) {
        this.logger.warn(`AI意图分类失败，使用关键词结果: ${error}`);
      }
    }

    // 4. 关键词有部分匹配但置信度不够，仍使用关键词结果
    if (keywordResult.confidence > 0) {
      await this.saveToCache(trimmedMessage, keywordResult);
      return keywordResult;
    }

    // 5. 默认返回 general
    const defaultResult: IntentResult = { intent: 'general', confidence: 0.5, source: 'default' };
    await this.saveToCache(trimmedMessage, defaultResult);
    return defaultResult;
  }

  /**
   * 根据意图获取对应的模型类型
   * @param intent 意图标签
   * @returns {string} 模型类型
   */
  getModelTypeForIntent(intent: string): string {
    return INTENT_TO_MODEL_TYPE[intent] || 'llm';
  }

  /**
   * 关键词匹配
   * @param message 用户消息
   * @returns {IntentResult} 匹配结果
   */
  private matchByKeywords(message: string): IntentResult {
    const scores: Record<string, number> = {};

    for (const [intent, rule] of Object.entries(this.keywordRules)) {
      let score = 0;
      for (const keyword of rule.keywords) {
        try {
          const regex = new RegExp(keyword, 'i');
          if (regex.test(message)) {
            score += rule.weight;
          }
        } catch {
          // 正则无效时使用简单包含匹配
          if (message.toLowerCase().includes(keyword.toLowerCase())) {
            score += rule.weight;
          }
        }
      }
      if (score > 0) {
        scores[intent] = score;
      }
    }

    if (Object.keys(scores).length === 0) {
      return { intent: 'general', confidence: 0, source: 'keyword' };
    }

    // 找出最高分
    let bestIntent = 'general';
    let maxScore = 0;
    for (const [intent, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestIntent = intent;
      }
    }

    // 置信度计算：单关键词命中=0.6，多关键词命中=0.8+
    const confidence = Math.min(maxScore * 0.4 + 0.4, 1.0);

    return { intent: bestIntent, confidence, source: 'keyword' };
  }

  /**
   * AI意图分类（独立HTTP调用，不依赖AiService避免循环依赖）
   * @param message 用户消息
   * @returns {Promise<IntentResult>} 分类结果
   */
  private async classifyByAI(message: string): Promise<IntentResult> {
    try {
      const availableModels = await this.modelService.getAvailableModels('llm');

      if (!availableModels || availableModels.length === 0) {
        this.logger.warn('无可用LLM模型进行意图分类，使用关键词兜底');
        const keywordResult = this.matchByKeywords(message);
        return { ...keywordResult, source: 'ai' };
      }

      const model = availableModels[0];
      const endpoint = this.resolveChatEndpoint(model);
      const apiKey = model.apiKey || process.env.OPENAI_API_KEY || '';

      this.logger.debug(`AI意图分类调用: endpoint=${endpoint}`);

      let systemPrompt: string;
      try {
        systemPrompt = await this.promptTemplateService.render('intent-classify-default', {
          userMessage: message,
        });
      } catch (error) {
        this.logger.warn(`渲染意图识别模板失败，使用默认prompt: ${error}`);
        systemPrompt = `你是一个对话意图分类助手。请分析用户消息，判断其意图类别。

意图类别定义：
- general: 通用对话、闲聊、问答
- code: 编程开发、代码编写、调试、技术问题
- math: 数学计算、公式推导、统计分析
- creative: 创意写作、文案创作、翻译润色
- image: 图像生成、绘图、图片处理
- tts: 语音合成、文字转语音、朗读
- asr: 语音识别、语音转文字

请严格按照以下JSON格式返回，不要添加任何其他内容：
{
  "intent": "意图类别",
  "confidence": 0.95
}

规则：
1. intent必须是上述类别之一
2. confidence是0-1之间的置信度
3. 如果无法确定，返回general，confidence设为0.5
4. 只返回JSON，不要有任何其他文字`;
      }

      const response = await axios.post(
        endpoint,
        {
          model: model.code,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          temperature: 0.1,
          max_tokens: 100,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          timeout: 15000,
        },
      );

      const aiResponse = response.data?.choices?.[0]?.message?.content?.trim();

      if (!aiResponse) {
        this.logger.warn('AI意图分类返回空内容');
        const keywordResult = this.matchByKeywords(message);
        return { ...keywordResult, source: 'ai' };
      }

      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('AI返回格式不正确');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        const validIntents = ['general', 'code', 'math', 'creative', 'image', 'tts', 'asr'];
        if (!parsed.intent || !validIntents.includes(parsed.intent)) {
          this.logger.warn(`AI返回无效意图: ${parsed.intent}，使用general兜底`);
          return { intent: 'general', confidence: 0.5, source: 'ai' };
        }

        return {
          intent: parsed.intent,
          confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
          source: 'ai',
        };
      } catch (parseError) {
        this.logger.error('解析AI意图分类结果失败:', parseError);
        const keywordResult = this.matchByKeywords(message);
        return { ...keywordResult, source: 'ai' };
      }
    } catch (error) {
      this.logger.error('AI意图分类调用失败:', error);
      const keywordResult = this.matchByKeywords(message);
      return { ...keywordResult, source: 'ai' };
    }
  }

  /**
   * 解析模型的 Chat Completions 端点
   * @param model 模型信息
   * @returns {string} 完整的 chat/completions URL
   */
  private resolveChatEndpoint(model: { endpoint?: string; provider?: string; code?: string }): string {
    const endpoint = model.endpoint || '';

    // 如果 endpoint 已经包含 /chat/completions，直接使用
    if (endpoint.includes('/chat/completions')) {
      return endpoint;
    }

    // 如果 endpoint 是 base URL，补全路径
    if (endpoint) {
      const base = endpoint.replace(/\/+$/, '');
      return `${base}/chat/completions`;
    }

    // 根据 provider 使用默认端点
    const provider = (model.provider || 'openai').toLowerCase();
    const defaults: Record<string, string> = {
      openai: 'https://api.openai.com/v1/chat/completions',
      deepseek: 'https://api.deepseek.com/v1/chat/completions',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      ollama: 'http://localhost:11434/api/chat',
    };

    return defaults[provider] || defaults['openai'];
  }

  /**
   * 从缓存获取意图分类结果
   * @param message 用户消息
   * @returns {Promise<IntentResult | null>} 缓存结果
   */
  private async getFromCache(message: string): Promise<IntentResult | null> {
    try {
      const messageHash = this.hashMessage(message);
      const cached = await this.prisma.intentCache.findUnique({
        where: { messageHash },
      });

      if (cached) {
        // 更新命中次数
        await this.prisma.intentCache.update({
          where: { messageHash },
          data: { hitCount: cached.hitCount + 1 },
        }).catch(() => {});

        return {
          intent: cached.intent,
          confidence: cached.confidence,
          source: cached.source as 'keyword' | 'ai' | 'default',
        };
      }
    } catch (error) {
      this.logger.warn(`读取意图缓存失败: ${error}`);
    }

    return null;
  }

  /**
   * 保存意图分类结果到缓存
   * @param message 用户消息
   * @param result 分类结果
   */
  private async saveToCache(message: string, result: IntentResult): Promise<void> {
    try {
      const messageHash = this.hashMessage(message);
      await this.prisma.intentCache.upsert({
        where: { messageHash },
        create: {
          messageHash,
          intent: result.intent,
          confidence: result.confidence,
          source: result.source,
        },
        update: {
          intent: result.intent,
          confidence: result.confidence,
          source: result.source,
          hitCount: { increment: 1 },
        },
      });
    } catch (error) {
      this.logger.warn(`保存意图缓存失败: ${error}`);
    }
  }

  /**
   * 计算消息哈希
   * @param message 消息内容
   * @returns {string} MD5哈希
   */
  private hashMessage(message: string): string {
    return crypto.createHash('md5').update(message).digest('hex');
  }
}