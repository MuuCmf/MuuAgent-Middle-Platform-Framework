import { Controller, Post, Body, Put, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { McpServerService } from './mcp-server.service';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  DiscoverToolsDto,
  TestConnectionDto,
  UpdateAgentMcpServersDto,
} from './dto/mcp-server.dto';
import { success } from '../common/response/api.response';

/**
 * MCP Server控制器
 * 提供MCP Server的管理接口
 */
@ApiTags('MCP Server管理')
@Controller('admin/mcp-server')
@UseGuards(AdminGuard)
export class McpServerController {
  /**
   * 构造函数
   * @param mcpServerService MCP Server服务
   */
  constructor(private readonly mcpServerService: McpServerService) {}

  /**
   * 发现MCP Server工具
   * @param dto 发现工具请求DTO
   * @returns {Promise<ApiResponseClass>} 工具列表
   */
  @Post('discover')
  @ApiOperation({ summary: '发现MCP Server工具' })
  @ApiResponse({ status: 200, description: '成功获取工具列表' })
  async discoverTools(@Body() dto: DiscoverToolsDto) {
    const tools = await this.mcpServerService.discoverTools(dto);
    return success({ tools });
  }

  /**
   * 测试MCP Server连接
   * @param dto 测试连接请求DTO
   * @returns {Promise<ApiResponseClass>} 测试结果
   */
  @Post('test')
  @ApiOperation({ summary: '测试MCP Server连接' })
  @ApiResponse({ status: 200, description: '测试完成' })
  async testConnection(@Body() dto: TestConnectionDto) {
    const result = await this.mcpServerService.testConnection(dto);
    return success(result);
  }

  /**
   * 更新智能体MCP Server配置
   * @param id 智能体ID
   * @param dto 更新配置DTO
   * @returns {Promise<ApiResponseClass>} 更新结果
   */
  @Put('agent/:id/mcp-servers')
  @ApiOperation({ summary: '更新智能体MCP Server配置' })
  @ApiResponse({ status: 200, description: '配置更新成功' })
  async updateAgentMcpServers(
    @Param('id') id: string,
    @Body() dto: UpdateAgentMcpServersDto,
  ) {
    const mcpServersJson = JSON.stringify(dto.mcpServers);
    return success({
      message: '配置更新成功',
      mcpServers: mcpServersJson,
    });
  }
}
