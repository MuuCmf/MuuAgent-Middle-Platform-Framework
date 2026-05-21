/**
 * SystemPromptBuilder 单元测试
 * 验证工具描述构建逻辑
 */
import { Test, TestingModule } from '@nestjs/testing';
import { SystemPromptBuilder } from './system-prompt.builder';
import { ToolDefinition } from '../tools/abstract/tool.interface';

describe('SystemPromptBuilder', () => {
  let builder: SystemPromptBuilder;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemPromptBuilder],
    }).compile();

    builder = module.get<SystemPromptBuilder>(SystemPromptBuilder);
  });

  describe('基础功能', () => {
    it('应该正确构建无工具的系统提示词', () => {
      const agent = { systemPrompt: '你是一个助手' };
      const result = builder.build(agent, []);

      expect(result).toBe('你是一个助手');
      expect(result).not.toContain('## 可用工具');
    });

    it('应该包含推理规则', () => {
      const agent = {
        systemPrompt: '你是一个助手',
        reasoningMode: 'REACT',
      };
      const result = builder.build(agent, []);

      expect(result).toContain('## 推理规则');
      expect(result).toContain('思考：');
      expect(result).toContain('行动：');
    });
  });

  describe('工具数量 < 15 (详细模式)', () => {
    it('应该使用详细模式显示工具', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'test_tool',
          description: '这是一个测试工具',
          type: 'builtin',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '名称' },
            },
            required: ['name'],
          },
        },
      ];

      const result = builder.build({ systemPrompt: '助手' }, tools);

      expect(result).toContain('## 可用工具');
      expect(result).toContain('- test_tool: 这是一个测试工具');
      expect(result).toContain('参数:');
      expect(result).not.toContain('共1个');
    });

    it('应该截断过长的工具描述', () => {
      const longDesc = '这是一个非常非常长的工具描述用于测试截断功能是否正常工作'.repeat(12);
      const tools: ToolDefinition[] = [
        {
          name: 'long_desc_tool',
          description: longDesc,
          type: 'builtin',
          parameters: { type: 'object', properties: {} },
        },
      ];

      const result = builder.build({ systemPrompt: '助手' }, tools);

      expect(result).toContain('- long_desc_tool:');
      const toolLineMatch = result.match(/- long_desc_tool: (.+?)(?:\n|$)/);
      expect(toolLineMatch).not.toBeNull();

      if (toolLineMatch && toolLineMatch[1]) {
        const toolLine = toolLineMatch[1];
        console.log('Tool line length:', toolLine.length);
        console.log('Tool line ends with ...:', toolLine.endsWith('...'));
        expect(toolLine.length).toBeLessThanOrEqual(210);
        expect(toolLine.endsWith('...')).toBe(true);
      }
    });
  });

  describe('工具数量 >= 15 (精简模式)', () => {
    it('应该使用精简模式显示工具', () => {
      const tools: ToolDefinition[] = Array.from({ length: 16 }, (_, i) => ({
        name: `mcp__filesystem__tool_${i}`,
        description: `文件系统工具 ${i}`,
        type: 'mcp' as const,
        parameters: { type: 'object', properties: {} },
      }));

      const result = builder.build({ systemPrompt: '助手' }, tools);

      expect(result).toContain('## 可用工具 (共16个');
      expect(result).toContain('📁 文件系统操作');
      expect(result).toContain('💡 提示');
    });

    it('应该按类别分组工具', () => {
      const tools: ToolDefinition[] = [
        { name: 'mcp__filesystem__read', description: '读取文件', type: 'mcp' as const, parameters: { type: 'object', properties: {} } },
        { name: 'mcp__filesystem__write', description: '写入文件', type: 'mcp' as const, parameters: { type: 'object', properties: {} } },
        { name: 'http_request', description: 'HTTP请求', type: 'builtin' as const, parameters: { type: 'object', properties: {} } },
        { name: 'kb_search', description: '知识库搜索', type: 'kb' as const, parameters: { type: 'object', properties: {} } },
        ...Array.from({ length: 12 }, (_, i) => ({
          name: `tool_${i}`,
          description: `其他工具 ${i}`,
          type: 'builtin' as const,
          parameters: { type: 'object', properties: {} },
        })),
      ];

      const result = builder.build({ systemPrompt: '助手' }, tools);

      expect(result).toContain('📁 文件系统操作');
      expect(result).toContain('🌐 网络请求');
      expect(result).toContain('📚 知识库检索');
      expect(result).toContain('提示：如需了解某个工具的详细参数');
    });
  });

  describe('参数简化', () => {
    it('应该正确标记必填参数', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'test',
          description: '测试',
          type: 'builtin',
          parameters: {
            type: 'object',
            properties: {
              requiredParam: { type: 'string', description: '必填' },
              optionalParam: { type: 'number', description: '可选' },
            },
            required: ['requiredParam'],
          },
        },
      ];

      const result = builder.build({ systemPrompt: '助手' }, tools);

      expect(result).toContain('"requiredParam":"string* - 必填"');
      expect(result).toContain('"optionalParam":"number - 可选"');
    });

    it('应该处理枚举类型', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'enum_test',
          description: '枚举测试',
          type: 'builtin',
          parameters: {
            type: 'object',
            properties: {
              method: { type: 'string', enum: ['GET', 'POST'] },
            },
          },
        },
      ];

      const result = builder.build({ systemPrompt: '助手' }, tools);

      expect(result).toContain('(GET|POST)');
    });
  });

  describe('性能和边界情况', () => {
    it('应该处理空描述', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'no_desc',
          description: '',
          type: 'builtin',
          parameters: { type: 'object', properties: {} },
        },
      ];

      const result = builder.build({ systemPrompt: '助手' }, tools);

      expect(result).toContain('- no_desc:');
    });

    it('应该处理无参数的工具', () => {
      const tools: ToolDefinition[] = [
        {
          name: 'no_params',
          description: '无参数工具',
          type: 'builtin',
          parameters: undefined as any,
        },
      ];

      const result = builder.build({ systemPrompt: '助手' }, tools);

      expect(result).toContain("参数: {}");
    });
  });
});
