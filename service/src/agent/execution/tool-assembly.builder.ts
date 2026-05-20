import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry } from '../tools/tool-registry';
import { McpServerService } from '../../mcp-server/mcp-server.service';
import { McpServerRegistry } from '../../mcp-server/mcp-server-registry';
import { KbSearchTool } from '../tools/builtin/kb-search.tool';
import { ToolDefinition } from '../tools/abstract/tool.interface';
import { WORKSPACE_TOOLS } from '../../workspace/workspace-tool.definitions';
import { SkillResolutionResult } from './skill-resolution.builder';

@Injectable()
export class ToolAssemblyBuilder {
  private readonly logger = new Logger(ToolAssemblyBuilder.name);

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly mcpServerService: McpServerService,
    private readonly mcpServerRegistry: McpServerRegistry,
    private readonly kbSearchTool: KbSearchTool,
  ) {}

  async buildTools(
    resolution: SkillResolutionResult,
    resolvedKbCodes: string[],
    agent: { id: any; workspaceConfig?: any },
    workspaceEnabled: boolean,
    enableKbTool: boolean = true,
    kbToolConfig?: {
      defaultTopN: number;
      defaultSimilarityThresh: number;
      allowSpecifyKb: boolean;
    },
  ): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];

    this.logger.debug(`Building MCP tools for servers: ${JSON.stringify(resolution.resolvedMcpServers)}`);
    for (const serverName of resolution.resolvedMcpServers) {
      await this.addMcpTools(tools, serverName);
    }
    this.logger.debug(`Built ${tools.filter(t => t.type === 'mcp').length} MCP tools`);

    if (enableKbTool && resolvedKbCodes.length > 0) {
      const kbDef = this.kbSearchTool.definition;
      tools.push({
        ...kbDef,
        description: `${kbDef.description} 可用知识库代码: ${resolvedKbCodes.join(', ')}`,
      });
    }

    // 注册工具（use_skill, run_script, run_code 等）
    const { availableSkillNames, boundSkills } = resolution;
    const hasScriptedSkills = boundSkills.some(s => s.metadata.hasScripts);

    const registeredTools = this.toolRegistry.getAll();
    for (const tool of registeredTools) {
      const def = tool.definition;

      if (def.name === 'use_skill') {
        tools.push({
          ...def,
          description: `按需加载指定技能的完整指令。可用技能: ${availableSkillNames}。当需要技能的详细操作步骤、API参数格式或执行注意事项时调用此工具。`,
          parameters: {
            ...def.parameters,
            properties: {
              skill_name: {
                type: 'string',
                description: `要加载的技能名称。可用: ${availableSkillNames}`,
              },
            },
          },
        });
      } else if (def.name === 'run_script') {
        if (hasScriptedSkills) {
          tools.push({
            ...def,
            parameters: {
              ...def.parameters,
              properties: {
                ...def.parameters.properties,
                skill_name: {
                  type: 'string',
                  description: `技能名称。可用: ${availableSkillNames}`,
                },
              },
            },
          });
        }
      } else if (def.name === 'run_code') {
        tools.push(def);
      } else {
        const existing = tools.find(t => t.name === def.name);
        if (!existing) {
          tools.push(def);
        }
      }
    }

    // Workspace 工具
    if (workspaceEnabled && agent.workspaceConfig) {
      const config = typeof agent.workspaceConfig === 'string'
        ? JSON.parse(agent.workspaceConfig)
        : agent.workspaceConfig;

      if (config.enabled) {
        tools.push(...WORKSPACE_TOOLS);
      }
    }

    return tools;
  }

  private async addMcpTools(tools: ToolDefinition[], serverName: string): Promise<void> {
    const serverConfig = await this.mcpServerRegistry.get(serverName);
    if (!serverConfig) {
      this.logger.warn(`MCP Server ${serverName} 未在注册表中找到`);
      return;
    }

    try {
      const toolsResult = await this.mcpServerService.discoverTools({
        transport: serverConfig.transport,
        url: serverConfig.url,
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
        apiKey: serverConfig.apiKey,
        timeout: serverConfig.timeout || 30000,
      });

      if (Array.isArray(toolsResult)) {
        tools.push(...toolsResult.map(t => ({
          name: `mcp__${serverName}__${t.name}`,
          description: t.description || '',
          parameters: t.inputSchema || { type: 'object', properties: {} },
          type: 'mcp' as const,
        })));
      }
    } catch (e) {
      this.logger.warn(`从 MCP Server ${serverName} 发现工具失败: ${e}`);
    }
  }
}
