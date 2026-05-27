/**
 * 构建技能提示信息
 * @param extra - 可选的额外说明信息
 * @returns 完整的技能提示字符串
 */
export function buildSkillHint(extra?: string): string {
  return `使用前请确保已通过 use_skill 加载相关技能指令${extra ? `，${extra}` : '。'}`;
}