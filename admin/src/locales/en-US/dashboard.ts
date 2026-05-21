export default {
  dashboard: {
    title: 'Dashboard',
    description: 'Display the overall operational status of the platform, including call statistics, success rates, model distribution, and other key metrics',
    systemAlert: 'System Alert',
    unhandledAlerts: '{count} unhandled alerts',
    viewAllAlerts: 'View all {count} alerts',
    
    stats: {
      totalCalls: 'Total AI Calls',
      successRate: 'Success Rate',
      avgResponseTime: 'Avg Response Time',
      activeModels: 'Active Models',
    },
    
    realtime: {
      title: 'Real-time Call Data',
      realtimeUpdate: 'Real-time Update',
      currentConcurrent: 'Current Concurrent',
      currentQps: 'Current QPS',
      todayCalls: 'Today Calls',
      todayErrors: 'Today Errors',
      recentCalls: 'Recent Calls',
      viewAll: 'View All',
      failed: 'Failed',
    },
    
    modelStatus: {
      title: 'Model Status Monitor',
      modelConfig: 'Model Config',
      concurrent: 'Concurrent',
      qps: 'QPS',
      errors: 'Errors',
      circuitOpen: 'Circuit Open',
      abnormal: 'Abnormal',
      normal: 'Normal',
    },
    
    modelTypeStats: {
      title: 'Model Type Statistics',
      modelType: 'Model Type',
      callCount: 'Call Count',
      description: 'Description',
      descriptions: {
        llm: 'Large Language Model, used for text generation and conversation',
        embedding: 'Embedding Model, used for text vectorization',
        tts: 'Text-to-Speech Model',
        asr: 'Automatic Speech Recognition Model',
        image: 'Image Generation Model',
        multimodal: 'Multimodal Model',
        other: 'Other Type Model',
      },
    },
    
    topModels: {
      title: 'Top 5 Model Calls',
      rank: 'Rank',
      modelCode: 'Model Code',
      callCount: 'Call Count',
      avgCostMs: 'Avg Cost(ms)',
    },
    
    alert: {
      title: 'System Alert',
      level: 'Level',
      message: 'Alert Message',
      time: 'Time',
      circuitBreaker: 'Model {name} circuit breaker opened',
      highErrorCount: 'Model {name} has high error count ({count})',
      concurrentLimit: 'Model {name} concurrent approaching limit',
    },
    
    loading: {
      stats: 'Failed to load statistics',
      modelStatus: 'Failed to load model status',
      recentCalls: 'Failed to load recent calls',
    },
  },
}
