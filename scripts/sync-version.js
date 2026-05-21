/**
 * 版本号同步脚本
 * 从根目录的 VERSION 文件读取版本号，并同步到各个子项目的 package.json
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const versionFile = path.join(rootDir, 'VERSION');

/**
 * 读取版本号
 * @returns {string} 版本号
 */
function readVersion() {
  const version = fs.readFileSync(versionFile, 'utf-8').trim();
  return version;
}

/**
 * 更新 package.json 的版本号
 * @param {string} packagePath - package.json 文件路径
 * @param {string} version - 新版本号
 */
function updatePackageVersion(packagePath, version) {
  if (!fs.existsSync(packagePath)) {
    console.log(`⚠️  文件不存在: ${packagePath}`);
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  const oldVersion = packageJson.version;
  
  if (oldVersion === version) {
    console.log(`✓ 版本号已是最新 [${packageJson.name}]: ${version}`);
    return;
  }

  packageJson.version = version;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
  console.log(`✓ 更新成功 [${packageJson.name}]: ${oldVersion} -> ${version}`);
}

/**
 * 主函数
 */
function main() {
  const version = readVersion();
  console.log(`\n📦 当前版本: ${version}\n`);

  const packages = [
    'service/package.json',
    'admin/package.json',
    'client/package.json',
  ];

  packages.forEach((pkg) => {
    const packagePath = path.join(rootDir, pkg);
    updatePackageVersion(packagePath, version);
  });

  console.log('\n✅ 版本号同步完成！\n');
}

main();
