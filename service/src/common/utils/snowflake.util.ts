/**
 * 雪花算法 ID 生成器
 * 
 * 雪花算法生成的 ID 是一个 64 位的整数，结构如下：
 * - 1 位符号位（始终为 0）
 * - 41 位时间戳（毫秒级，可使用约 69 年）
 * - 10 位工作机器 ID（0-1023，支持分布式部署）
 * - 12 位序列号（毫秒内序列，每毫秒可生成 4096 个 ID）
 * 
 * 优点：
 * - 有序递增，利于数据库索引
 * - 高性能，单机每秒可生成 400 万+ ID
 * - 支持分布式部署
 * - ID 长度适中（19 位数字），易于存储和传输
 */
export class SnowflakeIdGenerator {
  /** 起始时间戳（2024-01-01 00:00:00 UTC） */
  private readonly twepoch: bigint = BigInt(1704067200000);

  /** 机器 ID 所占位数 */
  private readonly workerIdBits: number = 10;

  /** 序列号所占位数 */
  private readonly sequenceBits: number = 12;

  /** 机器 ID 最大值：1023 */
  private readonly maxWorkerId: bigint;

  /** 序列号最大值：4095 */
  private readonly maxSequence: bigint;

  /** 机器 ID 左移位数：12 位 */
  private readonly workerIdShift: number;

  /** 时间戳左移位数：22 位 */
  private readonly timestampLeftShift: number;

  /** 工作机器 ID（0-1023） */
  private workerId: bigint;

  /** 毫秒内序列（0-4095） */
  private sequence: bigint = BigInt(0);

  /** 上次生成 ID 的时间戳 */
  private lastTimestamp: bigint = BigInt(-1);

  /**
   * 构造函数
   * @param workerId 工作机器 ID（0-1023），用于分布式部署
   * @throws {Error} 如果 workerId 超出范围
   */
  constructor(workerId: number = 0) {
    this.maxWorkerId = BigInt(-1) ^ (BigInt(-1) << BigInt(this.workerIdBits));
    this.maxSequence = BigInt(-1) ^ (BigInt(-1) << BigInt(this.sequenceBits));
    this.workerIdShift = this.sequenceBits;
    this.timestampLeftShift = this.sequenceBits + this.workerIdBits;

    if (workerId < 0 || workerId > Number(this.maxWorkerId)) {
      throw new Error(
        `Worker ID 必须在 0 和 ${this.maxWorkerId} 之间，当前值: ${workerId}`,
      );
    }

    this.workerId = BigInt(workerId);
  }

  /**
   * 生成下一个唯一 ID
   * @returns {string} 字符串形式的雪花 ID（应用层使用）
   */
  nextId(): string {
    let timestamp = this.timeGen();

    // 时钟回拨检测
    if (timestamp < this.lastTimestamp) {
      throw new Error(
        `时钟回拨检测：拒绝生成 ID ${this.lastTimestamp - timestamp} 毫秒`,
      );
    }

    // 同一毫秒内
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + BigInt(1)) & this.maxSequence;

      // 序列号溢出，等待下一毫秒
      if (this.sequence === BigInt(0)) {
        timestamp = this.tilNextMillis(this.lastTimestamp);
      }
    } else {
      // 不同毫秒，序列号重置为 0
      this.sequence = BigInt(0);
    }

    this.lastTimestamp = timestamp;

    // 组装 ID
    const id =
      ((timestamp - this.twepoch) << BigInt(this.timestampLeftShift)) |
      (this.workerId << BigInt(this.workerIdShift)) |
      this.sequence;

    // 返回字符串形式，方便应用层使用
    return id.toString();
  }

  /**
   * 批量生成多个 ID
   * @param count 生成数量
   * @returns {string[]} ID 数组
   */
  nextIds(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.nextId());
    }
    return ids;
  }

  /**
   * 解析雪花 ID，获取其中的信息
   * @param id 雪花 ID
   * @returns {Object} 包含时间戳、机器 ID、序列号的对象
   */
  parseId(id: bigint | string): {
    timestamp: number;
    workerId: number;
    sequence: number;
    date: Date;
  } {
    const idBigInt = typeof id === 'string' ? BigInt(id) : id;

    const timestamp =
      Number((idBigInt >> BigInt(this.timestampLeftShift)) + this.twepoch);
    const workerId = Number(
      (idBigInt >> BigInt(this.workerIdShift)) & this.maxWorkerId,
    );
    const sequence = Number(idBigInt & this.maxSequence);

    return {
      timestamp,
      workerId,
      sequence,
      date: new Date(timestamp),
    };
  }

  /**
   * 获取当前时间戳（毫秒）
   * @returns {bigint} 当前时间戳
   */
  private timeGen(): bigint {
    return BigInt(Date.now());
  }

  /**
   * 等待到下一毫秒
   * @param lastTimestamp 上次时间戳
   * @returns {bigint} 下一毫秒时间戳
   */
  private tilNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.timeGen();
    while (timestamp <= lastTimestamp) {
      timestamp = this.timeGen();
    }
    return timestamp;
  }
}

/**
 * 全局雪花 ID 生成器实例
 * 默认使用 workerId = 0，单机部署时无需配置
 * 分布式部署时，需要为每个实例分配不同的 workerId（0-1023）
 */
let globalGenerator: SnowflakeIdGenerator | null = null;

/**
 * 初始化全局雪花 ID 生成器
 * @param workerId 工作机器 ID（0-1023）
 */
export function initSnowflakeGenerator(workerId: number = 0): void {
  globalGenerator = new SnowflakeIdGenerator(workerId);
}

/**
 * 获取全局雪花 ID 生成器实例
 * @returns {SnowflakeIdGenerator} 雪花 ID 生成器
 */
export function getSnowflakeGenerator(): SnowflakeIdGenerator {
  if (!globalGenerator) {
    globalGenerator = new SnowflakeIdGenerator(0);
  }
  return globalGenerator;
}

/**
 * 生成雪花 ID（便捷方法）
 * @returns {string} 雪花 ID（字符串形式）
 */
export function generateId(): string {
  return getSnowflakeGenerator().nextId();
}

/**
 * 批量生成雪花 ID（便捷方法）
 * @param count 生成数量
 * @returns {string[]} ID 数组
 */
export function generateIds(count: number): string[] {
  return getSnowflakeGenerator().nextIds(count);
}
