/**
 * CHANGELOG 生成脚本
 * 基于 conventional-changelog 自动生成变更日志
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const changelogFile = path.join(rootDir, 'CHANGELOG.md');
const versionFile = path.join(rootDir, 'VERSION');

/**
 * 读取版本号
 * @returns {string} 版本号
 */
function readVersion() {
  return fs.readFileSync(versionFile, 'utf-8').trim();
}

/**
 * 获取当前日期
 * @returns {string} 格式化的日期字符串
 */
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 生成 CHANGELOG
 * @param {boolean} full - 是否生成完整的 CHANGELOG（包含所有历史记录）
 */
function generateChangelog(full = false) {
  const version = readVersion();
  const date = getCurrentDate();

  console.log(`\n📝 正在生成 CHANGELOG...\n`);
  console.log(`   版本: ${version}`);
  console.log(`   日期: ${date}\n`);

  try {
    const releaseCount = full ? 0 : 1;
    const cmd = `npx conventional-changelog -p conventionalcommits -i CHANGELOG.md -s -r ${releaseCount}`;

    console.log(`执行命令: ${cmd}\n`);
    execSync(cmd, { stdio: 'inherit', cwd: rootDir });

    console.log('\n✅ CHANGELOG 生成成功！\n');
  } catch (error) {
    console.error('\n❌ CHANGELOG 生成失败:', error.message);
    process.exit(1);
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--all') || args.includes('-a');

  generateChangelog(full);
}

main();