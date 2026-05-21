/**
 * 快速分析提示词长度的脚本
 * 运行方式: npx ts-node analyze-prompt-length.ts
 */

// 从用户提供的内容估算
const samplePrompt = `react-reasoning-default

你是一位经验丰富的客服工作人员

## 可用工具

- mcp__filesystem__read_file: Read the complete contents of a file as text. DEPRECATED: Use read_text_file instead.
参数: {"path":"string*","tail":"number - If provided, returns only the last N lines of the file","head":"number - If provided, returns only the first N lines of the file"}
- mcp__filesystem__read_text_file: Read the complete contents of a file from the file system as text. Handles various text encodings and provides detailed error messages if the file cannot be read. Use this tool when you need to examine the contents of a single file. Use the 'head' parameter to read only the first N lines of a file, or the 'tail' parameter to read only the last N lines of a file. Operates on the file as text regardless of extension. Only works within allowed directories.
参数: {"path":"string*","tail":"number - If provided, returns only the last N lines of the file","head":"number - If provided, returns only the first N lines of the file"}
- mcp__filesystem__read_media_file: Read an image or audio file. Returns the base64 encoded data and MIME type. Only works within allowed directories.
参数: {"path":"string*"}
- mcp__filesystem__read_multiple_files: Read the contents of multiple files simultaneously. This is more efficient than reading files one by one when you need to analyze or compare multiple files. Each file's content is returned with its path as a reference. Failed reads for individual files won't stop the entire operation. Only works within allowed directories.
参数: {"paths":"array* - Array of file paths to read. Each path must be a string pointing to a valid file within allowed directories."}
- mcp__filesystem__write_file: Create a new file or completely overwrite an existing file with new content. Use with caution as it will overwrite existing files without warning. Handles text content with proper encoding. Only works within allowed directories.
参数: {"path":"string*","content":"string*"}
- mcp__filesystem__edit_file: Make line-based edits to a text file. Each edit replaces exact line sequences with new content. Returns a git-style diff showing the changes made. Only works within allowed directories.
参数: {"path":"string*","edits":"array*","dryRun":"boolean - Preview changes using git-style diff format"}
- mcp__filesystem__create_directory: Create a new directory or ensure a directory exists. Can create multiple nested directories in one operation. If the directory already exists, this operation will succeed silently. Perfect for setting up directory structures for projects or ensuring required paths exist. Only works within allowed directories.
参数: {"path":"string*"}
- mcp__filesystem__list_directory: Get a detailed listing of all files and directories in a specified path. Results clearly distinguish between files and directories with [FILE] and [DIR] prefixes. This tool is essential for understanding directory structure and finding specific files within a directory. Only works within allowed directories.
参数: {"path":"string*"}
- mcp__filesystem__list_directory_with_sizes: Get a detailed listing of all files and directories in a specified path, including sizes. Results clearly distinguish between files and directories with [FILE] and [DIR] prefixes. This tool is useful for understanding directory structure and finding specific files within a directory. Only works within allowed directories.
参数: {"path":"string*","sortBy":"string (name|size) - Sort entries by name or size"}
- mcp__filesystem__directory_tree: Get a recursive tree view of files and directories as a JSON structure. Each entry includes 'name', 'type' (file/directory), and 'children' for directories. Files have no children array, while directories always have a children array (which may be empty). The output is formatted with 2-space indentation for readability. Only works within allowed directories.
参数: {"path":"string*","excludePatterns":"array"}
- mcp__filesystem__move_file: Move or rename files and directories. Can move files between directories and rename them in a single operation. If the destination exists, the operation will fail. Works across different directories and can be used for simple renaming within the same directory. Both source and destination must be within allowed directories.
参数: {"source":"string*","destination":"string*"}
- mcp__filesystem__search_files: Recursively search for files and directories matching a pattern. The patterns should be glob-style patterns that match paths relative to the working directory. Use pattern like '*.ext' to match files in current directory, and '**/*.ext' to match files in all subdirectories. Returns full paths to all matching items. Great for finding files when you don't know their exact location. Only searches within allowed directories.
参数: {"path":"string*","pattern":"string*","excludePatterns":"array"}
- mcp__filesystem__get_file_info: Retrieve detailed metadata about a file or directory. Returns comprehensive information including size, creation time, last modified time, permissions, and type. This tool is perfect for understanding file characteristics without reading the actual content. Only works within allowed directories.
参数: {"path":"string*"}
- mcp__filesystem__list_allowed_directories: Returns the list of directories that this server is allowed to access. Subdirectories within these allowed directories are also accessible. Use this to understand which directories and their nested paths are available before trying to access files.
参数: {}
- http_request: 发起 HTTP 请求。用于调用外部 API、发送 webhook、获取远程数据等。
使用前请确保已通过 use_skill 加载相关技能指令，了解正确的 URL、参数和认证方式。
注意：禁止访问内网地址，响应体有大小限制。
参数: {"method":"string (GET|POST|PUT|PATCH|DELETE|HEAD)* - HTTP 方法","url":"string* - 完整的请求 URL（含协议）","headers":"object - 请求头，如 {\\"Authorization\\": \\"Bearer xxx\\", \\"Content-Type`;

console.log('='.repeat(80));
console.log('📏 提示词长度分析');
console.log('='.repeat(80));

const totalLength = samplePrompt.length;
const estimatedFullLength = totalLength + 500; // 估算完整长度

console.log(`\n📊 当前可见长度: ${totalLength.toLocaleString()} 字符`);
console.log(`📊 估算完整长度: ~${estimatedFullLength.toLocaleString()} 字符`);
console.log(`📊 约 ${(estimatedFullLength / 4).toLocaleString()} tokens (粗略估算)`);

console.log('\n⚠️ 常见模型限制:');
console.log('-'.repeat(80));
const limits = [
  { model: 'GPT-4', contextWindow: 128000, recommendedSystemPrompt: 8000 },
  { model: 'GPT-3.5', contextWindow: 16385, recommendedSystemPrompt: 4000 },
  { model: 'Claude 3', contextWindow: 200000, recommendedSystemPrompt: 100000 },
  { model: '通义千问', contextWindow: 32000, recommendedSystemPrompt: 8000 },
  { model: 'DeepSeek', contextWindow: 64000, recommendedSystemPrompt: 16000 },
];

for (const limit of limits) {
  const status = estimatedFullLength > limit.recommendedSystemPrompt ? '⚠️ 超出建议值' : '✅ 正常';
  console.log(`${limit.model.padEnd(12)} | 上下文窗口: ${String(limit.contextWindow).padStart(8)} | 建议system prompt: ${String(limit.recommendedSystemPrompt).padStart(8)} tokens | ${status}`);
}

console.log('\n💡 优化建议:');
console.log('-'.repeat(80));
console.log(`
1. 🎯 工具数量过多 (${samplePrompt.split('- ').length - 1} 个工具)
   解决方案:
   - 按场景分组工具 (文件操作/网络请求/数据库等)
   - 使用工具路由器，按需加载相关工具
   - 移除重复或相似的工具 (如 read_file 和 read_text_file)

2. 📝 工具描述过于详细
   当前: 每个工具描述约 150-300 字符
   建议: 精简至 50-100 字符，只保留关键信息

3. 🔧 实施方案 A: 智能工具过滤
   在 SystemPromptBuilder 中添加逻辑:
   - 根据用户意图过滤不相关的工具
   - 只保留当前场景需要的工具子集

4. 🔧 实施方案 B: 分层工具描述
   - 第一层: 工具名称 + 一句话描述 (始终显示)
   - 第二层: 详细参数 (仅在模型询问时提供)

5. 🔧 实施方案 C: 工具摘要模式
   当工具数 > 10 时:
   - 显示工具分类和名称
   - 添加 "使用 help_tool(tool_name) 获取详细信息" 的元工具
`);

console.log('\n' + '='.repeat(80) + '\n');
