import { Controller, Get, Post, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TaskService } from './task.service';
import { success } from '../common/response/api.response';
import { AdminGuard } from '../common/guards/admin.guard';

/**
 * 任务队列控制器
 * 提供队列状态查询和管理接口（管理端）
 */
@ApiTags('任务队列')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/task')
export class TaskController {
  /**
   * 构造函数
   * @param taskService 任务服务
   */
  constructor(private readonly taskService: TaskService) {}

  /**
   * 获取队列状态
   */
  @Get('status')
  @ApiOperation({ summary: '获取队列状态', description: '获取文档处理队列的等待、执行中、已完成和失败任务数量' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getQueueStatus() {
    const result = await this.taskService.getQueueStatus();
    return success(result, '获取成功');
  }

  /**
   * 清空队列
   */
  @Delete('clear')
  @ApiOperation({ summary: '清空队列', description: '清空文档处理队列中的所有任务' })
  @ApiResponse({ status: 200, description: '清空成功' })
  async clearQueue() {
    await this.taskService.clearQueue();
    return success(null, '清空成功');
  }

  /**
   * 重试失败任务
   */
  @Post('retry')
  @ApiOperation({ summary: '重试失败任务', description: '重新执行所有失败的文档处理任务' })
  @ApiResponse({ status: 200, description: '重试成功' })
  async retryFailedJobs() {
    await this.taskService.retryFailedJobs();
    return success(null, '重试成功');
  }
}
