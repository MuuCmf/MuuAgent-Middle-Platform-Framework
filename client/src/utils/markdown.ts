/**
 * Markdown 预处理工具函数
 * 用于修正 AI 输出的 Markdown 格式问题
 */

/**
 * 常见语言标识修正映射
 */
const LANGUAGE_CORRECTIONS: Record<string, string> = {
  'ph': 'php',
  'py': 'python',
  'js': 'javascript',
  'ts': 'typescript',
  'htm': 'html',
  'cs': 'csharp',
  'cpp': 'c++',
  'sh': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
  'vue': 'vue',
  'react': 'jsx',
  'golang': 'go',
}

/**
 * 常见语言名称列表（用于精确匹配）
 */
const KNOWN_LANGUAGES = new Set([
  'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust',
  'php', 'ruby', 'swift', 'kotlin', 'scala', 'html', 'css', 'scss', 'less', 'sass',
  'json', 'xml', 'yaml', 'markdown', 'md', 'sql', 'bash', 'shell', 'sh', 'powershell',
  'docker', 'dockerfile', 'nginx', 'apache', 'vue', 'react', 'jsx', 'tsx', 'svelte',
  'angular', 'graphql', 'protobuf', 'toml', 'ini', 'env', 'makefile', 'cmake',
  'plaintext', 'text', 'diff', 'git', 'mermaid', 'latex', 'mathematica', 'matlab',
  'r', 'julia', 'lua', 'perl', 'haskell', 'elixir', 'erlang', 'clojure', 'lisp',
  'scheme', 'fsharp', 'vb', 'vba', 'delphi', 'pascal', 'fortran', 'cobol', 'assembly',
  'wasm', 'wat', 'solidity', 'vyper', 'move', 'cairo', 'zig', 'nim', 'crystal',
  'd', 'odin', 'jai', 'v', 'carbon', 'mojo', 'dart', 'groovy', 'gradle', 'kts',
])

/**
 * 预处理 markdown 内容，修正格式问题
 * 1. 修正标题格式：#后缺少空格、#前缺少空行
 * 2. 修正代码块格式：```javascriptimport -> ```javascript\nimport
 * 3. 修正语言标识：```ph -> ```php
 * 4. 修正表格格式：分隔行前缺少表头时自动补充空表头
 * 5. 关闭未关闭的代码块（当内容包含表格时）
 * 6. 修正水平线分隔符：确保 --- 前后有正确的空行
 * @param content 原始 markdown 内容
 * @returns 修正后的 markdown 内容
 */
export function preprocessMarkdown(content: string): string {
  let result = content

  result = result.replace(/^(#{1,6})([^\s#])/gm, '$1 $2')
  result = result.replace(/([^\s])(#{1,6})/g, '$1\n\n$2')
  result = result.replace(/(#{1,6})\s*(#{1,6})/g, '$1\n\n$2')

  const lines = result.split('\n')

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    if (!line.startsWith('```')) continue

    const match = line.match(/^```(\w+)$/)
    if (match) {
      const lang = match[1]
      const correctedLang = LANGUAGE_CORRECTIONS[lang] || lang
      if (correctedLang !== lang) {
        console.log(`[语言标识修正] ${lang} -> ${correctedLang}`)
        lines[i] = '```' + correctedLang
      }
      continue
    }

    const codeMatch = line.match(/^```(\w+)(.*)$/)
    if (codeMatch) {
      let lang = codeMatch[1]
      let rest = codeMatch[2]

      while (lang.length > 0 && !KNOWN_LANGUAGES.has(lang.toLowerCase())) {
        rest = lang.slice(-1) + rest
        lang = lang.slice(0, -1)
      }

      if (lang.length === 0) {
        lang = ''
        rest = codeMatch[1] + codeMatch[2]
      }

      const correctedLang = LANGUAGE_CORRECTIONS[lang] || lang
      if (lang !== codeMatch[1] || correctedLang !== lang) {
        console.log(`[代码块格式修正] 行: "${line}" -> 分离为语言: "${correctedLang}", 代码: "${rest}"`)
      }
      lines[i] = '```' + correctedLang
      if (rest) {
        lines.splice(i + 1, 0, rest)
      }
    }
  }

  result = lines.join('\n')

  const codeBlockMatches = [...result.matchAll(/^```/gm)]
  if (codeBlockMatches.length % 2 !== 0) {
    const lastCodeBlock = codeBlockMatches[codeBlockMatches.length - 1]
    const afterCodeBlockStart = lastCodeBlock.index! + 3
    const afterCodeBlock = result.substring(afterCodeBlockStart)

    if (afterCodeBlock.includes('|') && /^\|[\s:|-]+\|/m.test(afterCodeBlock)) {
      console.log('[未关闭代码块检测] 发现表格内容，移除代码块标记')
      const beforeCodeBlock = result.substring(0, lastCodeBlock.index!)
      const cleanedAfter = afterCodeBlock.replace(/^\n?/, '')
      result = beforeCodeBlock + cleanedAfter
    }
  }

  const tableLines = result.split('\n')
  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i]
    if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) {
      if (i === 0 || !tableLines[i - 1].trim().startsWith('|')) {
        const cols = line.split('|').filter(c => c.trim() || c === '')
        const colCount = cols.length - 1
        const header = '|' + Array(colCount).fill('   ').join('|') + '|'
        tableLines.splice(i, 0, header)
        i++
      }
    }
  }
  result = tableLines.join('\n')

  result = result.replace(/(.+)\n---\n(.+)/g, '$1\n\n---\n\n$2')
  result = result.replace(/^---\n(.+)/g, '\n---\n\n$1')
  result = result.replace(/(.+)\n---$/g, '$1\n\n---')

  return result
}
