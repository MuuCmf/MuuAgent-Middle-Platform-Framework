import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateSkillDto,
  UpdateSkillDto,
  ExecuteSkillDto,
  QuerySkillDto,
  SkillType,
} from './dto/skill.dto';
import { Skill } from '@prisma/client';
import axios from 'axios';

/**
 * 技能服务
 * 提供技能的CRUD和执行功能
 */
@Injectable()
export class SkillService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 创建技能
   * @param dto 创建技能DTO
   * @returns {Promise<Object>} 创建的技能
   */
  async create(dto: CreateSkillDto) {
    return this.prisma.skill.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        type: dto.type,
        params: dto.params,
        config: dto.config,
        status: dto.status ?? true,
        timeout: dto.timeout ?? 30000,
      },
    });
  }

  /**
   * 更新技能
   * @param id 技能ID
   * @param dto 更新技能DTO
   * @returns {Promise<Object>} 更新后的技能
   */
  async update(id: string, dto: UpdateSkillDto) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      throw new NotFoundException('技能不存在');
    }

    return this.prisma.skill.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除技能
   * @param id 技能ID
   * @returns {Promise<void>}
   */
  async remove(id: string): Promise<void> {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      throw new NotFoundException('技能不存在');
    }

    await this.prisma.skill.delete({ where: { id } });
  }

  /**
   * 根据ID查询技能
   * @param id 技能ID
   * @returns {Promise<Object>} 技能详情
   */
  async findOne(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      throw new NotFoundException('技能不存在');
    }
    return skill;
  }

  /**
   * 根据Code查询技能
   * @param code 技能标识
   * @returns {Promise<Object>} 技能详情
   */
  async findByCode(code: string) {
    const skill = await this.prisma.skill.findUnique({ where: { code } });
    if (!skill) {
      throw new NotFoundException('技能不存在');
    }
    return skill;
  }

  /**
   * 分页查询技能列表
   * @param query 查询参数
   * @returns {Promise<Object>} 分页技能列表
   */
  async findAll(query: QuerySkillDto) {
    const { type, status, page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status !== undefined) where.status = status;

    const [list, total] = await Promise.all([
      this.prisma.skill.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.skill.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /**
   * 执行技能
   * @param dto 执行技能DTO
   * @returns {Promise<Record<string, unknown>>} 执行结果
   */
  async execute(dto: ExecuteSkillDto): Promise<Record<string, unknown>> {
    const skill = await this.prisma.skill.findUnique({
      where: { code: dto.skillCode },
    });

    if (!skill) {
      throw new NotFoundException('技能不存在');
    }

    if (!skill.status) {
      throw new HttpException('技能已禁用', HttpStatus.FORBIDDEN);
    }

    const params = dto.params || {};
    const startTime = Date.now();
    let result: Record<string, unknown>;
    let success = true;
    let errorMessage: string | null = null;

    try {
      switch (skill.type) {
        case SkillType.HTTP:
          result = await this.executeHttpSkill(skill, params);
          break;
        case SkillType.FUNCTION:
          result = await this.executeFunctionSkill(skill, params);
          break;
        case SkillType.DATABASE:
          result = await this.executeDatabaseSkill(skill, params);
          break;
        default:
          throw new HttpException('不支持的技能类型', HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : '执行失败';
      result = { error: errorMessage };
    }

    // 记录调用日志
    await this.prisma.skillInvokeLog.create({
      data: {
        skillCode: skill.code,
        request: JSON.stringify(params),
        response: JSON.stringify(result),
        costMs: Date.now() - startTime,
        success,
        errorMessage,
      },
    });

    if (!success) {
      throw new HttpException(errorMessage || '执行失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return result;
  }

  /**
   * 执行HTTP类型技能
   * @param skill 技能信息
   * @param params 执行参数
   * @returns {Promise<Record<string, unknown>>} 执行结果
   */
  private async executeHttpSkill(
    skill: { config: string; timeout: number },
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = JSON.parse(skill.config);
    const { url, method = 'get', headers = {} } = config;

    const response = await axios({
      url,
      method,
      params: method.toLowerCase() === 'get' ? params : undefined,
      data: method.toLowerCase() === 'post' ? params : undefined,
      headers,
      timeout: skill.timeout,
    });

    return response.data;
  }

  /**
   * 执行函数类型技能
   * @param skill 技能信息
   * @param params 执行参数
   * @returns {Promise<Record<string, unknown>>} 执行结果
   */
  private async executeFunctionSkill(
    skill: { code: string; config: string },
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // 内置函数映射
    const builtinFunctions: Record<string, (p: Record<string, unknown>) => Record<string, unknown>> = {
      get_time: () => ({ time: new Date().toLocaleString('zh-CN') }),
      get_date: () => ({ date: new Date().toISOString().split('T')[0] }),
      echo: (p) => ({ echo: p }),
      random: () => ({ random: Math.random() }),
    };

    const config = JSON.parse(skill.config);
    const functionName = config.functionName || skill.code;

    if (builtinFunctions[functionName]) {
      return builtinFunctions[functionName](params);
    }

    throw new HttpException(`未知的内置函数: ${functionName}`, HttpStatus.BAD_REQUEST);
  }

  /**
   * 执行数据库类型技能
   * @param skill 技能信息
   * @param params 执行参数
   * @returns {Promise<Record<string, unknown>>} 执行结果
   */
  private async executeDatabaseSkill(
    skill: { config: string },
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = JSON.parse(skill.config);
    const { query, connection } = config;

    // 这里简化处理，实际应该使用数据库连接池
    // 目前只支持简单的参数替换
    let finalQuery = query;
    for (const [key, value] of Object.entries(params)) {
      finalQuery = finalQuery.replace(`:${key}`, String(value));
    }

    return {
      query: finalQuery,
      connection,
      message: '数据库查询已构建，请使用实际的数据库连接执行',
    };
  }

  /**
   * 获取技能描述(用于LLM)
   * @param skillCodes 技能标识列表
   * @returns {Promise<string>} 技能描述文本
   */
  async getSkillDescriptions(skillCodes: string[]): Promise<string> {
    const skills = await this.prisma.skill.findMany({
      where: {
        code: { in: skillCodes },
        status: true,
      },
    });

    return skills
      .map((s: Skill) => `${s.code}: ${s.description}\n参数: ${s.params}`)
      .join('\n\n');
  }
}
