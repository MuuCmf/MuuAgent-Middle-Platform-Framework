-- 火山引擎 S2S 模型配置
-- 执行此 SQL 文件以添加火山引擎端到端实时语音大模型配置

-- 注意：
-- 1. API Key 格式：appId:accessToken
-- 2. endpoint：wss://openspeech.bytedance.com/api/v3/realtime/dialogue
-- 3. 音色：zh_female_vv_jupiter_bigtts（O版本默认音色）

-- 插入火山引擎 S2S 模型（O版本）
INSERT INTO Model (
  name,
  code,
  type,
  provider,
  endpoint,
  apiKey,
  weight,
  status,
  description,
  config,
  tags,
  category,
  capabilities,
  createdAt,
  updatedAt
) VALUES (
  '火山引擎S2S-O版本',
  'volcengine-s2s-o',
  's2s',
  'volcengine',
  'wss://openspeech.bytedance.com/api/v3/realtime/dialogue',
  'YOUR_APP_ID:YOUR_ACCESS_TOKEN', -- 请替换为真实的 API Key
  1,
  true,
  '火山引擎端到端实时语音大模型（O版本），支持实时双向音频流交互',
  JSON_OBJECT(
    'voiceId', 'zh_female_vv_jupiter_bigtts',
    'audioFormat', 'pcm',
    'sampleRate', 16000,
    'outputFormat', 'pcm',
    'outputSampleRate', 24000
  ),
  JSON_ARRAY('s2s', 'realtime', 'voice'),
  'voice',
  JSON_ARRAY('s2s:realtime'),
  NOW(),
  NOW()
);

-- 插入火山引擎 S2S 模型（SC版本，支持声音复刻）
INSERT INTO Model (
  name,
  code,
  type,
  provider,
  endpoint,
  apiKey,
  weight,
  status,
  description,
  config,
  tags,
  category,
  capabilities,
  createdAt,
  updatedAt
) VALUES (
  '火山引擎S2S-SC版本',
  'volcengine-s2s-sc',
  's2s',
  'volcengine',
  'wss://openspeech.bytedance.com/api/v3/realtime/dialogue',
  'YOUR_APP_ID:YOUR_ACCESS_TOKEN', -- 请替换为真实的 API Key
  2,
  false, -- 默认不启用，需要声音复刻配置
  '火山引擎端到端实时语音大模型（SC版本），支持声音复刻和个性化音色',
  JSON_OBJECT(
    'voiceId', 'ICL_zh_female_aojiaonvyou_tob',
    'audioFormat', 'pcm',
    'sampleRate', 16000,
    'outputFormat', 'pcm',
    'outputSampleRate', 24000,
    'supportsVoiceCloning', true
  ),
  JSON_ARRAY('s2s', 'realtime', 'voice', 'voice-cloning'),
  'voice',
  JSON_ARRAY('s2s:realtime', 'voice:cloning'),
  NOW(),
  NOW()
);

-- 查询验证
SELECT
  id,
  name,
  code,
  type,
  provider,
  endpoint,
  LEFT(apiKey, 20) AS apiKey_preview,
  status,
  capabilities
FROM Model
WHERE type = 's2s'
ORDER BY weight ASC;