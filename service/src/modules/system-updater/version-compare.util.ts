/**
 * 版本号比较工具
 *
 * 复刻 php_server/app/common.php 的 version_contrast 与 get_upgrade_status 语义：
 * - 按 '.' 分段转 int 逐位比较，缺失段视为 0
 * - 全部相等时 version_contrast 返回 $versionA（即本地版本）
 * - get_upgrade_status：版本相等不可升级；只有当最大版本为云端版本时才可升级
 */

/**
 * 复刻 php version_contrast：返回两个版本中较大的一个；完全相等时返回 versionA
 * @param versionA 本地版本
 * @param versionB 云端版本
 */
export function versionContrast(versionA: string, versionB: string): string {
  const listA = String(versionA ?? '').split('.');
  const listB = String(versionB ?? '').split('.');
  const len = Math.max(listA.length, listB.length);

  for (let i = 0; i < len; i++) {
    const segA = Math.max(parseInt(listA[i], 10) || 0, 0);
    const segB = Math.max(parseInt(listB[i], 10) || 0, 0);

    if (segA > segB) return versionA;
    if (segA < segB) return versionB;
  }

  return versionA;
}

/**
 * 复刻 php get_upgrade_status：判断是否可以升级
 * @param localVersion 本地版本
 * @param cloudVersion 云端版本
 * @returns 云端版本高于本地版本时返回 true
 */
export function checkUpgradeable(localVersion: string, cloudVersion: string): boolean {
  if (!localVersion || !cloudVersion) return false;
  if (localVersion === cloudVersion) return false;
  return versionContrast(localVersion, cloudVersion) === cloudVersion;
}
