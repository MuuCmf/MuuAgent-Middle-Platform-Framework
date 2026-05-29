import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VoiceProfileService } from './voice-profile.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { success } from '../common/response/api.response';

/**
 * 语音配置管理控制器（管理后台）
 */
@ApiTags('语音配置管理')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/voice-profile')
export class VoiceProfileController {
  /**
   * 构造函数
   * @param voiceProfileService 语音配置服务
   */
  constructor(private readonly voiceProfileService: VoiceProfileService) {}

  /**
   * 分页查询语音配置列表
   * @param query 查询参数
   * @returns {Promise<Object>} 分页结果
   */
  @Get()
  @ApiOperation({ summary: '分页查询语音配置列表' })
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('provider') provider?: string,
    @Query('language') language?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    const result = await this.voiceProfileService.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      provider,
      language,
      status: status !== undefined ? status === 'true' : undefined,
      keyword,
    });
    return success(result);
  }

  /**
   * 获取默认语音配置
   * @returns {Promise<Object>} 默认语音配置
   */
  @Get('default')
  @ApiOperation({ summary: '获取默认语音配置' })
  async getDefault() {
    const result = await this.voiceProfileService.getDefault();
    return success(result);
  }

  /**
   * 获取单个语音配置
   * @param id 语音配置ID
   * @returns {Promise<Object>} 语音配置
   */
  @Get(':id')
  @ApiOperation({ summary: '获取单个语音配置' })
  async findOne(@Param('id') id: string) {
    const result = await this.voiceProfileService.findById(BigInt(id));
    return success(result);
  }

  /**
   * 创建语音配置
   * @param body 创建参数
   * @returns {Promise<Object>} 创建结果
   */
  @Post()
  @ApiOperation({ summary: '创建语音配置' })
  async create(
    @Body() body: {
      name: string;
      code: string;
      voiceId: string;
      provider: string;
      language: string;
      gender?: string;
      modelCode?: string;
      sampleRate?: number;
      isDefault?: boolean;
      status?: boolean;
      appCode?: string;
    },
  ) {
    const result = await this.voiceProfileService.create(body);
    return success(result, '创建成功');
  }

  /**
   * 更新语音配置
   * @param id 语音配置ID
   * @param body 更新参数
   * @returns {Promise<Object>} 更新结果
   */
  @Put(':id')
  @ApiOperation({ summary: '更新语音配置' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      voiceId?: string;
      provider?: string;
      language?: string;
      gender?: string;
      modelCode?: string;
      sampleRate?: number;
      isDefault?: boolean;
      status?: boolean;
    },
  ) {
    const result = await this.voiceProfileService.update(BigInt(id), body);
    return success(result, '更新成功');
  }

  /**
   * 删除语音配置
   * @param id 语音配置ID
   * @returns {Promise<Object>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除语音配置' })
  async delete(@Param('id') id: string) {
    await this.voiceProfileService.delete(BigInt(id));
    return success(null, '删除成功');
  }

  /**
   * 设为默认语音配置
   * @param id 语音配置ID
   * @returns {Promise<Object>} 更新结果
   */
  @Patch(':id/default')
  @ApiOperation({ summary: '设为默认语音配置' })
  async setDefault(@Param('id') id: string) {
    const result = await this.voiceProfileService.setDefault(BigInt(id));
    return success(result, '已设为默认');
  }

  /**
   * 测试语音配置
   * @param id 语音配置ID
   * @param body 测试参数
   * @returns {Promise<Object>} 测试结果
   */
  @Post(':id/test')
  @ApiOperation({ summary: '测试语音配置' })
  async testVoice(
    @Param('id') id: string,
    @Body() body: { text?: string },
  ) {
    const result = await this.voiceProfileService.testVoice(BigInt(id), body.text || '你好，这是一条测试语音');
    return success(result);
  }
}
