import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkClient() {
  const client = await prisma.oAuthClient.findFirst({
    where: {
      clientId: '0d07cf10-f7f8-4aed-8db2-6dfde06a8625',
    },
  });

  if (client) {
    console.log('=== OAuth 客户端信息 ===');
    console.log('ID:', client.id.toString());
    console.log('Client ID:', client.clientId);
    console.log('Name:', client.name);
    console.log('Grants (raw):', client.grants);
    console.log('Scopes (raw):', client.scopes);
    console.log('Status:', client.status);

    // 尝试解析
    try {
      const grants = JSON.parse(client.grants as any);
      console.log('Grants (parsed):', grants);
    } catch (e) {
      console.error('Grants 解析失败:', e.message);
    }

    try {
      const scopes = JSON.parse(client.scopes as any);
      console.log('Scopes (parsed):', scopes);
    } catch (e) {
      console.error('Scopes 解析失败:', e.message);
    }
  } else {
    console.log('未找到客户端');
  }
}

checkClient()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('查询失败:', e);
    await prisma.$disconnect();
    process.exit(1);
  });