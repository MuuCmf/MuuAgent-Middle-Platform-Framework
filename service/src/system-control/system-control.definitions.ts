import { ToolDefinition } from '../agent/tools/abstract/tool.interface';

/** 系统控制工具类型标识 */
export const SYSTEM_CONTROL_TOOL_TYPE = 'system_control' as const;

/** 系统控制工具定义列表 */
export const SYSTEM_CONTROL_TOOLS: ToolDefinition[] = [
  {
    name: 'launch_application',
    description: '启动电脑上的应用程序，如"微信"、"Chrome"、"VS Code"等',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '应用名称' },
      },
      required: ['name'],
    },
    type: 'system_control',
  },
  {
    name: 'close_application',
    description: '关闭电脑上正在运行的应用程序',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '应用名称' },
      },
      required: ['name'],
    },
    type: 'system_control',
  },
  {
    name: 'list_processes',
    description: '列出电脑上正在运行的进程列表',
    parameters: {
      type: 'object',
      properties: {},
    },
    type: 'system_control',
  },
  {
    name: 'take_screenshot',
    description: '截取当前屏幕画面，返回截图的 Base64 编码',
    parameters: {
      type: 'object',
      properties: {},
    },
    type: 'system_control',
  },
  {
    name: 'set_volume',
    description: '设置系统音量',
    parameters: {
      type: 'object',
      properties: {
        level: { type: 'number', description: '音量级别 0-100' },
      },
      required: ['level'],
    },
    type: 'system_control',
  },
  {
    name: 'get_volume',
    description: '获取当前系统音量',
    parameters: {
      type: 'object',
      properties: {},
    },
    type: 'system_control',
  },
  {
    name: 'read_clipboard',
    description: '读取系统剪贴板内容',
    parameters: {
      type: 'object',
      properties: {},
    },
    type: 'system_control',
  },
  {
    name: 'write_clipboard',
    description: '写入内容到系统剪贴板',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要写入剪贴板的文本' },
      },
      required: ['text'],
    },
    type: 'system_control',
  },
  {
    name: 'search_files',
    description: '在指定目录下搜索文件',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        basePath: { type: 'string', description: '搜索根目录，默认为用户主目录' },
      },
      required: ['query'],
    },
    type: 'system_control',
  },
  {
    name: 'open_file',
    description: '用系统默认程序打开文件',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
      },
      required: ['path'],
    },
    type: 'system_control',
  },
  {
    name: 'list_open_windows',
    description: '列出当前所有打开的窗口标题',
    parameters: {
      type: 'object',
      properties: {},
    },
    type: 'system_control',
  },
  {
    name: 'switch_to_window',
    description: '切换到指定标题的窗口',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '窗口标题关键词' },
      },
      required: ['title'],
    },
    type: 'system_control',
  },
  {
    name: 'show_notification',
    description: '显示系统通知',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '通知标题' },
        body: { type: 'string', description: '通知内容' },
      },
      required: ['title', 'body'],
    },
    type: 'system_control',
  },
  {
    name: 'execute_command',
    description: '在终端执行系统命令（高危操作，需用户确认）',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
        timeout: { type: 'number', description: '超时时间（毫秒），默认 10000' },
      },
      required: ['command'],
    },
    type: 'system_control',
  },
  {
    name: 'shutdown',
    description: '关闭计算机（高危操作，需用户二次确认）',
    parameters: {
      type: 'object',
      properties: {},
    },
    type: 'system_control',
  },
  {
    name: 'sleep',
    description: '使计算机进入睡眠状态（高危操作，需用户二次确认）',
    parameters: {
      type: 'object',
      properties: {},
    },
    type: 'system_control',
  },
];

/** 系统控制工具名称集合 */
export const SYSTEM_CONTROL_TOOL_NAMES = new Set(SYSTEM_CONTROL_TOOLS.map(t => t.name));
