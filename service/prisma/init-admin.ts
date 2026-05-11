import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * 初始化管理员账号脚本
 * 
 * npx ts-node prisma/init-admin.ts
 */
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
