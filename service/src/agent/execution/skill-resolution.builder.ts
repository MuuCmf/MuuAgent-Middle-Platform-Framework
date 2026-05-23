import { Injectable, Logger } from '@nestjs/common';
import { SkillRegistry, SkillDescriptor } from '../../skill/skill-registry';
import { IsolationContext } from '../../common/services/base-isolated.service';
import { AgentSkills } from '../types/agent-skills';

export interface SkillResolutionResult {
  boundSkills: SkillDescriptor[];
  availableSkillNames: string;
  resolvedMcpServers: string[];
  /**
   * 工作目录能力是否已启用
   * 当任意绑定的技能声明 requires.workspace = true 时启用
   */
  resolvedWorkspace: boolean;
  /**
   * 系统控制能力是否已启用
   * 当任意绑定的技能声明 requires.systemControl = true 时启用
   */
  resolvedSystemControl: boolean;
}

@Injectable()
export class SkillResolutionBuilder {
  private readonly logger = new Logger(SkillResolutionBuilder.name);

  constructor(
    private readonly skillRegistry: SkillRegistry,
  ) {}

  async resolve(
    agentSkills: AgentSkills,
    isolationContext: IsolationContext,
    agentMcpServers?: string[],
  ): Promise<SkillResolutionResult> {
    const skillNames = agentSkills.toArray();
    const boundSkills = await this.resolveSkillsWithDependencies(skillNames, isolationContext);
    const availableSkillNames = boundSkills.map(s => s.metadata.name).join(', ') || '无';

    const resolvedMcpServers = new Set<string>();
    const hasAgentMcpServers = agentMcpServers && agentMcpServers.length > 0;

    if (hasAgentMcpServers) {
      for (const serverName of agentMcpServers) {
        resolvedMcpServers.add(serverName);
      }

      for (const skill of boundSkills) {
        const required = skill.frontmatter?.requires?.mcpServers || [];
        const missing = required.filter(s => !resolvedMcpServers.has(s));
        if (missing.length > 0) {
          this.logger.warn(
            `技能 "${skill.metadata.name}" 需要 MCP Server [${missing.join(', ')}]，但 Agent 未绑定，将跳过该技能`,
          );
        }
      }
    } else {
      for (const skill of boundSkills) {
        if (skill.frontmatter?.requires?.mcpServers) {
          for (const serverName of skill.frontmatter.requires.mcpServers) {
            resolvedMcpServers.add(serverName);
          }
        }
      }
    }

    const resolvedWorkspace = boundSkills.some(
      skill => skill.frontmatter?.requires?.workspace === true,
    );

    const resolvedSystemControl = boundSkills.some(
      skill => skill.frontmatter?.requires?.systemControl === true,
    );

    return {
      boundSkills,
      availableSkillNames,
      resolvedMcpServers: Array.from(resolvedMcpServers),
      resolvedWorkspace,
      resolvedSystemControl,
    };
  }

  private async resolveSkillsWithDependencies(
    skillNames: string[],
    isolationContext: IsolationContext,
  ): Promise<SkillDescriptor[]> {
    const resolved: SkillDescriptor[] = [];
    const visited = new Set<string>();

    for (const name of skillNames) {
      await this.resolveSkillRecursive(name, isolationContext, visited, resolved);
    }

    return resolved;
  }

  private async resolveSkillRecursive(
    name: string,
    isolationContext: IsolationContext,
    visited: Set<string>,
    resolved: SkillDescriptor[],
  ): Promise<void> {
    if (visited.has(name)) return;
    visited.add(name);

    const skill = await this.skillRegistry.resolve(name, isolationContext);
    if (!skill) {
      this.logger.warn(`技能 "${name}" 不存在或无法解析`);
      return;
    }

    if (skill.frontmatter?.requires?.skills) {
      for (const depName of skill.frontmatter.requires.skills) {
        await this.resolveSkillRecursive(depName, isolationContext, visited, resolved);
      }
    }

    resolved.push(skill);
  }
}
