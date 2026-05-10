import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始插入 Prompt Template 初始数据...');

  // 1. RAG 问答模板
  const ragTemplate = await prisma.promptTemplate.create({
    data: {
      code: 'rag-chat-default',
      name: 'RAG问答提示词',
      category: 'rag',
      content: `你是一个专业的问答助手。请根据以下参考信息回答用户的问题。

## 参考信息
{{context}}

## 用户问题
{{query}}

## 回答要求
1. 基于参考信息给出准确、详细的回答
2. 如果参考信息中没有相关内容，请明确告知用户
3. 使用友好、专业的语气
4. 引用参考信息的来源`,
      variables: JSON.stringify([
        { name: 'context', type: 'string', required: true, description: '从知识库检索到的上下文内容' },
        { name: 'query', type: 'string', required: true, description: '用户提出的问题' }
      ]),
      isDefault: true,
      status: true,
      description: 'RAG问答场景的默认提示词模板',
    },
  });
  console.log('✅ 创建 RAG 问答模板:', ragTemplate.code);

  // 2. Agent 系统提示词模板（默认模式）
  const agentTemplate = await prisma.promptTemplate.create({
    data: {
      code: 'agent-system-default',
      name: 'Agent系统提示词',
      category: 'agent',
      content: `{{basePrompt}}

{{#if hasTools}}
## 可用工具

{{tools}}

## 工具使用规则

当用户的问题需要使用工具来获取信息时，你必须调用相应的工具。
{{/if}}

## 回答要求

1. 准确回答用户问题
2. 使用友好、专业的语气
3. 如果不确定，请明确说明`,
      variables: JSON.stringify([
        { name: 'basePrompt', type: 'string', required: true, description: '智能体的基础提示词' },
        { name: 'hasTools', type: 'boolean', required: false, defaultValue: false, description: '是否有可用工具' },
        { name: 'tools', type: 'string', required: false, description: '工具描述' }
      ]),
      isDefault: true,
      status: true,
      description: 'Agent默认模式的系统提示词模板',
    },
  });
  console.log('✅ 创建 Agent 系统提示词模板:', agentTemplate.code);

  /**
   * todo:使用 ** 粗体格式是为了：
    1. ✅ 突出重点 ：让模型关注容易出错的关键规则
    2. ✅ 提高准确性 ：减少格式错误的发生
    3. ✅ 引导注意力 ：利用 Markdown 格式引导模型的注意力权重
    这是一种提示词工程的技巧，通过格式化文本来提高模型输出的质量和准确性。
   */
  // 3. ReAct 推理模板
  const reactTemplate = await prisma.promptTemplate.create({
    data: {
      code: 'react-reasoning-default',
      name: 'ReAct推理提示词',
      category: 'react',
      content: `{{basePrompt}}

## 可用工具

{{tools}}

## 工具使用规则

当用户的问题需要使用工具来获取信息时，你必须调用相应的工具。

## 回答格式（严格遵守）

每个标记必须独占一行，格式如下：

Thought: 思考当前需要做什么，分析用户问题和已有信息
Action: 要执行的工具名称（必须是上述工具之一）
Action Input: 工具参数，JSON格式，例如：{}
Observation: 工具返回结果（由系统自动提供）

... (这个 Thought/Action/Action Input/Observation 可以重复多次)

Thought: 我现在知道最终答案了
Final Answer: 对用户问题的最终回答

## 重要规则

1. 每次只能调用一个工具
2. **必须严格按照格式输出，每个标记独占一行**
3. **标记后面必须有冒号和空格，例如："Thought: "而不是"Thought"**
4. 收到 Observation 后，继续思考下一步行动
5. 当你有足够信息回答用户问题时，输出 Final Answer
6. Final Answer 必须用自然语言回答，不要提及工具调用细节
7. **如果不需要调用工具，直接输出 Final Answer**`,
      variables: JSON.stringify([
        { name: 'basePrompt', type: 'string', required: true, description: '智能体的基础提示词' },
        { name: 'tools', type: 'string', required: true, description: '工具描述' }
      ]),
      isDefault: true,
      status: true,
      description: 'ReAct推理模式的提示词模板',
    },
  });
  console.log('✅ 创建 ReAct 推理模板:', reactTemplate.code);

  // 4. Plan 推理模板
  const planTemplate = await prisma.promptTemplate.create({
    data: {
      code: 'plan-reasoning-default',
      name: 'Plan推理提示词',
      category: 'react',
      content: `{{basePrompt}}

## 可用工具

{{tools}}

## 任务规划

请按照以下步骤完成任务：

1. 分析用户需求
2. 制定执行计划
3. 按计划执行
4. 总结结果

## 回答格式

Plan: [制定计划]
Step 1: [执行步骤1]
Step 2: [执行步骤2]
...
Final Answer: [最终答案]`,
      variables: JSON.stringify([
        { name: 'basePrompt', type: 'string', required: true, description: '智能体的基础提示词' },
        { name: 'tools', type: 'string', required: true, description: '工具描述' }
      ]),
      isDefault: false,
      status: true,
      description: 'Plan推理模式的提示词模板',
    },
  });
  console.log('✅ 创建 Plan 推理模板:', planTemplate.code);

  // 5. Reflect 推理模板
  const reflectTemplate = await prisma.promptTemplate.create({
    data: {
      code: 'reflect-reasoning-default',
      name: 'Reflect推理提示词',
      category: 'react',
      content: `{{basePrompt}}

## 可用工具

{{tools}}

## 反思机制

在回答问题之前，请先思考：

1. 我是否理解了用户的问题？
2. 我需要哪些信息来回答这个问题？
3. 我如何获取这些信息？
4. 我的回答是否准确？

## 回答格式

Thought: [思考过程]
Reflection: [反思]
Action: [行动]
Final Answer: [最终答案]`,
      variables: JSON.stringify([
        { name: 'basePrompt', type: 'string', required: true, description: '智能体的基础提示词' },
        { name: 'tools', type: 'string', required: true, description: '工具描述' }
      ]),
      isDefault: false,
      status: true,
      description: 'Reflect推理模式的提示词模板',
    },
  });
  console.log('✅ 创建 Reflect 推理模板:', reflectTemplate.code);

  // 6. 技能调用模板
  const skillTemplate = await prisma.promptTemplate.create({
    data: {
      code: 'skill-invoke-default',
      name: '技能调用提示词',
      category: 'skill',
      content: `你是一个技能调用助手。

## 技能信息
- 名称: {{skillName}}
- 描述: {{skillDescription}}
- 类型: {{skillType}}

## 用户请求
{{userRequest}}

## 任务
请根据用户请求，分析需要调用哪个技能，以及需要传递什么参数。`,
      variables: JSON.stringify([
        { name: 'skillName', type: 'string', required: true, description: '技能名称' },
        { name: 'skillDescription', type: 'string', required: true, description: '技能描述' },
        { name: 'skillType', type: 'string', required: true, description: '技能类型' },
        { name: 'userRequest', type: 'string', required: true, description: '用户请求' }
      ]),
      isDefault: true,
      status: true,
      description: '技能调用场景的提示词模板',
    },
  });
  console.log('✅ 创建技能调用模板:', skillTemplate.code);

  console.log('\n🎉 所有 Prompt Template 初始数据插入完成！');
}

main()
  .catch((e) => {
    console.error('❌ 插入数据失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
