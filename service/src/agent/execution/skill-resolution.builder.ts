import { Injectable, Logger } from '@nestjs/common';
import { SkillRegistry, SkillDescriptor } from '../../skill/skill-registry';
import { IsolationContext } from '../../common/services/base-isolated.service';
import { AgentSkills } from '../types/agent-skills';

export interface SkillResolutionResult {
  boundSkills: SkillDescriptor[];
  availableSkillNames: string;
  resolvedMcpServers: string[];
}

@Injectable()
export class SkillResolutionBuilder {
  private readonly logger = new Logger(SkillResolutionBuilder.name);

  constructor(
    private readonly skillRegistry: SkillRegistry,
  ) {}

  async resolve(agentSkills: AgentSkills, isolationContext: IsolationContext): Promise<SkillResolutionResult> {
    const skillNames = agentSkills.toArray();
    const boundSkills = await this.resolveSkillsWithDependencies(skillNames, isolationContext);
    const availableSkillNames = boundSkills.map(s => s.metadata.name).join(', ') || '无';

    const resolvedMcpServers = new Set<string>();

    for (const skill of boundSkills) {
      if (skill.frontmatter?.requires?.mcpServers) {
        for (const serverName of skill.frontmatter.requires.mcpServers) {
          resolvedMcpServers.add(serverName);
        }
      }
    }

    return {
      boundSkills,
      availableSkillNames,
      resolvedMcpServers: Array.from(resolvedMcpServers),
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
