/**
 * 意图关键词规则配置
 * 用于快速关键词匹配，无需调用AI
 */
export interface KeywordRule {
  /** 关键词列表 */
  keywords: string[];
  /** 权重（数值越大优先级越高） */
  weight: number;
}

/**
 * 默认意图关键词映射
 */
export const DEFAULT_INTENT_KEYWORDS: Record<string, KeywordRule> = {
  code: {
    keywords: [
      '代码', '编程', 'bug', '函数', '算法', 'API', 'debug',
      '报错', '异常', '重构', '优化', '性能', '写一个',
      '实现', '接口', '类', '对象', '数组', '字符串',
      '排序', '查找', '遍历', '递归', '异步', 'Promise',
      '数据库', 'SQL', '查询', '索引', '前端', '后端',
      'React', 'Vue', 'Node', 'Python', 'Java', 'TypeScript',
      'JavaScript', 'Go', 'Rust', 'C\\+\\+', 'C#', 'PHP', 'Ruby',
      'Swift', 'Kotlin', 'Dart', 'Flutter', 'Spring', 'Django',
      'Express', 'Nest', 'Next', 'Nuxt', 'Webpack', 'Vite',
      'Git', 'Docker', 'K8s', 'Kubernetes', 'CI/CD', '测试',
      '单元测试', '集成测试', 'E2E', 'Jest', 'Mocha', 'Cypress',
      '帮我写', '怎么写', '如何实现', '代码实现', '程序',
      '脚本', '自动化', '爬虫', '解析', 'JSON', 'XML',
      'HTTP', 'REST', 'GraphQL', 'WebSocket', 'RPC', 'gRPC',
      '缓存', 'Redis', 'MongoDB', 'MySQL', 'PostgreSQL',
      'ORM', 'Prisma', 'TypeORM', 'Sequelize', 'Mongoose',
    ],
    weight: 1,
  },
  math: {
    keywords: [
      '计算', '数学', '公式', '方程', '几何', '概率',
      '统计', '微积分', '线性代数', '求和', '求积',
      '导数', '积分', '矩阵', '向量', '三角函数',
      '算', '等于', '加减乘除', '百分比', '比例',
      '开方', '平方', '立方', '指数', '对数',
      'sin', 'cos', 'tan', 'log', 'ln', 'sqrt',
      '求解', '证明', '推导', '运算', '数值',
    ],
    weight: 1,
  },
  creative: {
    keywords: [
      '写文章', '写诗', '故事', '创作', '文案', '广告语',
      '小说', '剧本', '歌词', '散文', '诗歌', '改写',
      '润色', '翻译成', '用.*风格', '模仿',
      '写一篇', '写一段', '帮我写.*文章', '起草',
      '构思', '创意', '灵感', '头脑风暴', '写作',
      '翻译', '英译中', '中译英', '日译中', '韩译中',
      '润色一下', '修改.*文字', '优化.*文案',
    ],
    weight: 1,
  },
  image: {
    keywords: [
      '画', '生成图片', '绘图', '图片', '插图', '海报',
      '生成图', '画一张', '画个', '画一幅', '绘制',
      '生成一张', '生成一个.*图', '做图', 'P图',
      '生成.*图片', '创建.*图像', '设计.*图', '制作.*图',
      'AI画', 'AI绘图', 'AI生成', '文生图', '图生图',
      'Stable Diffusion', 'Midjourney', 'DALL-E', 'DALLE',
    ],
    weight: 2,
  },
  tts: {
    keywords: [
      '朗读', '语音合成', '文字转语音', '播报', '配音',
      '读出来', '念出来', '转语音', '生成语音', 'TTS',
      '读给我听', '朗读一下', '语音播放', '音频生成',
      '文字转音频', 'TTS合成', '语音输出',
    ],
    weight: 2,
  },
  asr: {
    keywords: [
      '语音识别', '语音转文字', '录音转文字', 'ASR',
      '识别语音', '转写', '语音输入',
      '音频转文字', '语音转文本', '听写', '语音转写',
    ],
    weight: 2,
  },
};