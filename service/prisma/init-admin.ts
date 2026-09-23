import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

/**
 * 初始化管理员账号脚本
 *
 * npx ts-node prisma/init-admin.ts
 * 或 npm run init:admin
 *
 * 说明：独立脚本不走 NestJS 启动流程，且生产环境仅部署 dist（无 src 目录），
 * 因此不依赖 PrismaService，直接使用 PrismaClient 并内联雪花 ID 生成逻辑。
 */

// 手动加载环境变量（PrismaClient 读取 DATABASE_URL）
dotenv.config();

/** 起始时间戳（与 src/common/utils/snowflake.util.ts 保持一致：2024-01-01 UTC） */
const TWEPOCH = BigInt(1704067200000);
/** 序列号掩码（12位） */
const MAX_SEQUENCE = BigInt(4095);

let lastTimestamp = BigInt(-1);
let sequence = BigInt(0);

/**
 * 生成雪花 ID（与 snowflake.util.ts 算法一致，workerId=0）
 * AdminUser.id 为 BigInt @id @default(0)，无自增，创建时必须显式生成
 */
function generateSnowflakeId(): string {
  let timestamp = BigInt(Date.now());
  if (timestamp === lastTimestamp) {
    sequence = (sequence + BigInt(1)) & MAX_SEQUENCE;
    // 序列号溢出，等待下一毫秒
    while (timestamp <= lastTimestamp) {
      timestamp = BigInt(Date.now());
    }
  } else {
    sequence = BigInt(0);
  }
  lastTimestamp = timestamp;
  // ((timestamp - twepoch) << 22) | (workerId << 12) | sequence，workerId=0
  return ((timestamp - TWEPOCH) << BigInt(22)).toString();
}

const prisma = new PrismaClient();

/**
 * 主函数
 */
async function main() {
  console.log('开始初始化管理员账号...');

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { username: 'admin' },
  });

  if (existingAdmin) {
    console.log('管理员账号已存在，跳过创建');
    return;
  }

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.adminUser.create({
    data: {
      id: BigInt(generateSnowflakeId()),
      username: 'admin',
      password: hashedPassword,
      nickname: '超级管理员',
      role: 'admin',
      isSuperAdmin: true,
      status: 1,
    },
  });

  console.log('管理员账号创建成功！');
  console.log('账号: admin');
  console.log('密码: admin123');
  console.log('ID:', admin.id.toString());
  console.log('请登录后立即修改密码！');
}

main()
  .catch((e) => {
    console.error('初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
