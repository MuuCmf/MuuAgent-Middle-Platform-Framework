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
import { SkillService } from './skill.service';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  CreateSkillDto,
  UpdateSkillDto,
  ExecuteSkillDto,
  QuerySkillDto,
} from './dto/skill.dto';
import { success, page } from '../common/response/api.response';

/**
 * 技能管理控制器
 */
@ApiTags('技能管理')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/skill')
export class SkillController {
  /**
   * 构造函数
   * @param skillService 技能服务
   */
  constructor(private readonly skillService: SkillService) {}

  /**
   * 创建技能
   * @param dto 创建技能DTO
   * @returns {Promise<Object>} 创建结果
   */
  @Post()
  @ApiOperation({ summary: '创建技能' })
  async create(@Body() dto: CreateSkillDto) {
    const skill = await this.skillService.create(dto);
    return success(skill, '技能创建成功');
  }

  /**
   * 更新技能
   * @param id 技能ID
   * @param dto 更新技能DTO
   * @returns {Promise<Object>} 更新结果
   */
  @Put(':id')
  @ApiOperation({ summary: '更新技能' })
  async update(@Param('id') id: string, @Body() dto: UpdateSkillDto) {
    const skill = await this.skillService.update(id, dto);
    return success(skill, '技能更新成功');
  }

  /**
   * 删除技能
   * @param id 技能ID
   * @returns {Promise<Object>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除技能' })
  async remove(@Param('id') id: string) {
    await this.skillService.remove(id);
    return success(null, '技能删除成功');
  }

  /**
   * 查询技能详情
   * @param id 技能ID
   * @returns {Promise<Object>} 技能详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询技能详情' })
  async findOne(@Param('id') id: string) {
    const skill = await this.skillService.findOne(id);
    return success(skill);
  }

  /**
   * 查询技能列表
   * @param query 查询参数
   * @returns {Promise<Object>} 技能列表
   */
  @Get()
  @ApiOperation({ summary: '查询技能列表' })
  async findAll(@Query() query: QuerySkillDto) {
    const { list, total, page: pageNum, pageSize } = await this.skillService.findAll(query);
    return page(list, total, pageNum, pageSize);
  }

  /**
   * 执行技能
   * @param dto 执行技能DTO
   * @returns {Promise<Object>} 执行结果
   */
  @Post('execute')
  @ApiOperation({ summary: '执行技能' })
  async execute(@Body() dto: ExecuteSkillDto) {
    const result = await this.skillService.execute(dto);
    return success(result);
  }
}
