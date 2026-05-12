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
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { KbService } from './kb.service';
import { CreateKbDto } from './dto/create-kb.dto';
import { UpdateKbDto } from './dto/update-kb.dto';
import { QueryKbListDto } from './dto/query-kb-list.dto';
import { DeleteKbDto } from './dto/delete-kb.dto';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimitInterceptor } from '../rate-limit/rate-limit.interceptor';
import { extractIsolationContext } from '../common/utils/isolation.util';
import { success, page } from '../common/response/api.response';
import { Request } from 'express';

/**
 * 知识库管理控制器（管理端）
 */
@ApiTags('知识库（管理端）')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/kb')
export class KbController {
  /**
   * 构造函数
   * @param kbService 知识库服务
   */
  constructor(private readonly kbService: KbService) {}

  /**
   * 创建知识库
   * @param dto 创建参数
   * @returns {Promise<any>} 创建结果
   */
  @Post()
  @ApiOperation({ summary: '创建知识库' })
  @RequireScope(AdminScope.KB_WRITE)
  async create(@Body() dto: CreateKbDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.kbService.create(dto, context);
    return success(result, '创建知识库成功');
  }

  /**
   * 查询知识库列表
   * @param dto 查询参数
   * @returns {Promise<any>} 查询结果
   */
  @Get()
  @ApiOperation({ summary: '查询知识库列表' })
  @RequireScope(AdminScope.KB_READ)
  async findAll(@Query() dto: QueryKbListDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.kbService.findAll(dto, context);
    return page(result.list, result.total, dto.pageNum || 1, dto.pageSize || 10);
  }

  /**
   * 查询知识库详情
   * @param kbId 知识库ID
   * @returns {Promise<any>} 知识库详情
   */
  @Get(':kbId')
  @ApiOperation({ summary: '查询知识库详情' })
  @RequireScope(AdminScope.KB_READ)
  async findOne(@Param('kbId') kbId: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.kbService.findOne(kbId, context);
    return success(result);
  }

  /**
   * 更新知识库
   * @param dto 更新参数
   * @returns {Promise<any>} 更新结果
   */
  @Put()
  @ApiOperation({ summary: '更新知识库' })
  @RequireScope(AdminScope.KB_WRITE)
  async update(@Body() dto: UpdateKbDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.kbService.update(dto, context);
    return success(result, '更新知识库成功');
  }

  /**
   * 删除知识库
   * @param kbId 知识库ID
   * @param dto 删除参数
   * @returns {Promise<any>} 删除结果
   */
  @Delete(':kbId')
  @ApiOperation({ summary: '删除知识库' })
  @RequireScope(AdminScope.KB_WRITE)
  async delete(@Param('kbId') kbId: string, @Body() dto: DeleteKbDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.kbService.delete({ ...dto, kbId }, context);
    return success(result, '删除知识库成功');
  }
}

/**
 * 业务端知识库控制器
 * 提供公开的知识库查询接口
 */
@ApiTags('知识库（业务端）')
@ApiBearerAuth()
@UseGuards(TenantGuard, RateLimitGuard)
@UseInterceptors(RateLimitInterceptor)
@Controller('kb')
export class ClientKbController {
  /**
   * 构造函数
   * @param kbService 知识库服务
   */
  constructor(private readonly kbService: KbService) {}

  /**
   * 过滤敏感字段
   * @param kb 知识库数据
   * @returns {any} 过滤后的知识库数据
   */
  private filterSensitiveData(kb: any): any {
    const { createdBy, updatedBy, ...safeData } = kb;
    return safeData;
  }

  /**
   * 获取启用的知识库列表
   * @returns {Promise<Object>} 启用的知识库列表
   */
  @Get()
  @ApiOperation({ summary: '获取启用的知识库列表', description: '获取所有已启用且公开的知识库列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEnabledKbs(@Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.kbService.findAll({
      status: 'true',
      pageNum: 1,
      pageSize: 100,
    }, context);

    // buildIsolationWhere 已处理可见性逻辑：租户可见自己的（含私有）+ 公开的
    const safeKbs = result.list.map((kb: any) => this.filterSensitiveData(kb));

    return success(safeKbs);
  }

  /**
   * 获取知识库详情
   * @param kbId 知识库ID
   * @returns {Promise<Object>} 知识库详情
   */
  @Get(':kbId')
  @ApiOperation({ summary: '获取知识库详情', description: '根据知识库ID获取详情，仅返回已启用且公开的知识库' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '知识库不存在或未公开' })
  async getKbById(@Param('kbId') kbId: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const kb = await this.kbService.findOne(kbId, context);

    // findOne 已通过 buildIsolationWhere 控制访问权限，只需检查启用状态
    if (!kb.status) {
      return success(null, '知识库未启用');
    }

    return success(this.filterSensitiveData(kb));
  }
}
