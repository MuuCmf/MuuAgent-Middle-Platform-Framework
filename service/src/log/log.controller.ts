import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LogService } from './log.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { success, page } from '../common/response/api.response';

/**
 * 日志查询控制器
 */
@ApiTags('日志查询')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/log')
export class LogController {
  /**
   * 构造函数
   * @param logService 日志服务
   */
  constructor(private readonly logService: LogService) {}

  /**
   * 查询检索日志
   * @param query 查询参数
   * @returns {Promise<Object>} 日志列表
   */
  @Get('retrieval')
  @ApiOperation({ summary: '查询检索日志', description: '查询知识库检索日志，支持按知识库ID、用户ID、查询内容、时间范围筛选' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getRetrievalLogs(@Query() query: Record<string, unknown>) {
    const result = await this.logService.getRetrievalLogs(query as Parameters<typeof this.logService.getRetrievalLogs>[0]);
    return page(result.list, result.total, result.page, result.pageSize);
  }

  /**
   * 查询单个检索日志详情
   * @param id 日志ID
   * @returns {Promise<Object>} 日志详情
   */
  @Get('retrieval/:id')
  @ApiOperation({ summary: '查询单个检索日志详情', description: '根据日志ID查询检索日志的详细信息' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '日志不存在' })
  async getRetrievalLogById(@Param('id') id: string) {
    const result = await this.logService.getRetrievalLogById(id);
    return success(result);
  }

  /**
   * 获取检索统计
   * @param kbId 知识库ID（可选）
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns {Promise<Object>} 统计数据
   */
  @Get('retrieval/statistics')
  @ApiOperation({ summary: '获取检索统计', description: '获取知识库检索的统计数据，包括检索次数、平均耗时等' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getRetrievalStatistics(
    @Query('kbId') kbId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const stats = await this.logService.getRetrievalStatistics(kbId, startTime, endTime);
    return success(stats);
  }

  /**
   * 查询AI调用日志
   * @param query 查询参数
   * @returns {Promise<Object>} 日志列表
   */
  @Get('ai')
  @ApiOperation({ summary: '查询AI调用日志' })
  async getAiLogs(@Query() query: Record<string, unknown>) {
    const result = await this.logService.getAiLogs(query as Parameters<typeof this.logService.getAiLogs>[0]);
    return page(result.list, result.total, result.page, result.pageSize);
  }

  /**
   * 查询单个AI调用日志详情
   * @param id 日志ID
   * @returns {Promise<Object>} 日志详情
   */
  @Get('ai/:id')
  @ApiOperation({ summary: '查询单个AI调用日志详情' })
  async getAiLogById(@Param('id') id: string) {
    const result = await this.logService.getAiLogById(id);
    return success(result);
  }

  /**
   * 查询技能调用日志
   * @param query 查询参数
   * @returns {Promise<Object>} 日志列表
   */
  @Get('skill')
  @ApiOperation({ summary: '查询技能调用日志' })
  async getSkillLogs(@Query() query: Record<string, unknown>) {
    const result = await this.logService.getSkillLogs(query as Parameters<typeof this.logService.getSkillLogs>[0]);
    return page(result.list, result.total, result.page, result.pageSize);
  }

  /**
   * 查询Agent调用日志
   * @param query 查询参数
   * @returns {Promise<Object>} 日志列表
   */
  @Get('agent')
  @ApiOperation({ summary: '查询Agent调用日志' })
  async getAgentLogs(@Query() query: Record<string, unknown>) {
    const result = await this.logService.getAgentLogs(query as Parameters<typeof this.logService.getAgentLogs>[0]);
    return page(result.list, result.total, result.page, result.pageSize);
  }

  /**
   * 获取调用统计
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns {Promise<Object>} 统计数据
   */
  @Get('statistics')
  @ApiOperation({ summary: '获取调用统计' })
  async getStatistics(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const stats = await this.logService.getStatistics(startTime, endTime);
    return success(stats);
  }
}
