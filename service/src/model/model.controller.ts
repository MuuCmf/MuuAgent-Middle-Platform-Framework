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
import { ModelService } from './model.service';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  CreateModelDto,
  UpdateModelDto,
  QueryModelDto,
} from './dto/model.dto';
import { success, page } from '../common/response/api.response';

/**
 * 模型管理控制器
 * 提供模型的CRUD接口
 */
@ApiTags('模型管理')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/model')
export class ModelController {
  /**
   * 构造函数
   * @param modelService 模型服务
   */
  constructor(private readonly modelService: ModelService) {}

  /**
   * 创建模型
   * @param dto 创建模型DTO
   * @returns {Promise<Object>} 创建结果
   */
  @Post()
  @ApiOperation({ summary: '创建模型' })
  async create(@Body() dto: CreateModelDto) {
    const model = await this.modelService.create(dto);
    return success(model, '模型创建成功');
  }

  /**
   * 更新模型
   * @param id 模型ID
   * @param dto 更新模型DTO
   * @returns {Promise<Object>} 更新结果
   */
  @Put(':id')
  @ApiOperation({ summary: '更新模型' })
  async update(@Param('id') id: string, @Body() dto: UpdateModelDto) {
    const model = await this.modelService.update(id, dto);
    return success(model, '模型更新成功');
  }

  /**
   * 删除模型
   * @param id 模型ID
   * @returns {Promise<Object>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除模型' })
  async remove(@Param('id') id: string) {
    await this.modelService.remove(id);
    return success(null, '模型删除成功');
  }

  /**
   * 查询模型详情
   * @param id 模型ID
   * @returns {Promise<Object>} 模型详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询模型详情' })
  async findOne(@Param('id') id: string) {
    const model = await this.modelService.findOne(id);
    return success(model);
  }

  /**
   * 查询模型列表
   * @param query 查询参数
   * @returns {Promise<Object>} 模型列表
   */
  @Get()
  @ApiOperation({ summary: '查询模型列表' })
  async findAll(@Query() query: QueryModelDto) {
    const { list, total, page: pageNum, pageSize } = await this.modelService.findAll(query);
    return page(list, total, pageNum, pageSize);
  }

  /**
   * 模型健康检查
   * @param id 模型ID
   * @returns {Promise<Object>} 健康检查结果
   */
  @Get(':id/health')
  @ApiOperation({ summary: '模型健康检查' })
  async healthCheck(@Param('id') id: string) {
    const result = await this.modelService.healthCheck(id);
    return success(result);
  }

  /**
   * 批量健康检查
   * @returns {Promise<Object>} 所有模型健康检查结果
   */
  @Get('health/all')
  @ApiOperation({ summary: '批量健康检查' })
  async healthCheckAll() {
    const results = await this.modelService.healthCheckAll();
    return success(results);
  }

  /**
   * 切换模型状态
   * @param id 模型ID
   * @param status 状态
   * @returns {Promise<Object>} 更新结果
   */
  @Put(':id/status')
  @ApiOperation({ summary: '切换模型状态' })
  async toggleStatus(@Param('id') id: string, @Body('status') status: boolean) {
    const model = await this.modelService.toggleStatus(id, status);
    return success(model, '状态更新成功');
  }
}
