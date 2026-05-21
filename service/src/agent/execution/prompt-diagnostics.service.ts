/**
 * 提示词拼接诊断工具
 * 用于验证 ContextBuilder 生成的提示词是否完整
 */
import { Injectable, Logger } from '@nestjs/common';
import { ContextBuilder } from './context-builder';
import { AgentChatDto } from '../dto/agent.dto';

@Injectable()
export class PromptDiagnosticsService {
  private readonly logger = new Logger(PromptDiagnosticsService.name);

  constructor(private readonly contextBuilder: ContextBuilder) {}

  /**
   * 诊断提示词构建过程
   * @param dto 聊天请求DTO
   * @param agent Agent对象
   * @param uid 用户ID
   */
  async diagnose(dto: AgentChatDto, agent: any, uid?: string) {
    this.logger.log('🔍 开始诊断提示词构建过程...\n');

    const diagnosis = {
      timestamp: new Date().toISOString(),
      steps: [] as Array<{
        step: string;
        status: 'success' | 'warning' | 'error';
        details: string;
        data?: any;
      }>,
      finalPrompt: {
        systemLength: 0,
        toolCount: 0,
        hasToolDescriptions: false,
        truncated: false,
      },
      recommendations: [] as string[],
    };

    try {
      // 步骤1：构建上下文
      diagnosis.steps.push({
        step: '1. 构建ExecutionContext',
        status: 'success',
        details: '开始构建执行上下文',
      });

      const context = await this.contextBuilder.build(dto, agent, uid);

      // 步骤2：检查系统提示词
      const systemPrompt = context.systemPrompt;
      diagnosis.finalPrompt.systemLength = systemPrompt.length;

      diagnosis.steps.push({
        step: '2. 检查系统提示词',
        status: systemPrompt.length > 0 ? 'success' : 'error',
        details: `系统提示词长度: ${systemPrompt.length} 字符`,
        data: {
          length: systemPrompt.length,
          preview: systemPrompt.substring(0, 200) + '...',
        },
      });

      // 步骤3：检查工具描述
      const hasToolSection = systemPrompt.includes('## 可用工具');
      const toolCount = (systemPrompt.match(/^- \w+:/g) || []).length;

      diagnosis.finalPrompt.toolCount = toolCount;
      diagnosis.finalPrompt.hasToolDescriptions = hasToolSection;

      if (hasToolSection) {
        diagnosis.steps.push({
          step: '3. 检查工具描述',
          status: 'success',
          details: `✅ 找到工具描述部分，共 ${toolCount} 个工具`,
          data: { toolCount, hasToolSection: true },
        });
      } else {
        diagnosis.steps.push({
          step: '3. 检查工具描述',
          status: 'error',
          details: '❌ 未找到工具描述部分！工具可能未正确注入',
        });
        diagnosis.recommendations.push('检查 SystemPromptBuilder 是否接收到非空tools数组');
      }

      // 步骤4：检查提示词完整性
      const last100Chars = systemPrompt.slice(-100);
      const looksTruncated = last100Chars.includes(',') ||
                            last100Chars.includes('{') ||
                            last100Chars.includes('[');

      diagnosis.finalPrompt.truncated = looksTruncated;

      if (looksTruncated) {
        diagnosis.steps.push({
          step: '4. 检查提示词完整性',
          status: 'warning',
          details: '⚠️ 提示词可能在末尾被截断',
          data: { last100Chars },
        });
        diagnosis.recommendations.push('提示词过长，考虑精简工具数量或启用工具过滤');
      } else {
        diagnosis.steps.push({
          step: '4. 检查提示词完整性',
          status: 'success',
          details: '✅ 提示词看起来完整',
        });
      }

      // 步骤5：检查对话历史
      const historyLength = context.conversationHistory.length;
      diagnosis.steps.push({
        step: '5. 检查对话历史',
        status: 'success',
        details: `对话历史条数: ${historyLength}`,
        data: { historyLength },
      });

      // 步骤6：生成建议
      this.generateRecommendations(diagnosis, context);

      // 输出诊断报告
      this.printDiagnosisReport(diagnosis, systemPrompt);

      return diagnosis;

    } catch (error) {
      this.logger.error('❌ 诊断过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(diagnosis: any, context: any) {
    // 检查提示词长度
    if (diagnosis.finalPrompt.systemLength > 50000) {
      diagnosis.recommendations.push(
        '⚠️ 系统提示词超过50KB，可能导致性能问题或超出模型限制'
      );
    }

    // 检查工具数量
    if (diagnosis.finalPrompt.toolCount > 30) {
      diagnosis.recommendations.push(
        '💡 工具数量过多(>30)，建议按场景分组或使用工具路由'
      );
    }

    // 检查知识库增强
    if (context.autoRetrievalResult?.success) {
      const kbContext = context.systemPrompt.match(/## 知识库上下文[\s\S]*$/);
      if (kbContext) {
        diagnosis.steps.push({
          step: '5.5 知识库增强',
          status: 'success',
          details: `✅ 已添加知识库上下文 (${kbContext[0].length} 字符)`,
        });
      }
    }
  }

  /**
   * 打印诊断报告
   */
  private printDiagnosisReport(diagnosis: any, systemPrompt: string) {
    console.log('\n' + '='.repeat(80));
    console.log('📋 提示词诊断报告');
    console.log('='.repeat(80));
    console.log(`⏰ 时间: ${diagnosis.timestamp}`);
    console.log(`📏 系统提示词总长度: ${diagnosis.finalPrompt.systemLength} 字符`);
    console.log(`🔧 工具数量: ${diagnosis.finalPrompt.toolCount}`);
    console.log(`✅ 工具描述状态: ${diagnosis.finalPrompt.hasToolDescriptions ? '已包含' : '❌ 缺失'}`);
    console.log(`✂️  截断状态: ${diagnosis.finalPrompt.truncated ? '⚠️ 可能截断' : '✅ 完整'}`);

    console.log('\n📝 执行步骤:');
    console.log('-'.repeat(80));
    for (const step of diagnosis.steps) {
      const icon = step.status === 'success' ? '✅' : step.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${step.step}: ${step.details}`);
    }

    if (diagnosis.recommendations.length > 0) {
      console.log('\n💡 优化建议:');
      console.log('-'.repeat(80));
      for (const rec of diagnosis.recommendations) {
        console.log(`• ${rec}`);
      }
    }

    console.log('\n📄 系统提示词预览 (前500字符):');
    console.log('-'.repeat(80));
    console.log(systemPrompt.substring(0, 500));
    console.log('...');
    console.log('\n📄 系统提示词预览 (后500字符):');
    console.log('-'.repeat(80));
    console.log('...' + systemPrompt.slice(-500));

    console.log('\n' + '='.repeat(80) + '\n');
  }
}
