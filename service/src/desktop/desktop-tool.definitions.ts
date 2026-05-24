import { ToolDefinition } from '../agent/tools/abstract/tool.interface';

/** 桌面自动化工具类型标识 */
export const DESKTOP_TOOL_TYPE = 'workspace' as const;

/** 桌面自动化工具定义列表（6个核心工具） */
export const DESKTOP_TOOLS: ToolDefinition[] = [
  {
    name: 'desktop_screenshot',
    description: '截取当前屏幕，返回 Base64 编码图片。支持指定显示器索引和输出格式，默认缩放至 1280px 宽以减少 token 消耗。',
    type: DESKTOP_TOOL_TYPE,
    parameters: {
      type: 'object',
      properties: {
        screen: { type: 'number', description: '显示器索引，0 为主显示器' },
        format: { type: 'string', enum: ['png', 'jpg'], default: 'png', description: '输出格式' },
        maxWidth: { type: 'number', description: '最大宽度像素，默认 1280', default: 1280 },
      },
    },
  },
  {
    name: 'desktop_mouse',
    description: '鼠标操作：点击、移动、拖拽、滚动、获取位置。通过 action 参数区分具体操作。' +
      '注意：x/y 坐标基于截图分辨率，需传入 screenWidth/screenHeight 以自动映射到实际屏幕坐标。',
    type: DESKTOP_TOOL_TYPE,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['left_click', 'right_click', 'double_click', 'move', 'drag', 'scroll', 'position'],
          description: '操作类型',
        },
        x: { type: 'number', description: '目标 X 坐标（基于截图分辨率）' },
        y: { type: 'number', description: '目标 Y 坐标（基于截图分辨率）' },
        endX: { type: 'number', description: '拖拽终点 X（基于截图分辨率）' },
        endY: { type: 'number', description: '拖拽终点 Y（基于截图分辨率）' },
        scrollX: { type: 'number', description: '水平滚动量' },
        scrollY: { type: 'number', description: '垂直滚动量' },
        screenWidth: { type: 'number', description: '截图对应的实际屏幕宽度（用于坐标映射），从截图返回的元数据中获取' },
        screenHeight: { type: 'number', description: '截图对应的实际屏幕高度（用于坐标映射），从截图返回的元数据中获取' },
      },
      required: ['action'],
    },
  },
  {
    name: 'desktop_keyboard',
    description: '键盘操作：输入文本、按键、组合键。通过 action 参数区分具体操作。',
    type: DESKTOP_TOOL_TYPE,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['type', 'press', 'shortcut'],
          description: '操作类型：type=输入文本, press=按键, shortcut=组合键',
        },
        text: { type: 'string', description: '要输入的文本（action=type 时使用）' },
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: '按键列表（action=shortcut 时使用，如 ["Control", "c"]）',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'desktop_execute',
    description: '执行终端命令并返回输出。危险命令会被黑名单拦截。',
    type: DESKTOP_TOOL_TYPE,
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
        cwd: { type: 'string', description: '工作目录' },
        timeout: { type: 'number', description: '超时时间（毫秒），默认 30000', default: 30000 },
      },
      required: ['command'],
    },
  },
  {
    name: 'desktop_clipboard',
    description: '剪贴板操作：读取、写入。通过 action 参数区分具体操作。',
    type: DESKTOP_TOOL_TYPE,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['read', 'write'],
          description: '操作类型',
        },
        content: { type: 'string', description: '要写入的内容（action=write 时使用）' },
      },
      required: ['action'],
    },
  },
  {
    name: 'desktop_window',
    description: '窗口管理：列出所有窗口、获取当前活动窗口信息。通过 action 参数区分具体操作。',
    type: DESKTOP_TOOL_TYPE,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'active'],
          description: '操作类型：list=列出窗口, active=获取活动窗口',
        },
        title: { type: 'string', description: '窗口标题过滤（action=list 时使用）' },
      },
      required: ['action'],
    },
  },
];

/** 桌面工具名称集合 */
export const DESKTOP_TOOL_NAMES = new Set(DESKTOP_TOOLS.map(t => t.name));