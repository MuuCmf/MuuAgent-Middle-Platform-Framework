const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

/**
 * 简化版雪花ID生成器
 */
class SnowflakeIdGenerator {
  constructor(workerId = 0) {
    this.twepoch = BigInt(1704067200000)
    this.workerId = BigInt(workerId)
    this.sequence = BigInt(0)
    this.lastTimestamp = BigInt(-1)
    this.maxSequence = BigInt(4095)
  }

  nextId() {
    let timestamp = BigInt(Date.now())
    
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + BigInt(1)) & this.maxSequence
      if (this.sequence === BigInt(0)) {
        while (BigInt(Date.now()) <= this.lastTimestamp) {}
        timestamp = BigInt(Date.now())
      }
    } else {
      this.sequence = BigInt(0)
    }
    
    this.lastTimestamp = timestamp
    
    const id = ((timestamp - this.twepoch) << BigInt(22)) |
               (this.workerId << BigInt(12)) |
               this.sequence
    
    return id.toString()
  }
}

const idGenerator = new SnowflakeIdGenerator(0)

async function main() {
  console.log('开始初始化模型参数模板...')

  const templates = [
    {
      id: idGenerator.nextId(),
      name: '客服问答模板',
      code: 'customer-service-template',
      modelType: 'llm',
      temperature: 0.2,
      topP: 0.7,
      contextWindow: 8192,
      maxTokens: 200,
      sceneTag: 'customer_service',
      description: '企业客服、常见问题解答，输出精准、简洁，贴合标准答案，避免冗余',
      remark: '适用于豆包、混元、GPT-3.5等LLM模型',
      isDefault: true,
      status: true,
    },
    {
      id: idGenerator.nextId(),
      name: '创意文案模板',
      code: 'creative-template',
      modelType: 'llm',
      temperature: 0.8,
      topP: 0.85,
      contextWindow: 16384,
      maxTokens: 1000,
      sceneTag: 'creative',
      description: '产品文案、活动宣传、短视频脚本，保留创意性，同时避免输出偏离主题',
      remark: '适用于GPT-4、豆包创意版等LLM模型',
      isDefault: false,
      status: true,
    },
    {
      id: idGenerator.nextId(),
      name: '向量生成模板',
      code: 'vector-template',
      modelType: 'embedding',
      temperature: 0,
      topP: 0.7,
      contextWindow: 8192,
      maxTokens: 0,
      sceneTag: 'vector',
      description: 'RAG知识库、文本检索、相似性匹配，确保向量生成的一致性、准确性，提升检索效果',
      remark: '适用于text-embedding-3-small、豆包向量等Embedding模型',
      isDefault: true,
      status: true,
    },
    {
      id: idGenerator.nextId(),
      name: '代码生成模板',
      code: 'code-template',
      modelType: 'llm',
      temperature: 0.3,
      topP: 0.75,
      contextWindow: 16384,
      maxTokens: 800,
      sceneTag: 'code',
      description: '接口代码、工具函数、脚本开发，输出规范、可运行代码，减少语法错误',
      remark: '适用于GPT-4、CodeLlama等LLM模型',
      isDefault: false,
      status: true,
    },
    {
      id: idGenerator.nextId(),
      name: '语音对话模板',
      code: 's2s-template',
      modelType: 's2s',
      temperature: 0.7,
      topP: 0.7,
      contextWindow: 8192,
      maxTokens: 0,
      sceneTag: 'customer_service',
      description: '端到端语音交互、语音助手，实时语音输入输出，自然流畅的语音对话体验',
      remark: '适用于豆包S2S等端到端语音模型',
      isDefault: false,
      status: true,
    },
  ]

  for (const template of templates) {
    try {
      await prisma.modelTemplate.create({
        data: template,
      })
      console.log(`✅ 创建模板: ${template.name} (ID: ${template.id})`)
    } catch (error) {
      if (error.code === 'P2002') {
        console.log(`⚠️  模板已存在: ${template.name}`)
      } else {
        console.log(`❌ 创建失败: ${template.name}`, error.message)
      }
    }
  }

  console.log('✅ 模型参数模板初始化完成！')
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
