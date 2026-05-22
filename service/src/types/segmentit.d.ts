declare module 'segmentit' {
  /**
   * 中文分词器类
   */
  class Segment {
    /**
     * 使用默认词典和配置
     */
    useDefault(): Segment;

    /**
     * 执行分词
     * @param text 待分词文本
     * @param options 分词选项
     * @returns 分词结果数组
     */
    doSegment(
      text: string,
      options?: {
        simple?: boolean;
        stripPunctuation?: boolean;
        [key: string]: unknown;
      },
    ): string[];
  }

  /**
   * 使用默认词典和配置初始化分词器
   * @param segment 分词器实例
   * @returns 初始化后的分词器实例
   */
  function useDefault(segment: Segment): Segment;

  export { Segment, useDefault };
}
