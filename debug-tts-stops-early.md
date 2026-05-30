# 调试会话：TTS 前端提前停止播放

- **会话ID**: `tts-stops-early`
- **状态**: [CLOSED] ✅ 已修复
- **创建时间**: 2026-05-30 12:55
- **修复时间**: 2026-05-30 ~13:10
- **症状**: 前端 TTS 播放中途停止，前后端均无报错日志。音频前半段播放正常，后半段静默停止。

---

## 假设列表

### H1: `disconnect()` 在音频播放完成前被调用
- **描述**: 对话流程结束后，`useChat.ts` 的清理链过早调用 `disconnect()`，触发 `cleanupMse()` 销毁 MSE 管道，导致播放中断。
- **验证方式**: 在 `disconnect()` 入口和 `cleanupMse()` 入口加插桩日志，记录调用时序与 `msePlaying`/`msePendingQueue` 状态。

### H2: MSE `<audio>` 元素未挂载 DOM 被浏览器静音/暂停
- **描述**: `mseAudio` 通过 `new Audio()` 创建但未 attach 到 DOM，浏览器可能限制非 DOM 音频元素的播放，尤其在有用户交互后。
- **验证方式**: 在 `startMsePlayback()` 和 `flushMseQueue()` 的 `play()` 调用后加插桩，记录 `audio.paused`、`audio.ended` 状态。

### H3: `startMsePlayback()` 的 `msePlaying` 守卫阻止了后续重试
- **描述**: `msePlaying` 首次设为 `true` 后，即使 `play()` 失败或被静默 catch，后续追加的音频块也不会再次调用 `play()`，导致静默卡死。
- **验证方式**: 在 `startMsePlayback()` 中插桩记录 `msePlaying` 状态和 `play()` 的 Promise resolve/catch。

### H4: SourceBuffer `appendBuffer` 操作被浏览器队列阻塞
- **描述**: 高频追加分片时，SourceBuffer 内部队列积压，`updateend` 事件不触发，`flushMseQueue` 停止工作，后续数据积压在 `msePendingQueue` 中无法播放。
- **验证方式**: 在 `appendMp3Chunk` 和 `flushMseQueue` 中插桩记录 pendingQueue 长度变化和 `sourceBuffer.updating` 状态。

### H5: `tts_end` 事件早于所有音频块到达，导致 `waitForTtsEnd` 提前退出
- **描述**: 服务端发送 `tts_end` 后客户端才开始等待，但此时部分音频块还在网络传输中，`waitForTtsEnd` 检查到 `mseAudio.paused` 时队列尚未耗尽。
- **验证方式**: 记录 `tts_end` 到达时间 vs 最后一块音频块的到达时间。

---

## 调试日志

### 插桩点清单

| ID | 位置 | 事件 | 触发条件 |
|----|------|------|----------|
| P1 | `disconnect()` | `disconnect_called` | 每次调用 |
| P2 | `cleanupMse()` | `cleanup_mse` | 每次调用，记录当时 `msePendingQueue.length`、`mseAudio?.paused/ended` |
| P3 | `startMsePlayback()` | `start_playback` | 记录 `msePlaying`、`play()` 结果 |
| P4 | `appendMp3Chunk()` | `append_chunk` | 记录 pendingQueue 长度变化、是否进入队列 |
| P5 | `flushMseQueue()` | `flush_queue` | 每次调用，记录出队数量和剩余数量 |
| P6 | `initMse()` | `init_mse` | 记录 `sourceopen` / `sourcebuffer 创建成功` |
| P7 | `waitForTtsEnd()` | `wait_end_check` | 每次循环检查时记录各条件状态 |

### 日志收集

查看调试服务器日志: `GET /logs`

---

## 时间线

| 时间 | 事件 |
|------|------|
| 12:55 | 启动调试会话 |
| ~12:56 | 启动 Debug Server + 插桩 |
| ~12:57 | 复现问题 |
| ~12:58 | 分析日志，确定根因 |
| ~12:59 | 修复 |
| ~13:00 | 验证修复 |
