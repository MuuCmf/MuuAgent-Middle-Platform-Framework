import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '@prisma/client';

/**
 * 管理员服务
 */
@Injectable()
export class AdminService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param jwtService JWT服务
   * @param configService 配置服务
   */
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 管理员登录
   * @param loginDto 登录DTO
   * @param clientIp 客户端IP
   * @returns {Promise<{token: string, admin: Partial<AdminUser>}>} 登录结果
   */
  async login(
    loginDto: LoginDto,
    clientIp: string,
  ): Promise<{ token: string; admin: Partial<AdminUser> }> {
    const { username, password } = loginDto;

    const admin = await this.prisma.adminUser.findUnique({
      where: { username },
    });

    if (!admin) {
      throw new UnauthorizedException('账号或密码错误');
    }

    if (admin.status === 0) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('账号或密码错误');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
      },
    });

    const payload = {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
    };

    const token = this.jwtService.sign(payload);

    const { password: _, ...adminWithoutPassword } = admin;

    return {
      token,
      admin: adminWithoutPassword,
    };
  }

  /**
   * 创建管理员
   * @param createAdminDto 创建管理员DTO
   * @returns {Promise<Partial<AdminUser>>} 创建的管理员信息
   */
  async createAdmin(createAdminDto: CreateAdminDto): Promise<Partial<AdminUser>> {
    const { username, password, ...rest } = createAdminDto;

    const existingAdmin = await this.prisma.adminUser.findUnique({
      where: { username },
    });

    if (existingAdmin) {
      throw new ConflictException('账号已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await this.prisma.adminUser.create({
      data: {
        username,
        password: hashedPassword,
        ...rest,
      },
    });

    const { password: _, ...adminWithoutPassword } = admin;

    return adminWithoutPassword;
  }

  /**
   * 根据ID获取管理员
   * @param id 管理员ID
   * @returns {Promise<AdminUser>} 管理员信息
   */
  async findById(id: string): Promise<AdminUser> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    return admin;
  }

  /**
   * 获取管理员列表
   * @returns {Promise<Partial<AdminUser>[]>} 管理员列表
   */
  async findAll(): Promise<Partial<AdminUser>[]> {
    const admins = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return admins.map(({ password, ...admin }) => admin);
  }

  /**
   * 更新管理员状态
   * @param id 管理员ID
   * @param status 状态
   * @returns {Promise<Partial<AdminUser>>} 更新后的管理员信息
   */
  async updateStatus(id: string, status: number): Promise<Partial<AdminUser>> {
    const admin = await this.prisma.adminUser.update({
      where: { id },
      data: { status },
    });

    const { password: _, ...adminWithoutPassword } = admin;

    return adminWithoutPassword;
  }

  /**
   * 删除管理员
   * @param id 管理员ID
   * @returns {Promise<void>}
   */
  async delete(id: string): Promise<void> {
    await this.prisma.adminUser.delete({
      where: { id },
    });
  }

  /**
   * 修改密码
   * @param id 管理员ID
   * @param changePasswordDto 修改密码DTO
   * @returns {Promise<void>}
   */
  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const admin = await this.findById(id);

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      admin.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('原密码错误');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    await this.prisma.adminUser.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }
}
