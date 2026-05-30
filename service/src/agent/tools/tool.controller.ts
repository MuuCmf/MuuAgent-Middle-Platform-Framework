import { Controller, Get, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ToolRegistry } from './tool-registry';
import { BuiltinToolDto } from './dto/builtin-tool.dto';
import { success } from '../../common/response/api.response';
import { CombinedAuthGuard } from '../../common/guards/combined-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AdminScope } from '../../common/constants/scope.constants';

/**
 * 工具管理控制器
 */
@ApiTags('工具管理')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/tools')
export class ToolController {
  constructor(private readonly toolRegistry: ToolRegistry) {}

  /**
   * 获取所有内置工具列表
   * @returns {Promise<BuiltinToolDto[]>} 内置工具列表
   */
  @Get('builtin')
  @ApiOperation({ summary: '获取内置工具列表' })
  @RequireScope(AdminScope.SKILL_READ)
  @ApiResponse({ status: 200, description: '成功获取内置工具列表', type: [BuiltinToolDto] })
  async getBuiltinTools() {
    const tools = this.toolRegistry.getBuiltinTools();
    console.log('[ToolController] 获取内置工具列表，数量:', tools.length);
    console.log('[ToolController] 工具列表:', tools.map(t => t.name));
    return success(tools);
  }

  /**
   * 获取工具详情
   * @param name 工具名称
   * @returns {Promise<BuiltinToolDto>} 工具详情
   */
  @Get('builtin/:name')
  @ApiOperation({ summary: '获取工具详情' })
  @RequireScope(AdminScope.SKILL_READ)
  @ApiResponse({ status: 200, description: '成功获取工具详情', type: BuiltinToolDto })
  @ApiResponse({ status: 404, description: '工具不存在' })
  async getToolDetail(@Param('name') name: string) {
    const tools = this.toolRegistry.getBuiltinTools();
    const tool = tools.find(t => t.name === name);
    
    if (!tool) {
      throw new NotFoundException('工具不存在');
    }
    
    return success(tool);
  }
}
