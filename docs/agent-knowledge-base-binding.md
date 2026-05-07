# 智能体绑定知识库功能开发文档

## 📋 文档信息

- **文档版本**: 1.0
- **创建日期**: 2026-05-07
- **功能名称**: 智能体绑定知识库与检索增强
- **开发人员**: AI

---

## 🎯 功能概述

### 核心需求

实现智能体绑定知识库功能，使智能体在对话时能够：
1. 自动检索绑定的知识库内容
2. 使用检索结果增强提示词
3. 将增强后的提示词投喂给LLM
4. 返回基于知识库的精准回答

### 业务价值

- **提升回答准确性**: 基于企业知识库提供精准回答
- **减少幻觉问题**: 使用真实数据支撑回答
- **知识可追溯**: 回答来源可追溯、可验证
- **灵活配置**: 不同智能体可绑定不同知识库

---

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户请求                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      智能体服务层                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ AgentService│  │ KbService   │  │RetrievalSvc │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      知识检索流程                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 获取绑定 │→│ 向量检索 │→│ 结果排序 │→│ 提示词   │   │
│  │ 知识库   │  │          │  │          │  │ 增强     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      LLM调用层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ 构建消息 │→│ 调用LLM  │→│ 返回结果 │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### 数据流程

```
用户提问
  ↓
智能体接收问题
  ↓
获取智能体绑定的知识库列表
  ↓
生成问题向量 (Embedding)
  ↓
向量检索 (Vector Search)
  ↓
相似度过滤 (Similarity Threshold)
  ↓
构建增强提示词 (Prompt Augmentation)
  ↓
调用LLM生成回答
  ↓
返回最终结果
```

---

## 💾 数据模型设计

### 1. Agent模型扩展

**文件位置**: `service/prisma/schema.prisma`

**变更内容**:

```prisma
model Agent {
  id              String   @id @default(uuid())
  name            String   /// 智能体名称
  code            String   @unique /// 智能体唯一标识
  description     String?  /// 智能体描述
  systemPrompt    String   /// 系统提示词
  modelId         String?  /// 绑定模型ID
  skills          String   @default("[]") /// 绑定的技能code列表(JSON数组)
  mcpServers      String?  @default("[]") /// 绑定的MCP Server配置(JSON数组)
  knowledgeBases  String?  @default("[]") /// 绑定的知识库code列表(JSON数组) 【新增】
  maxSteps        Int      @default(5) /// 最大执行步数
  temperature     Float    @default(0.7) /// 温度参数
  status          Boolean  @default(true) /// 是否启用
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  /// 关联调用日志
  invokeLogs AgentInvokeLog[]

  @@index([status])
}
```

**字段说明**:

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| knowledgeBases | String? | "[]" | 绑定的知识库code列表，JSON数组格式 |

**数据示例**:

```json
{
  "knowledgeBases": "[\"kb_product\", \"kb_faq\"]"
}
```

### 2. 数据库迁移

**迁移命令**:

```bash
cd service
npx prisma migrate dev --name add_knowledge_bases_to_agent
```

---

## 🔧 后端开发

### 1. DTO扩展

**文件位置**: `service/src/agent/dto/agent.dto.ts`

**变更内容**:

```typescript
/**
 * 创建智能体DTO
 */
export class CreateAgentDto {
  @ApiProperty({ description: '智能体名称', example: '助手' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '智能体唯一标识', example: 'assistant' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: '智能体描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '系统提示词' })
  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @ApiPropertyOptional({ description: '绑定模型ID' })
  @IsString()
  @IsOptional()
  modelId?: string;

  @ApiPropertyOptional({ description: '绑定的技能code列表(JSON数组)', example: '["get_weather","get_time"]' })
  @IsString()
  @IsOptional()
  skills?: string;

  @ApiPropertyOptional({ description: '绑定的MCP Server配置(JSON数组)', example: '[{"name":"filesystem","url":"http://localhost:8081/mcp","enabled":true}]' })
  @IsString()
  @IsOptional()
  mcpServers?: string;

  @ApiPropertyOptional({ description: '绑定的知识库code列表(JSON数组)', example: '["kb_product","kb_faq"]' })
  @IsString()
  @IsOptional()
  knowledgeBases?: string;

  @ApiPropertyOptional({ description: '最大执行步数', default: 5 })
  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  maxSteps?: number;

  @ApiPropertyOptional({ description: '温度参数', default: 0.7 })
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}

/**
 * 更新智能体DTO
 */
export class UpdateAgentDto {
  @ApiPropertyOptional({ description: '智能体名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '智能体描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '系统提示词' })
  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: '绑定模型ID' })
  @IsString()
  @IsOptional()
  modelId?: string;

  @ApiPropertyOptional({ description: '绑定的技能code列表(JSON数组)' })
  @IsString()
  @IsOptional()
  skills?: string;

  @ApiPropertyOptional({ description: '绑定的MCP Server配置(JSON数组)' })
  @IsString()
  @IsOptional()
  mcpServers?: string;

  @ApiPropertyOptional({ description: '绑定的知识库code列表(JSON数组)' })
  @IsString()
  @IsOptional()
  knowledgeBases?: string;

  @ApiPropertyOptional({ description: '最大执行步数' })
  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  maxSteps?: number;

  @ApiPropertyOptional({ description: '温度参数' })
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}
```

---

### 2. 知识库检索服务

**文件位置**: `service/src/agent/agent-kb.service.ts` (新建)

**完整代码**:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { AiService } from '../ai/ai.service';

/**
 * 知识库检索结果
 */
export interface KbRetrievalResult {
  kbCode: string;
  kbName: string;
  chunks: Array<{
    content: string;
    score: number;
    docName: string;
  }>;
}

/**
 * 增强提示词结果
 */
export interface AugmentedPrompt {
  systemPrompt: string;
  context: string;
  sources: Array<{
    kbCode: string;
    kbName: string;
    docName: string;
  }>;
}

/**
 * 智能体知识库服务
 */
@Injectable()
export class AgentKbService {
  private readonly logger = new Logger(AgentKbService.name);

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param retrievalService 检索服务
   * @param aiService AI服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalService: RetrievalService,
    private readonly aiService: AiService,
  ) {}

  /**
   * 检索智能体绑定的知识库
   * @param agentId 智能体ID
   * @param query 查询问题
   * @param topK 每个知识库返回的条数
   * @param similarityThreshold 相似度阈值
   * @returns {Promise<KbRetrievalResult[]>} 检索结果
   */
  async retrieveFromAgentKbs(
    agentId: string,
    query: string,
    topK: number = 5,
    similarityThreshold: number = 0.7,
  ): Promise<KbRetrievalResult[]> {
    const startTime = Date.now();

    // 1. 获取智能体绑定的知识库列表
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { knowledgeBases: true },
    });

    if (!agent || !agent.knowledgeBases) {
      this.logger.warn(`智能体 ${agentId} 未绑定知识库`);
      return [];
    }

    const kbCodes: string[] = JSON.parse(agent.knowledgeBases);
    if (kbCodes.length === 0) {
      this.logger.warn(`智能体 ${agentId} 绑定的知识库列表为空`);
      return [];
    }

    this.logger.log(`智能体 ${agentId} 绑定了 ${kbCodes.length} 个知识库: ${kbCodes.join(', ')}`);

    // 2. 获取知识库详情
    const kbs = await this.prisma.kbInfo.findMany({
      where: {
        kbCode: { in: kbCodes },
        status: true,
        isDeleted: false,
      },
      select: {
        id: true,
        kbCode: true,
        kbName: true,
        similarityThresh: true,
        topN: true,
      },
    });

    if (kbs.length === 0) {
      this.logger.warn(`未找到有效的知识库`);
      return [];
    }

    // 3. 从每个知识库检索
    const results: KbRetrievalResult[] = [];

    for (const kb of kbs) {
      try {
        const retrievalResult = await this.retrievalService.retrieval({
          kbId: kb.id,
          query,
          topN: topK || kb.topN,
          similarityThresh: similarityThreshold || kb.similarityThresh,
        });

        if (retrievalResult && retrievalResult.items && retrievalResult.items.length > 0) {
          results.push({
            kbCode: kb.kbCode,
            kbName: kb.kbName,
            chunks: retrievalResult.items.map((item: any) => ({
              content: item.content,
              score: item.score,
              docName: item.docName,
            })),
          });
        }
      } catch (error) {
        this.logger.error(`从知识库 ${kb.kbCode} 检索失败:`, error);
      }
    }

    const costTime = Date.now() - startTime;
    this.logger.log(`知识库检索完成，耗时 ${costTime}ms，检索到 ${results.length} 个知识库的内容`);

    return results;
  }

  /**
   * 构建增强提示词
   * @param systemPrompt 原始系统提示词
   * @param retrievalResults 检索结果
   * @returns {AugmentedPrompt} 增强后的提示词
   */
  buildAugmentedPrompt(
    systemPrompt: string,
    retrievalResults: KbRetrievalResult[],
  ): AugmentedPrompt {
    if (retrievalResults.length === 0) {
      return {
        systemPrompt,
        context: '',
        sources: [],
      };
    }

    // 构建上下文
    const contextParts: string[] = [];
    const sources: Array<{ kbCode: string; kbName: string; docName: string }> = [];

    for (const result of retrievalResults) {
      for (const chunk of result.chunks) {
        contextParts.push(`【${result.kbName}】${chunk.content}`);
        
        // 记录来源（去重）
        const sourceKey = `${result.kbCode}-${chunk.docName}`;
        if (!sources.find(s => `${s.kbCode}-${s.docName}` === sourceKey)) {
          sources.push({
            kbCode: result.kbCode,
            kbName: result.kbName,
            docName: chunk.docName,
          });
        }
      }
    }

    const context = contextParts.join('\n\n');

    // 构建增强的系统提示词
    const augmentedSystemPrompt = `${systemPrompt}

## 知识库上下文

以下是来自知识库的相关信息，请基于这些信息回答用户问题：

${context}

## 回答要求

1. 优先使用知识库中的信息回答
2. 如果知识库中没有相关信息，请明确告知用户
3. 回答时要标注信息来源
4. 保持回答的准确性和专业性`;

    return {
      systemPrompt: augmentedSystemPrompt,
      context,
      sources,
    };
  }

  /**
   * 智能体对话（带知识库检索增强）
   * @param agentId 智能体ID
   * @param query 用户问题
   * @param systemPrompt 系统提示词
   * @param topK 检索条数
   * @param similarityThreshold 相似度阈值
   * @returns {Promise<AugmentedPrompt>} 增强后的提示词
   */
  async augmentPromptWithKb(
    agentId: string,
    query: string,
    systemPrompt: string,
    topK?: number,
    similarityThreshold?: number,
  ): Promise<AugmentedPrompt> {
    // 1. 检索知识库
    const retrievalResults = await this.retrieveFromAgentKbs(
      agentId,
      query,
      topK,
      similarityThreshold,
    );

    // 2. 构建增强提示词
    return this.buildAugmentedPrompt(systemPrompt, retrievalResults);
  }
}
```

---

### 3. AgentService集成

**文件位置**: `service/src/agent/agent.service.ts`

**变更内容**:

```typescript
import { AgentKbService } from './agent-kb.service';

@Injectable()
export class AgentService {
  constructor(
    private prisma: PrismaService,
    private mcpService: McpService,
    private mcpServerService: McpServerService,
    private skillService: SkillService,
    private modelService: ModelService,
    private agentKbService: AgentKbService,  // 注入知识库服务
  ) {}

  /**
   * 创建智能体
   * @param dto 创建智能体DTO
   * @returns {Promise<Object>} 创建的智能体
   */
  async create(dto: CreateAgentDto) {
    return this.prisma.agent.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        systemPrompt: dto.systemPrompt,
        modelId: dto.modelId,
        skills: dto.skills || '[]',
        mcpServers: dto.mcpServers || '[]',
        knowledgeBases: dto.knowledgeBases || '[]',  // 新增
        maxSteps: dto.maxSteps ?? 5,
        temperature: dto.temperature ?? 0.7,
        status: dto.status ?? true,
      },
    });
  }

  /**
   * 同步Agent对话
   * @param dto 对话请求DTO
   * @param clientIp 客户端IP
   * @param uid 用户唯一标识(透传)
   * @returns {Promise<Record<string, unknown>>} 对话结果
   */
  async syncChat(dto: AgentChatDto, clientIp: string, uid?: string): Promise<Record<string, unknown>> {
    const startTime = Date.now();

    // 获取智能体
    let agent;
    try {
      agent = await this.prisma.agent.findFirst({
        where: {
          OR: [{ id: dto.agentId }, { code: dto.agentId }],
        },
      });
    } catch {
      agent = await this.findByCode(dto.agentId);
    }

    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }

    if (!agent.status) {
      throw new HttpException('智能体已禁用', HttpStatus.FORBIDDEN);
    }

    // 获取绑定的技能
    const skillCodes: string[] = JSON.parse(agent.skills || '[]');
    const skillDescriptions = skillCodes.length > 0
      ? await this.skillService.getSkillDescriptions(skillCodes)
      : '';

    // 获取绑定的MCP Server工具
    const mcpServerConfigs = this.mcpServerService.parseMcpServersConfig(agent.mcpServers);
    const mcpTools = mcpServerConfigs.length > 0
      ? await this.mcpServerService.discoverAllTools(mcpServerConfigs)
      : [];
    const mcpToolDescriptions = mcpTools.length > 0
      ? this.mcpServerService.buildToolsDescription(mcpTools)
      : '';

    // 【新增】知识库检索增强
    let augmentedPrompt = agent.systemPrompt;
    let kbSources: any[] = [];

    const kbCodes: string[] = JSON.parse(agent.knowledgeBases || '[]');
    if (kbCodes.length > 0) {
      const augmentation = await this.agentKbService.augmentPromptWithKb(
        agent.id,
        dto.message,
        agent.systemPrompt,
      );
      augmentedPrompt = augmentation.systemPrompt;
      kbSources = augmentation.sources;
    }

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(
      augmentedPrompt,  // 使用增强后的提示词
      skillDescriptions,
      mcpToolDescriptions,
    );

    // ... 后续对话逻辑保持不变
  }
}
```

---

### 4. 模块注册

**文件位置**: `service/src/agent/agent.module.ts`

**变更内容**:

```typescript
import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentKbService } from './agent-kb.service';
import { AgentController, AgentAdminController } from './agent.controller';
import { McpModule } from '../mcp/mcp.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { SkillModule } from '../skill/skill.module';
import { ModelModule } from '../model/model.module';
import { RetrievalModule } from '../retrieval/retrieval.module';  // 新增

/**
 * 智能体模块
 */
@Module({
  imports: [
    McpModule,
    McpServerModule,
    SkillModule,
    ModelModule,
    RetrievalModule,  // 新增
  ],
  controllers: [AgentController, AgentAdminController],
  providers: [AgentService, AgentKbService],  // 新增
  exports: [AgentService, AgentKbService],    // 新增
})
export class AgentModule {}
```

---

## 🎨 前端开发

### 1. API接口定义

**文件位置**: `admin/src/api/agent.ts`

**变更内容**:

```typescript
/**
 * 创建智能体
 * @param data 创建参数
 * @returns {Promise<AxiosResponse>} 创建结果
 */
create(data: {
  name: string
  code: string
  description?: string
  systemPrompt: string
  modelId?: string
  skills?: string
  mcpServers?: string
  knowledgeBases?: string  // 新增
  maxSteps?: number
  temperature?: number
  status?: boolean
}): Promise<AxiosResponse<ApiResponse<Agent>>> {
  return adminRequest.post('/admin/agent', data)
},

/**
 * 更新智能体
 * @param id 智能体ID
 * @param data 更新参数
 * @returns {Promise<AxiosResponse>} 更新结果
 */
update(id: string, data: {
  name?: string
  description?: string
  systemPrompt?: string
  modelId?: string
  skills?: string
  mcpServers?: string
  knowledgeBases?: string  // 新增
  maxSteps?: number
  temperature?: number
  status?: boolean
}): Promise<AxiosResponse<ApiResponse<Agent>>> {
  return adminRequest.put(`/admin/agent/${id}`, data)
},
```

---

### 2. 知识库选择对话框组件

**文件位置**: `admin/src/views/agents/components/KbSelectDialog.vue` (新建)

**完整代码**:

```vue
<template>
  <el-dialog
    v-model="visible"
    title="选择知识库"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="kb-select-container">
      <div class="search-box">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索知识库名称或标识"
          clearable
          prefix-icon="Search"
        />
      </div>

      <div class="selected-kbs" v-if="selectedKbs.length > 0">
        <div class="selected-header">
          <span class="selected-title">已选择 ({{ selectedKbs.length }})</span>
          <el-button text type="primary" size="small" @click="clearSelection">
            清空
          </el-button>
        </div>
        <div class="selected-tags">
          <el-tag
            v-for="kb in selectedKbs"
            :key="kb.kbCode"
            closable
            @close="removeKb(kb.kbCode)"
            style="margin: 4px;"
          >
            {{ kb.kbName }} ({{ kb.kbCode }})
          </el-tag>
        </div>
      </div>

      <div class="kb-list">
        <div v-if="filteredKbs.length === 0" class="empty-kbs">
          <el-empty description="暂无可用知识库" :image-size="80" />
        </div>
        <div v-else class="kb-items">
          <div
            v-for="kb in filteredKbs"
            :key="kb.kbCode"
            class="kb-item"
            :class="{ 'is-selected': isKbSelected(kb.kbCode) }"
            @click="toggleKb(kb)"
          >
            <div class="kb-checkbox">
              <el-checkbox
                :model-value="isKbSelected(kb.kbCode)"
                @click.stop
                @change="toggleKb(kb)"
              />
            </div>
            <div class="kb-info">
              <div class="kb-name">{{ kb.kbName }}</div>
              <div class="kb-code">{{ kb.kbCode }}</div>
              <div class="kb-stats">
                <span>文档: {{ kb.documentCount || 0 }}</span>
                <span>切片: {{ kb.chunkCount || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div style="text-align: right;">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleConfirm">
          确定 ({{ selectedKbs.length }})
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { kbApi } from '@/api/kb'

/**
 * 知识库信息接口
 */
interface KbInfo {
  kbId: string
  kbCode: string
  kbName: string
  documentCount?: number
  chunkCount?: number
  status: boolean
}

const props = defineProps<{
  modelValue: boolean
  selectedKbCodes: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': [kbs: KbInfo[]]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const searchKeyword = ref('')
const kbList = ref<KbInfo[]>([])
const selectedKbs = ref<KbInfo[]>([])
const loading = ref(false)

/**
 * 过滤后的知识库列表
 */
const filteredKbs = computed(() => {
  if (!searchKeyword.value) {
    return kbList.value.filter(kb => kb.status)
  }
  const keyword = searchKeyword.value.toLowerCase()
  return kbList.value.filter(kb => 
    kb.status && (
      kb.kbName.toLowerCase().includes(keyword) ||
      kb.kbCode.toLowerCase().includes(keyword)
    )
  )
})

/**
 * 获取知识库列表
 */
const fetchKbList = async () => {
  loading.value = true
  try {
    const response = await kbApi.getList({ pageSize: 100 })
    kbList.value = response.data.data.list || []
  } catch (error: any) {
    ElMessage.error(error.message || '获取知识库列表失败')
  } finally {
    loading.value = false
  }
}

/**
 * 判断知识库是否已选择
 */
const isKbSelected = (kbCode: string): boolean => {
  return selectedKbs.value.some(kb => kb.kbCode === kbCode)
}

/**
 * 切换知识库选择
 */
const toggleKb = (kb: KbInfo) => {
  const index = selectedKbs.value.findIndex(item => item.kbCode === kb.kbCode)
  if (index > -1) {
    selectedKbs.value.splice(index, 1)
  } else {
    selectedKbs.value.push(kb)
  }
}

/**
 * 移除已选知识库
 */
const removeKb = (kbCode: string) => {
  const index = selectedKbs.value.findIndex(kb => kb.kbCode === kbCode)
  if (index > -1) {
    selectedKbs.value.splice(index, 1)
  }
}

/**
 * 清空选择
 */
const clearSelection = () => {
  selectedKbs.value = []
}

/**
 * 关闭对话框
 */
const handleClose = () => {
  visible.value = false
}

/**
 * 确认选择
 */
const handleConfirm = () => {
  emit('confirm', selectedKbs.value)
  handleClose()
}

/**
 * 监听对话框打开
 */
watch(visible, (val) => {
  if (val) {
    fetchKbList()
    // 初始化已选择的知识库
    if (props.selectedKbCodes.length > 0 && kbList.value.length > 0) {
      selectedKbs.value = kbList.value.filter(kb => 
        props.selectedKbCodes.includes(kb.kbCode)
      )
    }
  }
})
</script>

<style scoped lang="scss">
.kb-select-container {
  .search-box {
    margin-bottom: 16px;
  }

  .selected-kbs {
    margin-bottom: 16px;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;

    .selected-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .selected-title {
        font-weight: 500;
        color: #303133;
      }
    }

    .selected-tags {
      display: flex;
      flex-wrap: wrap;
    }
  }

  .kb-list {
    max-height: 400px;
    overflow-y: auto;

    .empty-kbs {
      padding: 40px 0;
    }

    .kb-items {
      .kb-item {
        display: flex;
        align-items: center;
        padding: 12px;
        margin-bottom: 8px;
        border: 1px solid #dcdfe6;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          border-color: #409eff;
          background: #f0f7ff;
        }

        &.is-selected {
          border-color: #409eff;
          background: #f0f7ff;
        }

        .kb-checkbox {
          margin-right: 12px;
        }

        .kb-info {
          flex: 1;

          .kb-name {
            font-weight: 500;
            color: #303133;
            margin-bottom: 4px;
          }

          .kb-code {
            font-size: 12px;
            color: #909399;
            margin-bottom: 4px;
          }

          .kb-stats {
            font-size: 12px;
            color: #909399;

            span {
              margin-right: 12px;
            }
          }
        }
      }
    }
  }
}
</style>
```

---

### 3. 智能体编辑抽屉集成

**文件位置**: `admin/src/views/agents/components/AgentEditDrawer.vue`

**变更内容**:

```vue
<template>
  <el-drawer
    v-model="visible"
    :title="drawerTitle"
    direction="rtl"
    size="600px"
    :close-on-click-modal="false"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
    >
      <!-- ... 其他表单项 ... -->

      <el-divider>
        <el-icon><Collection /></el-icon>
        知识库绑定
      </el-divider>

      <el-form-item label="绑定知识库">
        <div style="width: 100%;">
          <div class="selected-kbs-display">
            <div v-if="selectedKbCodes.length === 0" class="no-kbs">
              <span style="color: #909399;">暂未绑定知识库</span>
            </div>
            <div v-else class="kb-tags">
              <el-tag
                v-for="kb in selectedKbs"
                :key="kb.kbCode"
                closable
                @close="removeKb(kb.kbCode)"
                style="margin: 4px;"
              >
                {{ kb.kbName }} ({{ kb.kbCode }})
              </el-tag>
            </div>
          </div>
          <el-button type="primary" @click="handleSelectKbs" style="margin-top: 8px;">
            <el-icon><Plus /></el-icon>
            选择知识库
          </el-button>

          <el-alert type="info" :closable="false" style="margin-top: 12px;">
            <template #title>
              <strong>💡 知识库绑定说明</strong>
            </template>
            <div style="font-size: 13px; line-height: 1.6;">
              <p><strong>知识库绑定：</strong>智能体可以自动检索绑定的知识库</p>
              <p style="margin-top: 8px;"><strong>使用场景：</strong></p>
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li>产品文档查询</li>
                <li>技术规范检索</li>
                <li>知识问答助手</li>
              </ul>
              <p style="margin-top: 8px; color: #666; font-size: 12px;">
                💡 提示：智能体会根据用户问题自动检索知识库并增强回答
              </p>
            </div>
          </el-alert>
        </div>
      </el-form-item>
    </el-form>

    <!-- 知识库选择对话框 -->
    <KbSelectDialog
      v-model="kbSelectVisible"
      :selected-kb-codes="selectedKbCodes"
      @confirm="handleKbConfirm"
    />
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Collection, Plus } from '@element-plus/icons-vue'
import KbSelectDialog from './KbSelectDialog.vue'

// ... 其他代码 ...

const kbSelectVisible = ref(false)
const selectedKbs = ref<KbInfo[]>([])
const selectedKbCodes = computed(() => selectedKbs.value.map(kb => kb.kbCode))

/**
 * 打开知识库选择对话框
 */
const handleSelectKbs = () => {
  kbSelectVisible.value = true
}

/**
 * 确认知识库选择
 */
const handleKbConfirm = (kbs: KbInfo[]) => {
  selectedKbs.value = kbs
}

/**
 * 移除知识库
 */
const removeKb = (kbCode: string) => {
  const index = selectedKbs.value.findIndex(kb => kb.kbCode === kbCode)
  if (index > -1) {
    selectedKbs.value.splice(index, 1)
  }
}

/**
 * 提交表单
 */
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate()
  
  const data = {
    // ... 其他字段 ...
    knowledgeBases: JSON.stringify(selectedKbCodes.value),
  }

  // 调用API
  if (isEdit.value) {
    await agentApi.update(formData.id, data)
  } else {
    await agentApi.create(data)
  }
  
  ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
  emit('success')
  visible.value = false
}
</script>
```

---

## 📡 API接口设计

### 1. 获取智能体绑定的知识库

**接口地址**: `GET /admin/agent/:id/kbs`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 智能体ID |

**响应示例**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbs": [
      {
        "kbCode": "kb_product",
        "kbName": "产品文档库",
        "documentCount": 10,
        "chunkCount": 150
      },
      {
        "kbCode": "kb_faq",
        "kbName": "常见问题库",
        "documentCount": 5,
        "chunkCount": 80
      }
    ]
  }
}
```

---

### 2. 智能体对话（带知识库检索）

**接口地址**: `POST /agent/chat`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| agentId | string | 是 | 智能体ID或标识 |
| message | string | 是 | 用户消息 |
| conversationId | string | 否 | 会话ID |
| stream | boolean | 否 | 是否流式输出 |

**响应示例**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "content": "根据产品文档，安装步骤如下...",
    "sources": [
      {
        "kbCode": "kb_product",
        "kbName": "产品文档库",
        "docName": "安装指南.pdf"
      }
    ],
    "usage": {
      "inputTokens": 500,
      "outputTokens": 150
    }
  }
}
```

---

## 🧪 测试用例

### 1. 单元测试

**文件位置**: `service/src/agent/agent-kb.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AgentKbService } from './agent-kb.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { AiService } from '../ai/ai.service';

describe('AgentKbService', () => {
  let service: AgentKbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentKbService,
        {
          provide: PrismaService,
          useValue: {
            agent: {
              findUnique: jest.fn(),
            },
            kbInfo: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: RetrievalService,
          useValue: {
            retrieval: jest.fn(),
          },
        },
        {
          provide: AiService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AgentKbService>(AgentKbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('retrieveFromAgentKbs', () => {
    it('应该返回空数组如果智能体未绑定知识库', async () => {
      jest.spyOn(service['prisma'].agent, 'findUnique').mockResolvedValue({
        knowledgeBases: '[]',
      } as any);

      const result = await service.retrieveFromAgentKbs('agent-1', '测试问题');
      expect(result).toEqual([]);
    });
  });

  describe('buildAugmentedPrompt', () => {
    it('应该正确构建增强提示词', () => {
      const systemPrompt = '你是一个助手';
      const retrievalResults = [
        {
          kbCode: 'kb_product',
          kbName: '产品文档',
          chunks: [
            {
              content: '产品安装步骤...',
              score: 0.9,
              docName: '安装指南.pdf',
            },
          ],
        },
      ];

      const result = service.buildAugmentedPrompt(systemPrompt, retrievalResults);
      
      expect(result.systemPrompt).toContain('知识库上下文');
      expect(result.systemPrompt).toContain('产品安装步骤');
      expect(result.sources).toHaveLength(1);
    });
  });
});
```

---

### 2. 集成测试

**测试场景**:

1. 创建智能体并绑定知识库
2. 智能体对话时自动检索知识库
3. 返回基于知识库的回答

**测试步骤**:

```bash
# 1. 创建知识库
curl -X POST http://localhost:3000/admin/kb \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "kbName": "产品文档库",
    "kbCode": "kb_product",
    "embeddingModel": "doubao-embedding-v1"
  }'

# 2. 上传文档
curl -X POST http://localhost:3000/admin/kb/document/upload \
  -H "Authorization: Bearer <token>" \
  -F "kbId=<kb_id>" \
  -F "file=@产品文档.pdf"

# 3. 创建智能体并绑定知识库
curl -X POST http://localhost:3000/admin/agent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "产品助手",
    "code": "product_assistant",
    "systemPrompt": "你是一个产品助手",
    "knowledgeBases": "[\"kb_product\"]"
  }'

# 4. 智能体对话
curl -X POST http://localhost:3000/agent/chat \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "product_assistant",
    "message": "产品怎么安装？"
  }'
```

---

## 📊 性能优化

### 1. 缓存策略

```typescript
/**
 * 使用Redis缓存检索结果
 */
async retrieveWithCache(
  agentId: string,
  query: string,
  topK: number,
): Promise<KbRetrievalResult[]> {
  const cacheKey = `agent:${agentId}:kb:${query}:${topK}`;
  
  // 尝试从缓存获取
  const cached = await this.cacheService.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 执行检索
  const results = await this.retrieveFromAgentKbs(agentId, query, topK);

  // 缓存结果（5分钟）
  await this.cacheService.set(cacheKey, JSON.stringify(results), 300);

  return results;
}
```

### 2. 并行检索

```typescript
/**
 * 并行从多个知识库检索
 */
async retrieveFromAgentKbs(
  agentId: string,
  query: string,
  topK: number,
): Promise<KbRetrievalResult[]> {
  // ... 获取知识库列表 ...

  // 并行检索
  const promises = kbs.map(kb => 
    this.retrievalService.retrieval({
      kbId: kb.id,
      query,
      topN: topK,
    })
  );

  const results = await Promise.all(promises);

  // 处理结果
  return results.map((result, index) => ({
    kbCode: kbs[index].kbCode,
    kbName: kbs[index].kbName,
    chunks: result.items,
  }));
}
```

---

## 🚀 部署说明

### 1. 数据库迁移

```bash
cd service
npx prisma migrate dev --name add_knowledge_bases_to_agent
npx prisma generate
```

### 2. 服务重启

```bash
cd service
npm run build
pm2 restart muuai-service
```

### 3. 前端构建

```bash
cd admin
npm run build
```

---

## 📝 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0 | 2026-05-07 | AI | 初始版本，实现智能体绑定知识库功能 |

---

## 🔗 相关文档

- [智能路由技术方案](./smart-routing.md)
- [知识库管理文档](./kb-management.md)
- [向量检索文档](./vector-retrieval.md)

---

## 💡 最佳实践

### 1. 知识库绑定建议

- **相关性**: 绑定与智能体职责相关的知识库
- **数量控制**: 建议2-5个知识库，避免过多影响性能
- **定期更新**: 定期更新知识库内容，保持信息时效性

### 2. 检索参数调优

```typescript
// 推荐配置
const config = {
  topK: 5,                    // 每个知识库返回5条
  similarityThreshold: 0.7,   // 相似度阈值0.7
  maxContextLength: 2000,     // 最大上下文长度
};
```

### 3. 提示词优化

```typescript
// 优化后的系统提示词
const optimizedPrompt = `${systemPrompt}

## 知识库使用指南

1. 优先使用知识库信息回答
2. 标注信息来源
3. 如果知识库无相关信息，明确告知用户
4. 保持专业性和准确性`;
```

---

## ⚠️ 注意事项

1. **权限控制**: 确保智能体只能访问有权限的知识库
2. **性能监控**: 监控检索耗时，优化慢查询
3. **错误处理**: 妥善处理知识库不可用的情况
4. **日志记录**: 记录检索日志，便于问题排查

---

## 📞 联系方式

如有问题，请联系开发团队或提交Issue。
