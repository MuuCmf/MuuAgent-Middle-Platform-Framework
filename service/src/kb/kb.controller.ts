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
import { KbService } from './kb.service';
import { CreateKbDto } from './dto/create-kb.dto';
import { UpdateKbDto } from './dto/update-kb.dto';
import { QueryKbListDto } from './dto/query-kb-list.dto';
import { DeleteKbDto } from './dto/delete-kb.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { success, page } from '../common/response/api.response';

/**
 * 知识库管理控制器
 */
@ApiTags('知识库管理')
@ApiBearerAuth()
@UseGuards(AdminGuard)
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
  async create(@Body() dto: CreateKbDto) {
    const result = await this.kbService.create(dto);
    return success(result, '创建知识库成功');
  }

  /**
   * 查询知识库列表
   * @param dto 查询参数
   * @returns {Promise<any>} 查询结果
   */
  @Get()
  @ApiOperation({ summary: '查询知识库列表' })
  async findAll(@Query() dto: QueryKbListDto) {
    const result = await this.kbService.findAll(dto);
    return page(result.list, result.total, dto.pageNum || 1, dto.pageSize || 10);
  }

  /**
   * 查询知识库详情
   * @param kbId 知识库ID
   * @returns {Promise<any>} 知识库详情
   */
  @Get(':kbId')
  @ApiOperation({ summary: '查询知识库详情' })
  async findOne(@Param('kbId') kbId: string) {
    const result = await this.kbService.findOne(kbId);
    return success(result);
  }

  /**
   * 更新知识库
   * @param dto 更新参数
   * @returns {Promise<any>} 更新结果
   */
  @Put()
  @ApiOperation({ summary: '更新知识库' })
  async update(@Body() dto: UpdateKbDto) {
    const result = await this.kbService.update(dto);
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
  async delete(@Param('kbId') kbId: string, @Body() dto: DeleteKbDto) {
    const result = await this.kbService.delete({ ...dto, kbId });
    return success(result, '删除知识库成功');
  }
}
