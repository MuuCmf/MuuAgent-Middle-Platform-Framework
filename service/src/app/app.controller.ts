import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { CreateAppDto, UpdateAppDto, QueryAppDto, ResetSecretDto } from './dto/app.dto';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequireScope } from '../common/decorators/scope.decorator';
import { AdminScope } from '../common/constants/scope.constants';
import { success, page } from '../common/response/api.response';

/**
 * 应用管理控制器
 * 
 * 提供应用的CRUD接口，包括：
 * - 创建应用
 * - 更新应用
 * - 删除应用
 * - 查询应用列表
 * - 查询应用详情
 * - 重置应用密钥
 * - 获取应用使用统计
 */
@ApiTags('应用管理')
@Controller('admin/apps')
@UseGuards(CombinedAuthGuard, ScopeGuard)
@ApiBearerAuth()
export class AppController {
  /**
   * 构造函数
   * @param appService 应用服务
   */
  constructor(private readonly appService: AppService) {}

  /**
   * 获取应用列表
   * @param query 查询参数
   * @returns {Promise<object>} 应用列表
   */
  @Get('/')
  @ApiOperation({ summary: '获取应用列表' })
  @RequireScope(AdminScope.APP_READ)
  async getList(@Query() query: QueryAppDto) {
    const result = await this.appService.findAll(query);
    return page(result.list, result.total, query.page || 1, query.pageSize || 10);
  }

  /**
   * 获取应用详情
   * @param id 应用ID
   * @returns {Promise<object>} 应用详情
   */
  @Get('/:id')
  @ApiOperation({ summary: '获取应用详情' })
  @ApiParam({ name: 'id', description: '应用ID' })
  @RequireScope(AdminScope.APP_READ)
  async getOne(@Param('id') id: string) {
    const result = await this.appService.findOne(id);
    return success(result);
  }

  /**
   * 创建应用
   * @param dto 创建DTO
   * @returns {Promise<object>} 创建结果
   */
  @Post('/')
  @ApiOperation({ summary: '创建应用' })
  @RequireScope(AdminScope.APP_WRITE)
  async create(@Body() dto: CreateAppDto) {
    const result = await this.appService.create(dto);
    return success(result, '创建应用成功');
  }

  /**
   * 更新应用
   * @param id 应用ID
   * @param dto 更新DTO
   * @returns {Promise<object>} 更新结果
   */
  @Put('/:id')
  @ApiOperation({ summary: '更新应用' })
  @ApiParam({ name: 'id', description: '应用ID' })
  @RequireScope(AdminScope.APP_WRITE)
  async update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    const result = await this.appService.update(id, dto);
    return success(result, '更新应用成功');
  }

  /**
   * 删除应用
   * @param id 应用ID
   * @returns {Promise<void>}
   */
  @Delete('/:id')
  @ApiOperation({ summary: '删除应用' })
  @ApiParam({ name: 'id', description: '应用ID' })
  @RequireScope(AdminScope.APP_WRITE)
  async delete(@Param('id') id: string) {
    await this.appService.delete(id);
    return success(null, '删除应用成功');
  }

  /**
   * 重置应用密钥
   * @param id 应用ID
   * @param dto 重置DTO
   * @returns {Promise<object>} 新的密钥信息
   */
  @Post('/:id/reset-secret')
  @ApiOperation({ summary: '重置应用密钥' })
  @ApiParam({ name: 'id', description: '应用ID' })
  @RequireScope(AdminScope.APP_WRITE)
  async resetSecret(@Param('id') id: string, @Body() dto: ResetSecretDto) {
    const result = await this.appService.resetSecret(id, dto);
    return success(result, '重置密钥成功');
  }

  /**
   * 获取应用使用统计
   * @param id 应用ID
   * @returns {Promise<object>} 使用统计
   */
  @Get('/:id/usage')
  @ApiOperation({ summary: '获取应用使用统计' })
  @ApiParam({ name: 'id', description: '应用ID' })
  @RequireScope(AdminScope.APP_READ)
  async getUsage(@Param('id') id: string) {
    const result = await this.appService.getUsage(id);
    return success(result);
  }
}
