/**
 * Provider Registry - 模型提供商配置注册中心
 *
 * 集中管理所有 provider 的元数据：
 * - 默认 Base URL（不含 /chat/completions 等路径）
 * - API 路径模板（chat / embedding / image）
 * - 模型代码自动检测规则
 * - 请求头生成
 *
 * 新增 provider 只需在 PROVIDER_REGISTRY 中添加一条记录。
 */

/**
 * Provider 配置定义
 */
export interface ProviderConfig {
  /** 提供商显示名称 */
  name: string;
  /** 默认 Base URL（不含 API 路径） */
  defaultBaseUrl: string;
  /** API 路径模板 */
  paths: {
    chat: string;
    embedding: string;
    image: string;
  };
  /** 根据 model code 前缀自动识别，优先级从上到下 */
  codePrefixes?: string[];
  /** 是否需要 apiKey */
  requireApiKey?: boolean;
  /** Ollama 等特殊 provider 的 base URL 解析方式 */
  normalizeBaseUrl?: (endpoint: string) => string;
}

/**
 * Provider 注册表
 * key 为 provider 标识（小写），与数据库 Model.provider 字段对应
 */
export const PROVIDER_REGISTRY: Record<string, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    paths: {
      chat: '/chat/completions',
      embedding: '/embeddings',
      image: '/images/generations',
    },
    requireApiKey: true,
  },

  deepseek: {
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    paths: {
      chat: '/chat/completions',
      embedding: '/embeddings',
      image: '/images/generations',
    },
    codePrefixes: ['deepseek'],
    requireApiKey: true,
  },

  zhipu: {
    name: '智谱AI',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    paths: {
      chat: '/chat/completions',
      embedding: '/embeddings',
      image: '/images/generations',
    },
    codePrefixes: ['glm-', 'chatglm'],
    requireApiKey: true,
  },

  ollama: {
    name: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434',
    paths: {
      chat: '/api/chat',
      embedding: '/api/embeddings',
      image: '/api/generate',
    },
    codePrefixes: ['llama', 'mistral', 'codestral', 'qwen', 'gemma'],
    requireApiKey: false,
    normalizeBaseUrl: (endpoint: string) => {
      if (!endpoint) return 'http://localhost:11434';
      return endpoint
        .replace('/api/chat', '')
        .replace('/chat', '');
    },
  },

  azure: {
    name: 'Azure OpenAI',
    defaultBaseUrl: '',
    paths: {
      chat: `/openai/deployments/{model}/chat/completions`,
      embedding: `/openai/deployments/{model}/embeddings`,
      image: `/openai/deployments/{model}/images/generations`,
    },
    requireApiKey: true,
  },

  aliyun: {
    name: '阿里云通义',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    paths: {
      chat: '/chat/completions',
      embedding: '/embeddings',
      image: '/images/generations',
    },
    codePrefixes: ['qwen', '通义'],
    requireApiKey: true,
  },

  tencent: {
    name: '腾讯混元',
    defaultBaseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    paths: {
      chat: '/chat/completions',
      embedding: '/embeddings',
      image: '/images/generations',
    },
    codePrefixes: ['hunyuan', '混元'],
    requireApiKey: true,
  },

  custom: {
    name: '自定义',
    defaultBaseUrl: '',
    paths: {
      chat: '/chat/completions',
      embedding: '/embeddings',
      image: '/images/generations',
    },
    requireApiKey: false,
  },
};

/**
 * 根据 model code 自动检测 provider
 * 遍历注册表中的 codePrefixes，返回匹配的 provider 标识
 */
export function detectProviderFromCode(code: string): string | null {
  if (!code) return null;
  const lowerCode = code.toLowerCase();

  for (const [providerId, config] of Object.entries(PROVIDER_REGISTRY)) {
    if (config.codePrefixes?.some((prefix) => lowerCode.startsWith(prefix))) {
      return providerId;
    }
  }

  return null;
}

/**
 * 解析 provider 标识
 * 优先使用声明值，其次根据 model code 自动检测
 */
export function resolveProvider(declaredProvider: string | null | undefined, modelCode: string): string {
  const declared = declaredProvider?.toLowerCase();

  // 如果明确声明了非 openai 的 provider，直接使用
  if (declared && declared !== 'openai') {
    return declared;
  }

  // 尝试根据 model code 自动检测
  const detected = detectProviderFromCode(modelCode);
  if (detected) {
    return detected;
  }

  // 如果声明了 openai 且配置了非官方 endpoint，走 custom
  if (declared === 'openai') {
    return 'openai';
  }

  return declared || 'openai';
}

/**
 * 获取 provider 配置
 */
export function getProviderConfig(provider: string): ProviderConfig {
  return PROVIDER_REGISTRY[provider] || PROVIDER_REGISTRY['openai'];
}

/**
 * 规范化 endpoint 为 Base URL（去掉 API 路径后缀）
 * AI SDK 需要 baseURL（不含 /chat/completions）
 *
 * 示例:
 *   https://api.deepseek.com/chat/completions → https://api.deepseek.com
 *   https://api.deepseek.com/v1/chat/completions → https://api.deepseek.com/v1
 *   https://api.deepseek.com/v1 → https://api.deepseek.com/v1 (不变)
 */
export function stripApiPath(url: string): string {
  if (!url) return url;
  return url
    .replace(/\/chat\/completions\/?$/, '')
    .replace(/\/v1\/chat\/completions\/?$/, '/v1')
    .replace(/\/api\/chat\/?$/, '')
    .replace(/\/api\/embeddings\/?$/, '')
    .replace(/\/embeddings\/?$/, '')
    .replace(/\/completions\/?$/, '');
}

/**
 * 解析模型 API 的完整端点 URL（给 axios 使用）
 *
 * 支持两种 endpoint 格式：
 *   - 完整路径: https://api.deepseek.com/chat/completions → 直接使用
 *   - Base URL:  https://api.deepseek.com/v1 → 自动补全路径
 *
 * 如果 endpoint 为空，根据 provider 生成默认值
 */
export function resolveEndpoint(
  model: { provider?: string; endpoint?: string; code?: string },
  type: 'chat' | 'embedding' | 'image' = 'chat',
): string {
  const provider = resolveProvider(model.provider, model.code || '');
  const config = getProviderConfig(provider);
  const endpoint = model.endpoint;

  // Ollama 特殊处理
  if (provider === 'ollama') {
    const base = config.normalizeBaseUrl
      ? config.normalizeBaseUrl(endpoint || config.defaultBaseUrl)
      : endpoint || config.defaultBaseUrl;
    return base + config.paths[type];
  }

  // Azure 特殊处理：路径含 {model} 占位符
  if (provider === 'azure') {
    const base = endpoint || config.defaultBaseUrl;
    const path = config.paths[type].replace('{model}', model.code || 'gpt-4');
    return base + path;
  }

  // endpoint 为空：使用默认 base + 路径
  if (!endpoint) {
    return config.defaultBaseUrl + config.paths[type];
  }

  // endpoint 已包含 API 路径 → 直接使用
  if (
    endpoint.includes('/chat/completions') ||
    endpoint.includes('/embeddings') ||
    endpoint.includes('/images/generations') ||
    endpoint.includes('/api/chat') ||
    endpoint.includes('/api/embeddings')
  ) {
    return endpoint;
  }

  // endpoint 是 base URL → 补全路径
  const base = endpoint.replace(/\/+$/, '');
  return base + config.paths[type];
}

/**
 * 解析 Base URL（给 AI SDK 使用）
 * 总是返回不含 API 路径的 base URL
 */
export function resolveBaseUrl(
  model: { provider?: string; endpoint?: string; code?: string },
): string {
  const provider = resolveProvider(model.provider, model.code || '');
  const config = getProviderConfig(provider);
  const endpoint = model.endpoint;

  // Ollama 特殊处理
  if (provider === 'ollama') {
    return config.normalizeBaseUrl
      ? config.normalizeBaseUrl(endpoint || config.defaultBaseUrl)
      : endpoint || config.defaultBaseUrl;
  }

  // Azure 特殊处理
  if (provider === 'azure') {
    return `${endpoint || config.defaultBaseUrl}/openai/deployments/${model.code || 'gpt-4'}`;
  }

  // endpoint 为空：使用默认 base
  if (!endpoint) {
    return config.defaultBaseUrl;
  }

  // 去掉 API 路径后缀，返回纯 base URL
  return stripApiPath(endpoint);
}
