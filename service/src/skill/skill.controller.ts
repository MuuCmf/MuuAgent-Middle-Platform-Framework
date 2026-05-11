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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkillService } from './skill.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import { extractIsolationContext } from '../common/utils/isolation.util';
import {
  CreateSkillDto,
  UpdateSkillDto,
  ExecuteSkillDto,
  QuerySkillDto,
} from './dto/skill.dto';
import { success, page } from '../common/response/api.response';
import { Request } from 'express';

/**
 * 技能管理控制器
 */
@ApiTags('技能（管理端）')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
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
  @RequireScope(AdminScope.SKILL_WRITE)
  async create(@Body() dto: CreateSkillDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const skill = await this.skillService.create(dto, context);
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
  @RequireScope(AdminScope.SKILL_WRITE)
  async update(@Param('id') id: string, @Body() dto: UpdateSkillDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const skill = await this.skillService.update(id, dto, context);
    return success(skill, '技能更新成功');
  }

  /**
   * 删除技能
   * @param id 技能ID
   * @returns {Promise<Object>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除技能' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    await this.skillService.remove(id, context);
    return success(null, '技能删除成功');
  }

  /**
   * 查询技能列表
   * @param query 查询参数
   * @returns {Promise<Object>} 技能列表
   */
  @Get()
  @ApiOperation({ summary: '查询技能列表' })
  @RequireScope(AdminScope.SKILL_READ)
  async findAll(@Query() query: QuerySkillDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const { list, total, page: pageNum, pageSize } = await this.skillService.findAll(query, context);
    return page(list, total, pageNum, pageSize);
  }

  /**
   * 执行技能
   * @param dto 执行技能DTO
   * @returns {Promise<Object>} 执行结果
   */
  @Post('execute')
  @ApiOperation({ summary: '执行技能' })
  @RequireScope(AdminScope.SKILL_EXECUTE)
  async execute(@Body() dto: ExecuteSkillDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.skillService.execute(dto, context);
    return success(result);
  }

  /**
   * 渲染技能调用提示词
   * @param body 渲染参数
   * @returns {Promise<Object>} 渲染结果
   */
  @Post('render-prompt')
  @ApiOperation({ summary: '渲染技能调用提示词' })
  @RequireScope(AdminScope.SKILL_EXECUTE)
  async renderPrompt(
    @Body()
    body: {
      skillCode: string;
      userRequest: string;
    },
  ) {
    const renderedPrompt = await this.skillService.renderSkillInvokePrompt(
      body.skillCode,
      body.userRequest,
    );
    return success({ renderedPrompt });
  }

  /**
   * 智能选择技能
   * @param body 选择参数
   * @returns {Promise<Object>} 选择结果
   */
  @Post('select')
  @ApiOperation({ summary: '智能选择技能' })
  @RequireScope(AdminScope.SKILL_EXECUTE)
  async selectSkill(
    @Body()
    body: {
      userRequest: string;
      availableSkills: string[];
    },
    @Req() req: Request,
  ) {
    const context = extractIsolationContext(req);
    const result = await this.skillService.selectSkill(
      body.userRequest,
      body.availableSkills,
      context,
    );
    return success(result);
  }

  /**
   * 查询技能详情
   * @param id 技能ID
   * @returns {Promise<Object>} 技能详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询技能详情' })
  @RequireScope(AdminScope.SKILL_READ)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const skill = await this.skillService.findOne(id, context);
    return success(skill);
  }

  /**
   * 获取内置函数列表
   * @returns {Promise<Object>} 内置函数列表
   */
  @Get('builtin-functions/list')
  @ApiOperation({ summary: '获取内置函数列表' })
  @RequireScope(AdminScope.SKILL_READ)
  async getBuiltinFunctions() {
    const functions = this.skillService.getBuiltinFunctions();
    return success(functions);
  }

  /**
   * 获取插件列表
   * @returns {Promise<Object>} 插件列表
   */
  @Get('plugins/list')
  @ApiOperation({ summary: '获取插件列表' })
  @RequireScope(AdminScope.SKILL_READ)
  async getPlugins() {
    const plugins = this.skillService.getPlugins();
    return success(plugins);
  }

  /**
   * 分析沙箱代码
   * @param body 代码内容
   * @returns {Promise<Object>} 分析结果
   */
  @Post('analyze-code')
  @ApiOperation({ summary: '分析沙箱代码' })
  @RequireScope(AdminScope.SKILL_EXECUTE)
  async analyzeCode(
    @Body()
    body: {
      code: string;
    },
  ) {
    const result = this.skillService.analyzeCode(body.code);
    return success(result);
  }

  /**
   * 测试函数
   * @param body 测试参数
   * @returns {Promise<Object>} 测试结果
   */
  @Post('test-function')
  @ApiOperation({ summary: '测试函数' })
  @RequireScope(AdminScope.SKILL_EXECUTE)
  async testFunction(
    @Body()
    body: {
      codeType: string;
      pluginName?: string;
      functionName?: string;
      codeContent?: string;
      params: Record<string, unknown>;
    },
  ) {
    const result = await this.skillService.testFunction(body);
    return success(result);
  }
}
