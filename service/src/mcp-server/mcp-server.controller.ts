import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { McpServerService } from './mcp-server.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import {
  DiscoverToolsDto,
  TestConnectionDto,
} from './dto/mcp-server.dto';
import { success } from '../common/response/api.response';

/**
 * MCP Server控制器
 * 提供MCP Server的管理接口
 */
@ApiTags('MCP Server（管理端）')
@ApiBearerAuth()
@Controller('admin/mcp-server')
@UseGuards(CombinedAuthGuard, ScopeGuard)
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
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
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
  @RequireScope(AdminScope.MCP_SERVER_WRITE)
  async testConnection(@Body() dto: TestConnectionDto) {
    const result = await this.mcpServerService.testConnection(dto);
    return success(result);
  }
}