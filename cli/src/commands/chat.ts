import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { streamRequest, httpGet } from '../utils/api-client.js';

/**
 * 默认服务地址
 */
const DEFAULT_URL = 'http://localhost:3002';

/**
 * 对话历史消息
 */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 注册 chat 命令
 * @returns {Command} Commander 命令实例
 */
export function createChatCommand(): Command {
  return new Command('chat')
    .description('终端对话调试（SSE 流式输出）')
    .argument('[message]', '消息内容（不提供则进入交互模式）')
    .option('-u, --url <url>', '服务地址', DEFAULT_URL)
    .option('-k, --api-key <key>', 'API Key（也可通过 MUU_API_KEY 环境变量设置）')
    .option('-m, --model <code>', '指定模型标识')
    .option('-t, --model-type <type>', '模型类型', 'llm')
    .option('-c, --conversation <id>', '会话ID（多轮对话）')
    .option('--uid <uid>', '用户标识')
    .action(async (message: string | undefined, options: {
      url: string;
      apiKey?: string;
      model?: string;
      modelType: string;
      conversation?: string;
      uid?: string;
    }) => {
      const apiKey = options.apiKey || process.env.MUU_API_KEY;
      if (!apiKey) {
        console.error(chalk.red('请设置 API Key: --api-key 参数或 MUU_API_KEY 环境变量'));
        process.exit(1);
      }

      const baseUrl = options.url.replace(/\/$/, '');

      /** 单条消息模式 */
      if (message) {
        await singleChat(baseUrl, apiKey, message, options);
        return;
      }

      /** 交互式对话模式 */
      await interactiveChat(baseUrl, apiKey, options);
    });
}

/**
 * 单条消息对话
 * @param baseUrl 服务地址
 * @param apiKey API Key
 * @param message 消息内容
 * @param options 选项
 */
async function singleChat(
  baseUrl: string,
  apiKey: string,
  message: string,
  options: {
    model?: string;
    modelType: string;
    conversation?: string;
    uid?: string;
  },
): Promise<void> {
  process.stdout.write(chalk.cyan('AI: '));

  await streamRequest({
    url: `${baseUrl}/api/ai/stream`,
    apiKey,
    body: {
      modelType: options.modelType,
      modelCode: options.model,
      conversationId: options.conversation || undefined,
      uid: options.uid || undefined,
      messages: [{ role: 'user', content: message }],
    },
    callbacks: {
      onMessage: (content) => process.stdout.write(content),
      onComplete: () => process.stdout.write('\n'),
      onError: (err) => {
        process.stdout.write('\n');
        console.error(chalk.red(`错误: ${err.message}`));
      },
    },
  });
}

/**
 * 交互式对话模式
 * @param baseUrl 服务地址
 * @param apiKey API Key
 * @param options 选项
 */
async function interactiveChat(
  baseUrl: string,
  apiKey: string,
  options: {
    model?: string;
    modelType: string;
    conversation?: string;
    uid?: string;
  },
): Promise<void> {
  const history: ChatMessage[] = [];
  let conversationId: string | undefined = options.conversation;

  console.log(chalk.cyan('MuuAgent 终端对话'));
  console.log(chalk.gray('输入消息开始对话，输入 /quit 退出，/clear 清空历史\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    rl.question(chalk.green('你: '), async (input: string) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      /** 命令处理 */
      if (trimmed === '/quit' || trimmed === '/exit') {
        console.log(chalk.gray('再见！'));
        rl.close();
        process.exit(0);
      }

      if (trimmed === '/clear') {
        history.length = 0;
        conversationId = undefined;
        console.log(chalk.gray('已清空对话历史\n'));
        prompt();
        return;
      }

      if (trimmed === '/help') {
        console.log(chalk.gray('  /quit  - 退出对话'));
        console.log(chalk.gray('  /clear - 清空对话历史'));
        console.log(chalk.gray('  /help  - 显示帮助\n'));
        prompt();
        return;
      }

      /** 添加用户消息到历史 */
      history.push({ role: 'user', content: trimmed });

      let assistantContent = '';
      process.stdout.write(chalk.cyan('AI: '));

      await streamRequest({
        url: `${baseUrl}/api/ai/stream`,
        apiKey,
        body: {
          modelType: options.modelType,
          modelCode: options.model,
          conversationId,
          uid: options.uid || undefined,
          messages: history,
        },
        callbacks: {
          onMessage: (content) => {
            assistantContent += content;
            process.stdout.write(content);
          },
          onComplete: () => {
            process.stdout.write('\n\n');
            if (assistantContent) {
              history.push({ role: 'assistant', content: assistantContent });
            }
            prompt();
          },
          onError: (err) => {
            process.stdout.write('\n');
            console.error(chalk.red(`错误: ${err.message}\n`));
            prompt();
          },
          onConversationId: (id) => {
            conversationId = id;
          },
        },
      });
    });
  };

  prompt();
}
