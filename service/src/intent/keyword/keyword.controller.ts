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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntentKeywordService } from './keyword.service';
import { IntentClassifierService } from '../intent.service';
import { CombinedAuthGuard } from '../../common/guards/combined-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AdminScope } from '../../common/constants/scope.constants';
import {
  CreateIntentKeywordDto,
  UpdateIntentKeywordDto,
  QueryIntentKeywordDto,
  BatchImportKeywordDto,
} from '../dto/intent-keyword.dto';
import { success, page } from '../../common/response/api.response';

/**
 * 意图关键词管理控制器
 * 提供关键词的CRUD接口，需要管理员权限
 */
@ApiTags('意图关键词')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/intent-keyword')
export class IntentKeywordController {
  /**
   * 构造函数
   * @param intentKeywordService 关键词服务
   * @param intentClassifier 意图分类服务（用于重载关键词）
   */
  constructor(
    private readonly intentKeywordService: IntentKeywordService,
    private readonly intentClassifier: IntentClassifierService,
  ) {}

  /**
   * 关键词变更后重载意图服务缓存
   */
  private async reloadAfterChange() {
    await this.intentClassifier.reloadKeywords();
  }

  /**
   * 创建关键词
   * @param dto 创建关键词DTO
   * @returns {Promise<Object>} 创建结果
   */
  @Post()
  @ApiOperation({ summary: '创建关键词' })
  @RequireScope(AdminScope.INTENT_KEYWORD_WRITE)
  async create(@Body() dto: CreateIntentKeywordDto) {
    const result = await this.intentKeywordService.create(dto);
    await this.reloadAfterChange();
    return success(result, '关键词创建成功');
  }

  /**
   * 更新关键词
   * @param id 关键词ID
   * @param dto 更新关键词DTO
   * @returns {Promise<Object>} 更新结果
   */
  @Put(':id')
  @ApiOperation({ summary: '更新关键词' })
  @RequireScope(AdminScope.INTENT_KEYWORD_WRITE)
  async update(@Param('id') id: string, @Body() dto: UpdateIntentKeywordDto) {
    const result = await this.intentKeywordService.update(id, dto);
    await this.reloadAfterChange();
    return success(result, '关键词更新成功');
  }

  /**
   * 删除关键词
   * @param id 关键词ID
   * @returns {Promise<Object>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除关键词' })
  @RequireScope(AdminScope.INTENT_KEYWORD_WRITE)
  async remove(@Param('id') id: string) {
    await this.intentKeywordService.remove(id);
    await this.reloadAfterChange();
    return success(null, '关键词删除成功');
  }

  /**
   * 查询关键词详情
   * @param id 关键词ID
   * @returns {Promise<Object>} 关键词详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询关键词详情' })
  @RequireScope(AdminScope.INTENT_KEYWORD_READ)
  async findOne(@Param('id') id: string) {
    const result = await this.intentKeywordService.findOne(id);
    return success(result);
  }

  /**
   * 查询关键词列表
   * @param query 查询参数
   * @returns {Promise<Object>} 关键词列表
   */
  @Get()
  @ApiOperation({ summary: '查询关键词列表' })
  @RequireScope(AdminScope.INTENT_KEYWORD_READ)
  async findAll(@Query() query: QueryIntentKeywordDto) {
    const { list, total, page: pageNum, pageSize } = await this.intentKeywordService.findAll(query);
    return page(list, total, pageNum, pageSize);
  }

  /**
   * 批量导入关键词
   * @param dto 批量导入DTO
   * @returns {Promise<Object>} 导入结果
   */
  @Post('batch-import')
  @ApiOperation({ summary: '批量导入关键词' })
  @RequireScope(AdminScope.INTENT_KEYWORD_WRITE)
  async batchImport(@Body() dto: BatchImportKeywordDto) {
    const result = await this.intentKeywordService.batchImport(dto);
    await this.reloadAfterChange();
    return success(result, `导入完成：新增${result.created}条，跳过${result.skipped}条`);
  }

  /**
   * 切换关键词启用状态
   * @param id 关键词ID
   * @param status 状态
   * @returns {Promise<Object>} 更新结果
   */
  @Put(':id/status')
  @ApiOperation({ summary: '切换关键词启用状态' })
  @RequireScope(AdminScope.INTENT_KEYWORD_WRITE)
  async toggleStatus(@Param('id') id: string, @Body('status') status: boolean) {
    const result = await this.intentKeywordService.toggleStatus(id, status);
    await this.reloadAfterChange();
    return success(result, '状态更新成功');
  }

  /**
   * 获取关键词统计
   * @returns {Promise<Object>} 关键词统计
   */
  @Get('stats/summary')
  @ApiOperation({ summary: '获取关键词统计' })
  @RequireScope(AdminScope.INTENT_KEYWORD_READ)
  async getStats() {
    const result = await this.intentKeywordService.getKeywordStats();
    return success(result);
  }
}