/**
 * 调试脚本 - 检查工具描述长度和分类
 */

const testString = '这是一个非常非常长的工具描述用于测试截断功能'.repeat(10);
console.log('测试字符串长度:', testString.length);

const MAX_TOOL_DESC_LENGTH = 200;
let description = testString;

console.log('截断前长度:', description.length);
if (description.length > MAX_TOOL_DESC_LENGTH) {
  description = description.substring(0, MAX_TOOL_DESC_LENGTH - 3) + '...';
}
console.log('截断后长度:', description.length);
console.log('是否以...结尾:', description.endsWith('...'));
console.log('截断后内容:', description.slice(-20));

// 测试工具名解析
const toolNames = [
  'mcp__filesystem__read',
  'mcp__filesystem__write',
  'http_request',
  'kb_search',
  'other_tool_0',
];

console.log('\n\n工具名解析测试:');
for (const name of toolNames) {
  const parts = name.split('__');
  let prefix: string;

  if (parts.length >= 3) {
    prefix = `${parts[0]}__${parts[1]}`;
  } else if (parts.length === 2) {
    prefix = parts[0];
  } else {
    prefix = name; // 使用完整名称而不是 'other'
  }

  console.log(`${name} -> prefix: ${prefix}`);
}
