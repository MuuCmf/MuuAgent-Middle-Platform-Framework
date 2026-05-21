export default {
  dashboard: {
    title: '仪表盘',
    description: '展示中台的整体运行状态，包括调用统计、成功率、模型分布等关键指标',
    systemAlert: '系统告警',
    unhandledAlerts: '{count} 条未处理告警',
    viewAllAlerts: '查看全部 {count} 条告警',
    
    stats: {
      totalCalls: 'AI调用总数',
      successRate: '成功率',
      avgResponseTime: '平均响应时间',
      activeModels: '活跃模型',
    },
    
    realtime: {
      title: '实时调用数据',
      realtimeUpdate: '实时更新',
      currentConcurrent: '当前并发',
      currentQps: '当前QPS',
      todayCalls: '今日调用',
      todayErrors: '今日错误',
      recentCalls: '最近调用记录',
      viewAll: '查看全部',
      failed: '失败',
    },
    
    modelStatus: {
      title: '模型状态监控',
      modelConfig: '模型配置',
      concurrent: '并发',
      qps: 'QPS',
      errors: '错误',
      circuitOpen: '已熔断',
      abnormal: '异常',
      normal: '正常',
    },
    
    modelTypeStats: {
      title: '模型类型统计',
      modelType: '模型类型',
      callCount: '调用次数',
      description: '说明',
      descriptions: {
        llm: '大语言模型，用于文本生成和对话',
        embedding: '向量模型，用于文本向量化',
        tts: '语音合成模型',
        asr: '语音识别模型',
        image: '图像生成模型',
        multimodal: '多模态模型',
        other: '其他类型模型',
      },
    },
    
    topModels: {
      title: '模型调用排行 TOP 5',
      rank: '排名',
      modelCode: '模型标识',
      callCount: '调用次数',
      avgCostMs: '平均耗时(ms)',
    },
    
    alert: {
      title: '系统告警',
      level: '级别',
      message: '告警信息',
      time: '时间',
      circuitBreaker: '模型 {name} 已熔断',
      highErrorCount: '模型 {name} 错误次数过高 ({count})',
      concurrentLimit: '模型 {name} 并发接近上限',
    },
    
    loading: {
      stats: '加载统计失败',
      modelStatus: '加载模型状态失败',
      recentCalls: '加载最近调用失败',
    },
  },
}
