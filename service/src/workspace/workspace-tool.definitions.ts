/**
 * 工作目录工具类型标识
 */
export const WORKSPACE_TOOL_TYPE = 'workspace' as const;

/**
 * 工作目录工具定义
 * 这些工具在客户端执行，服务端仅负责路由下发
 */
export interface WorkspaceToolDefinition {
  type: 'workspace';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

export const WORKSPACE_TOOLS: WorkspaceToolDefinition[] = [
  {
    type: 'workspace',
    function: {
      name: 'read_file',
      description: '读取工作目录中的文件内容。传入相对于工作目录的路径。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径，相对于工作目录' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'workspace',
    function: {
      name: 'write_file',
      description: '在工作目录中写入文件。如果父目录不存在会自动创建。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径，相对于工作目录' },
          content: { type: 'string', description: '要写入的文件内容' },
          mode: {
            type: 'string',
            enum: ['create', 'overwrite'],
            description: 'create: 文件已存在时报错; overwrite: 覆盖已有文件',
          },
        },
        required: ['path', 'content', 'mode'],
      },
    },
  },
  {
    type: 'workspace',
    function: {
      name: 'append_file',
      description: '在已有文件末尾追加内容。如果文件不存在则创建。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径，相对于工作目录' },
          content: { type: 'string', description: '要追加的内容' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'workspace',
    function: {
      name: 'read_dir',
      description: '列出工作目录中的文件和子目录。不传 path 则列出根目录。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目录路径，相对于工作目录。留空为根目录' },
        },
        required: [],
      },
    },
  },
  {
    type: 'workspace',
    function: {
      name: 'create_dir',
      description: '在工作目录中创建文件夹，支持递归创建。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目录路径，相对于工作目录' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'workspace',
    function: {
      name: 'delete_file',
      description: '删除工作目录中的文件。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径，相对于工作目录' },
        },
        required: ['path'],
      },
    },
  },
];

/**
 * 工作目录工具名称集合，用于快速判断
 */
export const WORKSPACE_TOOL_NAMES = new Set(WORKSPACE_TOOLS.map(t => t.function.name));
