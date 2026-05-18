import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SkillService } from './skill.service';
import { SkillMdValidator } from './standard/skill-md-validator';
import { IsolationContext } from '../common/utils/isolation.util';
import * as yaml from 'js-yaml';
import * as path from 'path';

/**
 * 技能导出器
 * 将 DB 技能转换为 Agent Skills 标准目录结构
 */
@Injectable()
export class SkillExporter {
  private readonly logger = new Logger(SkillExporter.name);

  constructor(
    private readonly skillService: SkillService,
    private readonly validator: SkillMdValidator,
  ) {}

  /**
   * 将 DB 技能导出为标准格式
   * @returns 包含标准技能目录结构的文件映射 { 相对路径 → 内容 }
   */
  async exportToStandard(
    skillCode: string,
    context?: IsolationContext,
  ): Promise<Map<string, string | Buffer>> {
    const skill = await this.skillService.findByCode(skillCode, context);

    const files = new Map<string, string | Buffer>();

    // 生成 SKILL.md
    const skillMd = this.buildSkillMd(skill);
    files.set(`${skillCode}/SKILL.md`, skillMd);

    // 如果是 sandbox 类型，导出 codeContent 到 scripts/
    const sk = skill as any;
    if (sk.type === 'FUNCTION' && sk.codeType === 'sandbox' && sk.codeContent) {
      files.set(`${skillCode}/scripts/execute.js`, sk.codeContent);
    }

    this.logger.log(`导出技能 "${skillCode}" → ${files.size} 个文件`);
    return files;
  }

  /**
   * 构建 SKILL.md 内容
   */
  private buildSkillMd(skill: any): string {
    const frontmatter: Record<string, unknown> = {
      name: skill.code,
      description: skill.description || '',
      metadata: {
        source: 'muuai-platform',
        skillType: skill.type,
        exportedAt: new Date().toISOString(),
      },
    };

    if (skill.type === 'FUNCTION' && skill.codeType === 'sandbox') {
      frontmatter['allowed-tools'] = 'javascript';
    }

    const fmYaml = yaml.dump(frontmatter, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    }).trim();

    const body = this.buildBody(skill);

    return `---\n${fmYaml}\n---\n\n${body}`;
  }

  /**
   * 构建 SKILL.md 正文
   */
  private buildBody(skill: any): string {
    const sections: string[] = [];

    sections.push(`# ${skill.name}\n`);

    if (skill.description) {
      sections.push(`## 描述\n${skill.description}\n`);
    }

    // 参数
    try {
      const params = JSON.parse(skill.params || '{}');
      if (Object.keys(params).length > 0) {
        sections.push(`## 参数\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\`\n`);
      }
    } catch { /* ignore */ }

    // 类型说明
    sections.push(`## 类型\n${skill.type}\n`);

    if (skill.type === 'FUNCTION') {
      sections.push(`- 代码类型: ${skill.codeType || 'builtin'}`);
      if (skill.functionName) sections.push(`- 函数名: ${skill.functionName}`);
      if (skill.pluginName) sections.push(`- 插件名: ${skill.pluginName}`);
      sections.push('');
    }

    if (skill.type === 'HTTP') {
      // 仅导出公开的配置字段，避免泄露凭证
      try {
        const config = JSON.parse(skill.config || '{}');
        const safeConfig: Record<string, unknown> = {};
        if (config.url) safeConfig.url = config.url;
        if (config.method) safeConfig.method = config.method;
        sections.push(`## 配置\n\`\`\`json\n${JSON.stringify(safeConfig, null, 2)}\n\`\`\`\n`);
      } catch {
        sections.push(`## 配置\n\`\`\`json\n{}\n\`\`\`\n`);
      }
    }

    // 超时
    if (skill.timeout) {
      sections.push(`## 超时\n${skill.timeout}ms\n`);
    }

    sections.push('---\n');
    sections.push(`*由 MuuAI Middle Platform 导出 — ${new Date().toISOString()}*`);

    return sections.join('\n');
  }
}
