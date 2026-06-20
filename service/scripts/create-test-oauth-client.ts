import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function createTestClient() {
  const clientId = crypto.randomUUID();
  const clientSecret = crypto.randomBytes(32).toString('hex');

  const client = await prisma.oAuthClient.create({
    data: {
      id: BigInt(1),
      clientId,
      clientSecret,
      name: '测试客户端',
      redirectUris: JSON.stringify([]),
      scopes: JSON.stringify(['model:read', 'agent:read', 'app:read']),
      grants: JSON.stringify(['client_credentials', 'refresh_token']),
      status: 1,
      // 不绑定 appCode，用于全局测试
    },
  });

  console.log('=== OAuth 客户端创建成功 ===');
  console.log('Client ID:', client.clientId);
  console.log('Client Secret:', client.clientSecret);
  console.log('请将以上信息保存到 MuuCmf-T6 的配置中');
  console.log('\n配置路径：管理后台 → 扩展配置 → MuuAgent');
}

createTestClient()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('创建失败:', e);
    await prisma.$disconnect();
    process.exit(1);
  });