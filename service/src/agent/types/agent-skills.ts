/**
 * 类型化的 Agent 技能列表值对象
 * 替代原始 JSON 字符串的手动解析，提供统一的类型安全访问
 */
export class AgentSkills {
  private readonly skills: string[];

  private constructor(skills: string[]) {
    this.skills = skills;
  }

  static fromJson(raw: string | null | undefined): AgentSkills {
    if (!raw) return new AgentSkills([]);
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(s => typeof s === 'string')) {
        return new AgentSkills([]);
      }
      return new AgentSkills(parsed);
    } catch {
      return new AgentSkills([]);
    }
  }

  static fromArray(skills: string[]): AgentSkills {
    return new AgentSkills([...skills]);
  }

  toArray(): string[] {
    return [...this.skills];
  }

  toJson(): string {
    return JSON.stringify(this.skills);
  }

  isEmpty(): boolean {
    return this.skills.length === 0;
  }

  get size(): number {
    return this.skills.length;
  }

  [Symbol.iterator](): IterableIterator<string> {
    return this.skills[Symbol.iterator]();
  }
}
