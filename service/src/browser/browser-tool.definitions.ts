import { ToolDefinition } from '../agent/tools/abstract/tool.interface';

export const BROWSER_TOOL_TYPE = 'browser' as const;

export const BROWSER_TOOLS: ToolDefinition[] = [
  {
    name: 'browser_navigate',
    description: '导航到指定 URL。支持多种等待条件。',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '目标 URL' },
        pageId: { type: 'string', description: '页面标识，默认为 default' },
        waitUntil: { type: 'string', description: '等待条件：load / domcontentloaded / networkidle0 / networkidle2' },
        timeout: { type: 'number', description: '超时时间（毫秒），默认 30000' },
      },
      required: ['url'],
    },
    type: 'browser',
  },
  {
    name: 'browser_screenshot',
    description: '截取浏览器页面截图。支持 PNG、JPEG、WebP 格式。',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: '页面标识，默认为 default' },
        format: { type: 'string', description: '截图格式：png / jpeg / webp' },
        quality: { type: 'number', description: '图片质量（jpeg/webp），0-100' },
        maxWidth: { type: 'number', description: '最大宽度像素，默认 1280' },
        fullPage: { type: 'boolean', description: '是否截取整个页面' },
        selector: { type: 'string', description: '元素选择器（截取特定元素）' },
      },
      required: [],
    },
    type: 'browser',
  },
  {
    name: 'browser_click',
    description: '点击页面上的元素。',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: '元素选择器' },
        pageId: { type: 'string', description: '页面标识，默认为 default' },
        clickCount: { type: 'number', description: '点击次数，默认 1' },
        delay: { type: 'number', description: '点击延迟（毫秒）' },
        offsetX: { type: 'number', description: '点击位置偏移 X' },
        offsetY: { type: 'number', description: '点击位置偏移 Y' },
      },
      required: ['selector'],
    },
    type: 'browser',
  },
  {
    name: 'browser_fill',
    description: '填充表单字段。',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: '元素选择器' },
        value: { type: 'string', description: '要填充的值' },
        pageId: { type: 'string', description: '页面标识，默认为 default' },
        clear: { type: 'boolean', description: '是否清空现有内容，默认 true' },
        delay: { type: 'number', description: '输入延迟（毫秒）' },
      },
      required: ['selector', 'value'],
    },
    type: 'browser',
  },
  {
    name: 'browser_evaluate',
    description: '在页面中执行 JavaScript 脚本。危险操作，需要用户确认。',
    parameters: {
      type: 'object',
      properties: {
        script: { type: 'string', description: '要执行的脚本' },
        pageId: { type: 'string', description: '页面标识，默认为 default' },
        timeout: { type: 'number', description: '脚本执行超时时间（毫秒），默认 30000' },
      },
      required: ['script'],
    },
    type: 'browser',
  },
  {
    name: 'browser_wait',
    description: '等待特定条件满足。',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: '等待类型：selector / timeout / function / navigation' },
        target: { type: 'string', description: '等待目标（selector 类型为选择器）' },
        timeout: { type: 'number', description: '超时时间（毫秒），默认 30000' },
        pageId: { type: 'string', description: '页面标识，默认为 default' },
        waitUntil: { type: 'string', description: '等待条件（navigation 类型）' },
      },
      required: ['type'],
    },
    type: 'browser',
  },
  {
    name: 'browser_scroll',
    description: '滚动页面。',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', description: '滚动方向：up / down / left / right / top / bottom' },
        distance: { type: 'number', description: '滚动距离（像素），默认 300' },
        pageId: { type: 'string', description: '页面标识，默认为 default' },
        selector: { type: 'string', description: '滚动到指定元素' },
      },
      required: ['direction'],
    },
    type: 'browser',
  },
  {
    name: 'browser_get_content',
    description: '获取页面内容。',
    parameters: {
      type: 'object',
      properties: {
        contentType: { type: 'string', description: '内容类型：text / html / markdown / json' },
        selector: { type: 'string', description: '元素选择器（可选）' },
        pageId: { type: 'string', description: '页面标识，默认为 default' },
        includeHidden: { type: 'boolean', description: '是否包含隐藏元素' },
      },
      required: ['contentType'],
    },
    type: 'browser',
  },
  {
    name: 'browser_select',
    description: '选择下拉框选项。',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: '下拉框选择器' },
        value: { type: 'string', description: '要选择的值' },
        pageId: { type: 'string', description: '页面标识，默认为 default' },
        selectBy: { type: 'string', description: '选择方式：value / text / index' },
      },
      required: ['selector', 'value'],
    },
    type: 'browser',
  },
  {
    name: 'browser_hover',
    description: '悬停在页面元素上。',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: '元素选择器' },
        pageId: { type: 'string', description: '页面标识，默认为 default' },
      },
      required: ['selector'],
    },
    type: 'browser',
  },
  {
    name: 'browser_close',
    description: '关闭浏览器或页面。',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: '页面标识（关闭特定页面）' },
        closeBrowser: { type: 'boolean', description: '是否关闭整个浏览器，默认 false' },
      },
      required: [],
    },
    type: 'browser',
  },
];

export const BROWSER_TOOL_NAMES = new Set(BROWSER_TOOLS.map(t => t.name));