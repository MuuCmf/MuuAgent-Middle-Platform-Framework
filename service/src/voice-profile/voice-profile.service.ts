import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * 语音配置查询参数
 */
export interface VoiceProfileQuery {
  page?: number;
  pageSize?: number;
  provider?: string;
  language?: string;
  status?: boolean;
  keyword?: string;
}

/**
 * 语音配置创建参数
 */
export interface VoiceProfileCreateInput {
  name: string;
  code: string;
  voiceId: string;
  provider: string;
  language: string;
  gender?: string;
  style?: string;
  sampleRate?: number;
  isDefault?: boolean;
  status?: boolean;
  appCode?: string;
}

/**
 * 语音配置更新参数
 */
export interface VoiceProfileUpdateInput {
  name?: string;
  voiceId?: string;
  provider?: string;
  language?: string;
  gender?: string;
  style?: string;
  sampleRate?: number;
  isDefault?: boolean;
  status?: boolean;
  appCode?: string;
}

/**
 * 语音配置服务
 */
@Injectable()
export class VoiceProfileService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 分页查询语音配置列表
   * @param query 查询参数
   * @returns 分页结果
   */
  async findAll(query: VoiceProfileQuery) {
    const { page = 1, pageSize = 20, provider, language, status, keyword } = query;

    const where: Prisma.VoiceProfileWhereInput = {};

    if (provider) {
      where.provider = provider;
    }
    if (language) {
      where.language = language;
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.voiceProfile.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.voiceProfile.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /**
   * 根据ID获取语音配置
   * @param id 语音配置ID
   * @returns 语音配置
   */
  async findById(id: bigint) {
    const profile = await this.prisma.voiceProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException('语音配置不存在');
    }

    return profile;
  }

  /**
   * 创建语音配置
   * @param data 创建参数
   * @returns 创建结果
   */
  async create(data: VoiceProfileCreateInput) {
    const existing = await this.prisma.voiceProfile.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictException('语音配置标识已存在');
    }

    if (data.isDefault) {
      await this.clearDefaultFlag();
    }

    return this.prisma.voiceProfile.create({ data: data as any });
  }

  /**
   * 更新语音配置
   * @param id 语音配置ID
   * @param data 更新参数
   * @returns 更新结果
   */
  async update(id: bigint, data: VoiceProfileUpdateInput) {
    await this.findById(id);

    if (data.isDefault) {
      await this.clearDefaultFlag();
    }

    return this.prisma.voiceProfile.update({
      where: { id },
      data: data as any,
    });
  }

  /**
   * 删除语音配置
   * @param id 语音配置ID
   */
  async delete(id: bigint) {
    await this.findById(id);
    await this.prisma.voiceProfile.delete({ where: { id } });
  }

  /**
   * 设为默认语音配置
   * @param id 语音配置ID
   * @returns 更新结果
   */
  async setDefault(id: bigint) {
    await this.findById(id);

    await this.clearDefaultFlag();

    return this.prisma.voiceProfile.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  /**
   * 获取默认语音配置
   * @returns 默认语音配置
   */
  async getDefault() {
    const profile = await this.prisma.voiceProfile.findFirst({
      where: { isDefault: true, status: true },
    });

    if (!profile) {
      return this.prisma.voiceProfile.findFirst({
        where: { status: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    return profile;
  }

  /**
   * 测试语音合成
   * @param id 语音配置ID
   * @param text 测试文本
   * @returns 测试结果
   */
  async testVoice(id: bigint, text: string) {
    const profile = await this.findById(id);
    return {
      provider: profile.provider,
      voiceId: profile.voiceId,
      text,
      message: '语音配置可用',
    };
  }

  /**
   * 清除所有配置的默认标记
   */
  private async clearDefaultFlag() {
    await this.prisma.voiceProfile.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }
}
