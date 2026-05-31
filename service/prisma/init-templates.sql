-- 模型参数模板初始化数据
-- 包含客服问答、创意文案、向量生成、多模态生成、代码生成等场景的预设模板

-- 客服问答模板（默认）
INSERT INTO ModelTemplate (id, name, code, modelType, temperature, topP, contextWindow, maxTokens, sceneTag, description, remark, isDefault, status, createdAt, updatedAt)
VALUES (
  'template-customer-service',
  '客服问答模板',
  'customer-service-template',
  'llm',
  0.2,
  0.7,
  8192,
  200,
  'customer_service',
  '企业客服、常见问题解答，输出精准、简洁，贴合标准答案，避免冗余',
  '适用于豆包、混元、GPT-3.5等LLM模型',
  1,
  1,
  datetime('now'),
  datetime('now')
);

INSERT INTO ModelTemplate (id, name, code, modelType, temperature, topP, contextWindow, maxTokens, sceneTag, description, remark, isDefault, status, createdAt, updatedAt)
VALUES (
  'template-s2s',
  '语音对话模板',
  's2s-template',
  's2s',
  0.7,
  0.7,
  8192,
  0,
  'customer_service',
  '端到端语音交互、语音助手，实时语音输入输出，自然流畅的语音对话体验',
  '适用于豆包S2S等端到端语音模型',
  0,
  1,
  datetime('now'),
  datetime('now')
);

-- 创意文案模板
INSERT INTO ModelTemplate (id, name, code, modelType, temperature, topP, contextWindow, maxTokens, sceneTag, description, remark, isDefault, status, createdAt, updatedAt)
VALUES (
  'template-creative',
  '创意文案模板',
  'creative-template',
  'llm',
  0.8,
  0.85,
  16384,
  1000,
  'creative',
  '产品文案、活动宣传、短视频脚本，保留创意性，同时避免输出偏离主题',
  '适用于GPT-4、豆包创意版等LLM模型',
  0,
  1,
  datetime('now'),
  datetime('now')
);

-- 向量生成模板
INSERT INTO ModelTemplate (id, name, code, modelType, temperature, topP, contextWindow, maxTokens, sceneTag, description, remark, isDefault, status, createdAt, updatedAt)
VALUES (
  'template-vector',
  '向量生成模板',
  'vector-template',
  'embedding',
  0,
  0.7,
  8192,
  0,
  'vector',
  'RAG知识库、文本检索、相似性匹配，确保向量生成的一致性、准确性，提升检索效果',
  '适用于text-embedding-3-small、豆包向量等Embedding模型',
  1,
  1,
  datetime('now'),
  datetime('now')
);

-- LMM大多模态模板
INSERT INTO ModelTemplate (id, name, code, modelType, temperature, topP, contextWindow, maxTokens, sceneTag, description, remark, isDefault, status, createdAt, updatedAt)
VALUES (
  'template-lmm',
  'LMM大多模态模板',
  'lmm-template',
  'lmm',
  0.7,
  0.8,
  4096,
  500,
  NULL,
  '图文理解、多模态对话、图片描述，平衡创意与贴合度，适配大多模态输入输出场景',
  '适用于GPT-4o、Claude-3.5-Sonnet、Gemini等LMM模型',
  1,
  1,
  datetime('now'),
  datetime('now')
);

-- 代码生成模板
INSERT INTO ModelTemplate (id, name, code, modelType, temperature, topP, contextWindow, maxTokens, sceneTag, description, remark, isDefault, status, createdAt, updatedAt)
VALUES (
  'template-code',
  '代码生成模板',
  'code-template',
  'llm',
  0.3,
  0.75,
  16384,
  800,
  'code',
  '接口代码、工具函数、脚本开发，输出规范、可运行代码，减少语法错误',
  '适用于GPT-4、CodeLlama等LLM模型',
  0,
  1,
  datetime('now'),
  datetime('now')
);
