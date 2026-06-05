import { ref, computed, nextTick, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { chatService } from "../services/ChatService";
import { agentService } from "../services/AgentService";
import {
  conversationService,
  type Conversation,
} from "../services/ConversationService";
import { clientToolService } from "../services/ClientToolService";
import {
  retrievalService,
  type RetrievalItem,
} from "../services/RetrievalService";
import { kbService, type KbInfo } from "../services/KbService";
import { useWorkspace } from "./useWorkspace";
import { WorkspaceExecutor } from "../executor/workspace.executor";
import { dynamicClientToolExecutor } from "../executor/dynamic-client-tool.executor";
import { DesktopExecutor } from "../executor/desktop.executor";
import { BrowserExecutor } from "../executor/browser.executor";
import { clientToolRouter } from "../executor/client-tool-router";
import type { Message, ContentBlock, ContentBlockStatus } from "../api/types";
import type { ReasoningStep } from "../api/reasoning";
import type {
  ClientToolCallPayload,
  ContentBlockStartPayload,
  ContentBlockStopPayload,
} from "../api/stream";
import type { ClientToolModulePolicy } from "../executor/types";
import { ttsStreamService, type TtsPlaybackStatus } from "../services/TtsStreamService";
import { voiceService } from "../services/VoiceService";
import { useS2sAudio } from "./useS2sAudio";

/**
 * 创建分段流式写入器
 * 参考 Claude Code 的分段流式输出模式：
 * - 每个 content_block 独立管理自己的缓冲区
 * - 已完成的块（status=completed）不再接收增量，切换为静态渲染
 * - 只有当前活跃块（status=streaming/running）才接收增量更新
 * - 使用 rAF 节流合并高频 token，每帧仅触发一次 Vue 响应式更新
 * @param getMessage 获取目标消息的 getter（始终返回最新引用）
 * @returns 分段流式写入器实例
 */
function createSegmentedStreamWriter(getMessage: () => Message) {
  /** 待刷出的文本增量 */
  let pending = "";
  /** rAF 节流 ID */
  let rafId: number | null = null;

  /**
   * 将增量刷出到当前活跃文本块
   * 只更新最后一个 streaming 状态的 text/thinking 块
   */
  const flushToBlock = () => {
    if (!pending) return;
    const msg = getMessage();
    if (!msg.contentBlocks) return;

    const activeBlock = findActiveTextBlock(msg.contentBlocks);
    if (activeBlock) {
      activeBlock.content += pending;
    }
    pending = "";
  };

  /**
   * 查找当前活跃的文本块（最后一个 streaming 状态的 text/thinking 块）
   * @param blocks 内容块列表
   * @returns 活跃文本块或 undefined
   */
  const findActiveTextBlock = (
    blocks: ContentBlock[],
  ): ContentBlock | undefined => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (
        (b.type === "text" || b.type === "thinking") &&
        b.toolStatus === "streaming"
      ) {
        return b;
      }
    }
    return undefined;
  };

  /**
   * 写入文本增量（rAF 节流）
   * @param chunk 文本增量
   */
  const write = (chunk: string) => {
    pending += chunk;
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        flushToBlock();
        rafId = null;
      });
    }
  };

  /**
   * 立即刷出所有缓冲内容
   */
  const flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    flushToBlock();
  };

  return { write, flush, findActiveTextBlock };
}

/**
 * 创建内容块管理器
 * 参考 Claude Code 的分段流式输出模式：
 * - content_block_start 时创建新块，状态为 streaming/running
 * - content_block_stop 时将块状态切换为 completed，触发静态渲染
 * - 已完成的块不再接收增量更新
 * @param getMessage 获取目标消息的 getter
 * @returns 内容块事件处理回调
 */
function createContentBlockManager(getMessage: () => Message) {
  /**
   * 处理 content_block_start 事件
   * 创建新的内容块，状态设为 streaming/running
   * @param payload 内容块开始载荷
   */
  const onContentBlockStart = (payload: ContentBlockStartPayload) => {
    const msg = getMessage();
    if (!msg.contentBlocks) {
      msg.contentBlocks = [];
    }
    const existing = msg.contentBlocks.find(
      (b) => b.type === payload.blockType && b.index === payload.index,
    );
    if (existing) {
      existing.toolStatus =
        payload.blockType === "tool_call" ? "running" : "streaming";
      return;
    }
    const block: ContentBlock = {
      type: payload.blockType,
      index: payload.index,
      content: "",
      toolName: payload.toolName,
      toolStatus: payload.blockType === "tool_call" ? "running" : "streaming",
      reasoningSteps: payload.blockType === "thinking" ? [] : undefined,
    };
    msg.contentBlocks.push(block);
  };

  /**
   * 处理 content_block_stop 事件
   * 将块状态切换为 completed，后续增量不再写入此块
   * @param payload 内容块结束载荷
   */
  const onContentBlockStop = (payload: ContentBlockStopPayload) => {
    const msg = getMessage();
    if (!msg.contentBlocks) return;
    const block = msg.contentBlocks.find(
      (b) => b.type === payload.blockType && b.index === payload.index,
    );
    if (block) {
      block.toolStatus = "completed";
      if (payload.isFinalAnswer && block.type === "thinking") {
        block.type = "text";
      }
    }
  };

  /**
   * 确保当前有活跃的文本块可写入
   * 当后端未发送 content_block_start 时，自动创建一个 text 块
   * @returns 活跃文本块
   */
  const ensureActiveTextBlock = (): ContentBlock => {
    const msg = getMessage();
    if (!msg.contentBlocks) {
      msg.contentBlocks = [];
    }
    const lastBlock = msg.contentBlocks[msg.contentBlocks.length - 1];
    if (
      lastBlock &&
      (lastBlock.type === "text" || lastBlock.type === "thinking") &&
      lastBlock.toolStatus === "streaming"
    ) {
      return lastBlock;
    }
    const block: ContentBlock = {
      type: "text",
      index: msg.contentBlocks.length,
      content: "",
      toolStatus: "streaming",
    };
    msg.contentBlocks.push(block);
    return block;
  };

  /**
   * 更新工具调用块的状态
   * @param toolName 工具名称
   * @param status 新状态
   * @param result 执行结果
   * @param error 错误信息
   * @param args 工具参数
   */
  const updateToolBlock = (
    toolName: string,
    status: ContentBlockStatus,
    result?: unknown,
    error?: string,
    args?: Record<string, unknown>,
  ) => {
    const msg = getMessage();
    if (!msg.contentBlocks) return;
    const block = msg.contentBlocks.find(
      (b) =>
        b.type === "tool_call" &&
        b.toolName === toolName &&
        b.toolStatus === "running",
    );
    if (block) {
      block.toolStatus = status;
      if (result !== undefined) block.toolResult = result;
      if (error) block.toolResult = error;
      if (args) block.toolArgs = args;
    }
  };

  return {
    onContentBlockStart,
    onContentBlockStop,
    ensureActiveTextBlock,
    updateToolBlock,
  };
}

/**
 * 聊天模式类型
 */
export type ChatMode = "chat" | "rag" | "retrieval";

/**
 * 聊天组合式函数
 * 整合聊天、RAG、检索的全部状态管理和业务逻辑
 */
export function useChat() {
  /** 当前聊天模式 */
  const chatMode = ref<ChatMode>("chat");

  /** 消息列表引用（DOM） */
  const messagesRef = ref<HTMLElement>();

  /** 当前选中的智能体 */
  const selectedAgent = ref<string>("");

  /** 当前选中的LLM模型 */
  const selectedLlmModel = ref<string>("mcp-llm");

  /** 当前选中的模型类型筛选（llm/lmm/omni） */
  const selectedModelType = ref<string>("llm");

  // ========== 聊天状态 ==========

  /** 聊天消息列表 */
  const messages = ref<Message[]>([]);

  /** 聊天加载状态 */
  const isLoading = ref(false);

  /** 当前会话ID */
  const currentConversationId = ref<string | null>(null);

  /** 选中的类型：模型/智能体 */
  const selectedType = ref<"model" | "agent">("model");

  /** 会话列表 */
  const conversations = ref<Conversation[]>([]);

  /** 模型列表 */
  const models = ref<any[]>([]);

  /** 智能体列表 */
  const agents = ref<any[]>([]);

  /** 当前流式请求的 AbortController */
  const abortController = ref<AbortController | null>(null);

  // ========== TTS 状态 ==========

  /** 语音播报是否启用 */
  const voiceEnabled = ref(voiceService.getConfig().autoPlay);

  /** TTS 播放状态 */
  const ttsStatus = ref<TtsPlaybackStatus>('idle');

  // ========== 视频对话状态 ==========

  /** 视频对话是否启用 */
  const videoEnabled = ref(false);

  // ========== S2S 端到端语音状态 ==========

  /** S2S 端到端语音是否启用 */
  const s2sEnabled = ref(false);

  /** S2S 音频 composable（含文本回调，将对话文本显示在对话区域） */
  const s2sAudio = useS2sAudio({}, (text: string, role: 'user' | 'assistant') => {
    handleS2sText(text, role);
  });

  /** 工作目录 */
  const workspace = useWorkspace();

  // ========== RAG 状态 ==========

  /** 知识库列表 */
  const kbList = ref<KbInfo[]>([]);

  /** 选中的知识库ID */
  const selectedKb = ref<string>("");

  /** 返回数量 */
  const topN = ref(5);

  /** 相似度阈值 */
  const similarityThresh = ref(0.7);

  // ========== 计算属性 ==========

  /** 当前会话标题 */
  const currentConversationTitle = computed(() => {
    if (chatMode.value === "rag") {
      return "RAG问答";
    }
    if (!currentConversationId.value) return "新对话";
    const conv = conversations.value.find(
      (c) => c.id === currentConversationId.value,
    );
    return conv?.title || "新对话";
  });

  /** 当前使用的模型代码 */
  const currentModelCode = computed(() => {
    return selectedLlmModel.value === "mcp-llm"
      ? undefined
      : selectedLlmModel.value;
  });

  /** 启用的智能体列表 */
  const enabledAgents = computed(() => {
    return agents.value.filter((a: any) => a.status === true);
  });

  /** 按选中类型筛选的模型列表 */
  const filteredModels = computed(() => {
    return models.value.filter((m: any) => m.status === true && m.type === selectedModelType.value);
  });

  /** 客户端工具权限策略 */
  const toolPolicies = computed(() => {
    return clientToolRouter.getAllPolicies();
  });

  /** 选中的知识库信息 */
  const selectedKbInfo = computed(() => {
    return kbList.value.find((kb) => kb.kbId === selectedKb.value);
  });

  /** 工作目录是否激活 */
  const workspaceIsActive = computed(() => workspace.isActive.value);

  /** 工作目录名称 */
  const workspaceDirName = computed(() => workspace.dirName.value);

  /** 工作目录文件树 */
  const workspaceFileTree = computed(() => workspace.fileTree.value);

  /** 工作目录是否加载中 */
  const workspaceIsLoading = computed(() => workspace.isLoading.value);

  /** 用户是否已手动滚动离开底部（流式输出时暂停自动滚动） */
  const userScrolledAway = ref(false);

  /** 判断容器是否在底部附近（容差 60px） */
  const isNearBottom = (): boolean => {
    const container = messagesRef.value;
    if (!container) return true;
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight < 60
    );
  };

  // ========== 工具方法 ==========

  /** 滚动到底部 */
  const scrollToBottom = () => {
    nextTick(() => {
      const container = messagesRef.value;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
      const lastMsg = container.querySelector(".message:last-child");
      if (lastMsg) {
        lastMsg.scrollIntoView({ block: "end" });
      }
    });
  };

  // ========== 自动滚动（流式输出时）==========

  /** 监听用户滚动行为：离开底部则暂停自动滚动，回到底部则恢复 */
  watch(messagesRef, (container) => {
    if (!container) return;
    const onScroll = () => {
      userScrolledAway.value = !isNearBottom();
    };
    container.addEventListener("scroll", onScroll, { passive: true });
  });

  watch(
    () => {
      const msgs = messages.value;
      if (!isLoading.value || msgs.length === 0) return "";
      const last = msgs[msgs.length - 1];
      const blocks = last.contentBlocks ?? [];
      let key = "";
      for (let i = 0; i < blocks.length; i++) {
        key += blocks[i].content;
      }
      return key;
    },
    () => {
      if (isLoading.value && !userScrolledAway.value) {
        scrollToBottom();
      }
    },
    { flush: "post" },
  );

  /** 判断消息是否正在流式输出 */
  const isMessageStreaming = (index: number): boolean => {
    const msgs = messages.value;
    if (!isLoading.value) return false;
    if (index !== msgs.length - 1) return false;
    return msgs[index].role === "assistant";
  };

  /** 获取模型名称 */
  const getModelName = (modelCode: string): string => {
    const model = models.value.find((m: any) => m.code === modelCode);
    return model?.name || modelCode;
  };

  /** 获取智能体名称 */
  const getAgentName = (agentId: string): string => {
    const agent = agents.value.find((a: any) => a.id === agentId);
    return agent?.name || agentId;
  };

  /** 获取知识库名称 */
  const getKbName = (kbId: string): string => {
    const kb = kbList.value.find((k) => k.kbId === kbId);
    return kb?.kbName || kbId;
  };

  /** 获取空状态标题 */
  const getEmptyTitle = (): string => {
    switch (chatMode.value) {
      case "rag":
        return "知识库问答";
      case "retrieval":
        return "向量检索";
      default:
        return "AI 对话";
    }
  };

  /** 获取空状态描述 */
  const getEmptyDescription = (): string => {
    switch (chatMode.value) {
      case "rag":
        return "选择一个知识库，基于知识库内容进行问答";
      case "retrieval":
        return "选择知识库并输入关键词，检索相关内容";
      default:
        return selectedAgent.value
          ? "选择一个智能体开始对话"
          : "输入消息开始对话";
    }
  };

  // ========== 模式切换 ==========

  /** 处理模式切换 */
  const handleModeChange = async (mode: ChatMode) => {
    chatMode.value = mode;
    clearMessages();
    conversations.value = [];

    if (mode !== "chat" && kbList.value.length === 0) {
      await loadKbList();
    }

    if (mode === "rag") {
      await loadConversations("kb-rag");
    } else {
      await loadConversations();
    }
  };

  // ========== 会话管理 ==========

  /** 加载会话列表 */
  const loadConversations = async (conversationType?: string) => {
    try {
      const params: any = { pageSize: 20 };

      if (conversationType) {
        params.conversationType = conversationType;
        if (conversationType === "kb-rag" && selectedKb.value) {
          params.targetId = selectedKb.value;
        }
      } else {
        params.conversationType = selectedType.value;
        if (selectedType.value === "model") {
          if (selectedLlmModel.value && selectedLlmModel.value !== "mcp-llm") {
            params.targetId = String(selectedLlmModel.value);
          }
        } else if (selectedType.value === "agent") {
          if (selectedAgent.value) {
            params.targetId = String(selectedAgent.value);
          }
        }
      }

      const response = await conversationService.getList(params);
      conversations.value = response.data.list || [];
    } catch (error) {
      console.error("加载会话列表失败:", error);
    }
  };

  /** 选择会话 */
  const handleSelectConversation = async (conversationId: string) => {
    try {
      const response = await conversationService.getDetail(conversationId);
      const conversation = response.data.conversation;
      const rawMessages = response.data.messages || [];

      if (conversation.conversationType === "kb-rag") {
        chatMode.value = "rag";
        currentConversationId.value = conversation.id;
        messages.value = rawMessages;
        selectedKb.value = conversation.targetId;
        if (kbList.value.length === 0) {
          await loadKbList();
        }
      } else if (conversation.conversationType === "agent") {
        chatMode.value = "chat";
        currentConversationId.value = conversation.id;
        messages.value = rawMessages;
        selectedType.value = "agent";
        selectedAgent.value = conversation.targetId || "";
      } else {
        chatMode.value = "chat";
        currentConversationId.value = conversation.id;
        messages.value = rawMessages;
        selectedType.value = "model";
        selectedAgent.value = "";
        if (conversation.targetId) {
          selectedLlmModel.value = conversation.targetId;
        }
      }

      scrollToBottom();
    } catch (error) {
      console.error("加载会话失败:", error);
    }
  };

  /** 删除会话 */
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await conversationService.delete(conversationId);
      if (chatMode.value === "rag") {
        await loadConversations("kb-rag");
      } else {
        await loadConversations();
      }
      if (currentConversationId.value === conversationId) {
        clearMessages();
      }
    } catch (error) {
      console.error("删除会话失败:", error);
    }
  };

  /** 新建会话 */
  const handleNewConversation = () => {
    clearMessages();
  };

  // ========== 知识库 ==========

  /** 加载知识库列表 */
  const loadKbList = async () => {
    try {
      const res = await kbService.getList();
      kbList.value = res.data || [];
    } catch (error) {
      console.error("加载知识库列表失败:", error);
    }
  };

  /** 知识库变更处理 */
  const handleKbChange = async () => {
    clearMessages();
    if (chatMode.value === "rag") {
      await loadConversations("kb-rag");
    }
  };

  // ========== 发送消息 ==========

  /** 统一发送消息入口 */
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading.value) return;

    if (chatMode.value === "chat") {
      selectedType.value = selectedAgent.value ? "agent" : "model";
      await sendChatMessage(content);
    } else if (chatMode.value === "rag") {
      await sendRagMessage(content);
    } else if (chatMode.value === "retrieval") {
      await sendRetrievalQuery(content);
    }
    scrollToBottom();
  };

  /**
   * 发送聊天消息
   * @param content 用户消息内容（显示在UI并存储到数据库）
   * @param aiContent 发送给AI的消息内容（可选，不传则使用content）
   */
  const sendChatMessage = async (content: string, aiContent?: string) => {
    await clientToolService.syncToRegistry();

    if (workspace.dirHandle.value) {
      const workspaceExecutor = new WorkspaceExecutor(
        workspace.dirHandle.value,
      );
      workspaceExecutor.setRefreshCallback(() => {
        workspace.refreshFileTree();
      });
      clientToolRouter.registerExecutor(workspaceExecutor);
      // 工作目录为用户主动选择，读写操作无需弹窗确认
      clientToolRouter.setLocalOverride("workspace", "read_file", {
        confirmMode: "auto",
      });
      clientToolRouter.setLocalOverride("workspace", "write_file", {
        confirmMode: "auto",
      });
      clientToolRouter.setLocalOverride("workspace", "append_file", {
        confirmMode: "auto",
      });
      clientToolRouter.setLocalOverride("workspace", "create_dir", {
        confirmMode: "auto",
      });
      clientToolRouter.setLocalOverride("workspace", "read_dir", {
        confirmMode: "auto",
      });
      clientToolRouter.setLocalOverride("workspace", "delete_file", {
        confirmMode: "auto",
      });
    }
    clientToolRouter.registerExecutor(dynamicClientToolExecutor);
    clientToolRouter.registerExecutor(new DesktopExecutor());
    clientToolRouter.registerExecutor(new BrowserExecutor());

    const userMessage: Message = {
      role: "user",
      content,
      timestamp: Date.now(),
    };
    messages.value.push(userMessage);
    isLoading.value = true;

    const controller = new AbortController();
    abortController.value = controller;

    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      reasoningSteps: [],
      contentBlocks: [],
      timestamp: Date.now(),
    };
    messages.value.push(assistantMessage);
    const assistantIndex = messages.value.length - 1;
    userScrolledAway.value = false;
    scrollToBottom();

    // 等待 TTS WebSocket 连接就绪后再发起流式请求
    if (currentConversationId.value && voiceEnabled.value) {
      await connectTtsIfEnabled(currentConversationId.value);
    }

    try {
      if (selectedType.value === "model") {
        const msgForAI = aiContent ? { ...userMessage, content: aiContent } : userMessage;
        await streamModelChat(assistantIndex, msgForAI, controller.signal);
      } else {
        await streamAgentChat(aiContent || content, assistantIndex, controller.signal);
      }
    } catch {
      isLoading.value = false;
      abortController.value = null;
    }
  };

  /** 模型流式聊天 */
  const streamModelChat = async (
    assistantIndex: number,
    userMessage: Message,
    signal: AbortSignal,
  ) => {
    const messagesToSend: Message[] = [userMessage];

    await new Promise<void>((resolve, reject) => {
      const writer = createSegmentedStreamWriter(
        () => messages.value[assistantIndex],
      );
      const blockMgr = createContentBlockManager(
        () => messages.value[assistantIndex],
      );

      chatService.streamChat(
        {
          modelCode: currentModelCode.value,
          modelType: selectedModelType.value,
          messages: messagesToSend,
          conversationId: currentConversationId.value,
        },
        {
          onMessage: (chunk: string) => {
            blockMgr.ensureActiveTextBlock();
            writer.write(chunk);
          },
          onError: (error: Error) => {
            gracefullyDisconnectTts();
            writer.flush();
            messages.value[assistantIndex].content = `错误: ${error.message}`;
            messages.value[assistantIndex].contentBlocks = [];
            reject(error);
          },
          onComplete: () => {
            gracefullyDisconnectTts();
            writer.flush();
            isLoading.value = false;
            abortController.value = null;
            loadConversations();
            resolve();
          },
          onConversationId: (conversationId: string) => {
            currentConversationId.value = conversationId;
            void connectTtsIfEnabled(conversationId);
          },
          onContentBlockStart: (payload) => {
            blockMgr.onContentBlockStart(payload);
          },
          onContentBlockStop: (payload) => {
            writer.flush();
            blockMgr.onContentBlockStop(payload);
          },
        },
        signal,
      );
    });
  };

  /** 智能体流式聊天 */
  const streamAgentChat = async (
    content: string,
    assistantIndex: number,
    signal: AbortSignal,
  ) => {
    await new Promise<void>((resolve, reject) => {
      const writer = createSegmentedStreamWriter(
        () => messages.value[assistantIndex],
      );
      const blockMgr = createContentBlockManager(
        () => messages.value[assistantIndex],
      );

      agentService.streamChat(
        {
          agentId: selectedAgent.value,
          message: content,
          conversationId: currentConversationId.value,
          modelCode: currentModelCode.value,
          showReasoning: false,
          workspace: workspace.isActive.value
            ? {
                dirName: workspace.dirName.value!,
                treeSummary: workspace.treeSummary.value!,
              }
            : undefined,
        },
        {
          onMessage: (chunk: string) => {
            blockMgr.ensureActiveTextBlock();
            writer.write(chunk);
          },
          onError: (error: Error) => {
            gracefullyDisconnectTts();
            writer.flush();
            messages.value[assistantIndex].content = `错误: ${error.message}`;
            messages.value[assistantIndex].contentBlocks = [];
            reject(error);
          },
          onComplete: () => {
            gracefullyDisconnectTts();
            writer.flush();
            isLoading.value = false;
            abortController.value = null;
            loadConversations();
            resolve();
          },
          onConversationId: (conversationId: string) => {
            currentConversationId.value = conversationId;
            void connectTtsIfEnabled(conversationId);
          },
          onContentBlockStart: (payload) => {
            blockMgr.onContentBlockStart(payload);
          },
          onContentBlockStop: (payload) => {
            writer.flush();
            blockMgr.onContentBlockStop(payload);
          },
          onReasoningStep: (step: ReasoningStep) => {
            if (messages.value[assistantIndex].reasoningSteps) {
              messages.value[assistantIndex].reasoningSteps!.push(step);
            }
            const blocks = messages.value[assistantIndex].contentBlocks;
            if (blocks) {
              for (let i = blocks.length - 1; i >= 0; i--) {
                if (
                  blocks[i].type === "thinking" &&
                  blocks[i].toolStatus === "streaming"
                ) {
                  if (!blocks[i].reasoningSteps) {
                    blocks[i].reasoningSteps = [];
                  }
                  blocks[i].reasoningSteps!.push(step);
                  break;
                }
              }
            }
          },
          onToolResult: (payload) => {
            blockMgr.updateToolBlock(
              payload.name,
              "completed",
              payload.result,
              undefined,
              payload.args,
            );
          },
          onClientToolCall: (payload: ClientToolCallPayload) => {
            writer.flush();
            blockMgr.updateToolBlock(
              payload.toolName,
              "running",
              undefined,
              undefined,
              payload.args,
            );
            clientToolRouter
              .handleCall(
                payload,
                (message) => {
                  return ElMessageBox.confirm(message, "操作确认", {
                    confirmButtonText: "确定",
                    cancelButtonText: "取消",
                    type: "warning",
                  })
                    .then(() => true)
                    .catch(() => false);
                },
                currentConversationId.value,
              )
              .catch((err) => {
                console.error("[useChat] handleCall 未处理异常:", err);
                blockMgr.updateToolBlock(
                  payload.toolName,
                  "error",
                  undefined,
                  String(err),
                );
              });
          },
          onClientToolPolicy: (policies: ClientToolModulePolicy[]) => {
            clientToolRouter.updatePolicies(policies);
          },
        },
        signal,
      );
    });
  };

  /** 发送RAG消息 */
  const sendRagMessage = async (query: string) => {
    if (!selectedKb.value) {
      ElMessage.warning("请先选择知识库");
      return;
    }

    isLoading.value = true;

    const userMessage: Message = {
      role: "user",
      content: query,
      timestamp: Date.now(),
    };
    messages.value.push(userMessage);

    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      type: "rag",
      sources: [],
      contentBlocks: [],
      timestamp: Date.now(),
    };
    messages.value.push(assistantMessage);
    const assistantIndex = messages.value.length - 1;
    userScrolledAway.value = false;
    scrollToBottom();

    try {
      const writer = createSegmentedStreamWriter(
        () => messages.value[assistantIndex],
      );
      const blockMgr = createContentBlockManager(
        () => messages.value[assistantIndex],
      );

      await retrievalService.ragChatStream(
        {
          kbId: selectedKb.value,
          query,
          topN: topN.value,
          similarityThresh: similarityThresh.value,
          conversationId: currentConversationId.value || undefined,
          modelCode: currentModelCode.value,
        },
        {
          onMessage: (content: string) => {
            blockMgr.ensureActiveTextBlock();
            writer.write(content);
          },
          onError: (error: Error) => {
            gracefullyDisconnectTts();
            writer.flush();
            messages.value[assistantIndex].content = "错误: " + error.message;
            messages.value[assistantIndex].contentBlocks = [];
            ElMessage.error("RAG问答失败: " + error.message);
            isLoading.value = false;
          },
          onComplete: (sources?: RetrievalItem[]) => {
            gracefullyDisconnectTts();
            writer.flush();
            if (sources && sources.length > 0) {
              messages.value[assistantIndex].sources = sources;
            }
            isLoading.value = false;
            loadConversations("kb-rag");
          },
          onConversationId: (conversationId: string) => {
            currentConversationId.value = conversationId;
            void connectTtsIfEnabled(conversationId);
          },
          onContentBlockStart: (payload) => {
            blockMgr.onContentBlockStart(payload);
          },
          onContentBlockStop: (payload) => {
            writer.flush();
            blockMgr.onContentBlockStop(payload);
          },
        },
      );
    } catch (error: any) {
      messages.value[assistantIndex].content = "错误: " + error.message;
      ElMessage.error("RAG问答失败");
      isLoading.value = false;
    }
  };

  /** 发送向量检索 */
  const sendRetrievalQuery = async (query: string) => {
    if (!selectedKb.value) {
      ElMessage.warning("请先选择知识库");
      return;
    }

    isLoading.value = true;

    const userMessage: Message = {
      role: "user",
      content: query,
      timestamp: Date.now(),
    };
    messages.value.push(userMessage);

    try {
      const res = await retrievalService.retrieval({
        kbId: selectedKb.value,
        query,
        topN: topN.value,
        similarityThresh: similarityThresh.value,
      });

      const results = res.data?.list || [];
      messages.value.push({
        role: "assistant",
        content: "",
        type: "retrieval",
        results,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      const errorMsg =
        "检索失败: " + (error.response?.data?.message || error.message);
      messages.value.push({
        role: "assistant",
        content: errorMsg,
        timestamp: Date.now(),
      });
      ElMessage.error(errorMsg);
    } finally {
      isLoading.value = false;
    }
  };

  // ========== 用户操作 ==========

  /** LLM模型变更 */
  const handleLlmModelChange = (modelCode: string) => {
    selectedLlmModel.value = modelCode;
    loadConversations();
  };

  /** 模型类型筛选变更 */
  const handleModelTypeChange = (modelType: string) => {
    selectedModelType.value = modelType;
    selectedLlmModel.value = "mcp-llm";
    loadConversations();
  };

  /** 智能体变更 */
  const handleAgentChange = async (agentId: string) => {
    selectedAgent.value = agentId;
    clearMessages();
    selectedType.value = agentId ? "agent" : "model";
    await loadConversations();
  };

  /** 停止生成 */
  const handleStopGeneration = () => {
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
      isLoading.value = false;
    }
    disconnectTts();
  };

  /** 选择工作目录 */
  const handleWorkspaceSelect = async () => {
    try {
      await workspace.selectDirectory();
      ElMessage.success(`已选择工作目录: ${workspace.dirName.value}`);
    } catch {
      // 用户取消
    }
  };

  /** 清除工作目录 */
  const handleWorkspaceClear = () => {
    workspace.clear();
    // 移除工作目录的自动确认策略
    [
      "read_file",
      "write_file",
      "append_file",
      "create_dir",
      "read_dir",
      "delete_file",
    ].forEach((tool) => {
      clientToolRouter.deleteLocalOverride("workspace", tool);
    });
    ElMessage.info("已清除工作目录");
  };

  /** 刷新工作目录文件树 */
  const handleWorkspaceRefresh = async () => {
    await workspace.refreshFileTree();
  };

  /**
   * 处理文件点击事件（在本地打开文件）
   * @param node 文件节点
   */
  const handleFileClick = async (node: any) => {
    if (node.kind !== 'file') return

    // 检查是否在 Electron 环境中
    if (window.electronAPI?.openLocalPath) {
      const filePath = workspace.getFilePath(node)
      if (!filePath) {
        ElMessage.warning('无法获取文件路径，请重新选择工作目录')
        return
      }
      const result = await window.electronAPI.openLocalPath(filePath)
      if (!result.success) {
        ElMessage.error(`打开文件失败: ${result.error || '未知错误'}`)
      }
    } else {
      ElMessage.warning('当前环境不支持打开本地文件')
    }
  }

  /** 清空消息 */
  const clearMessages = () => {
    messages.value = [];
    currentConversationId.value = null;
    ttsStreamService.disconnect();
  };

  // ========== TTS 生命周期管理 ==========

  /**
   * 同步 TTS 状态到响应式 ref
   */
  const syncTtsStatus = () => {
    ttsStatus.value = ttsStreamService.status;
  };

  /**
   * 连接 TTS 语音播报并等待就绪
   *
   * 先建立 WebSocket 连接，再等待连接确认，
   * 确保服务端能从一开始就检测到 TTS 连接。
   * 连接时传递当前语音配置（voiceId/speed/modelCode）。
   */
  const connectTtsIfEnabled = async (conversationId: string) => {
    if (!voiceEnabled.value) return
    if (ttsStreamService.currentConversationId === conversationId && ttsStreamService.isConnected) return

    const config = voiceService.getConfig()

    ttsStreamService.setCallbacks({
      onStatusChange: (status) => {
        ttsStatus.value = status
      },
      onEnd: () => {
        syncTtsStatus()
      },
      onError: (error) => {
        console.warn('[TTS] 播报异常:', error.message)
        syncTtsStatus()
      },
    })

    ttsStreamService.connect(conversationId, config.voiceId, config.speed, config.modelCode)
    await ttsStreamService.waitForConnected()
    syncTtsStatus()
  }

  /**
   * 优雅断开 TTS 语音播报连接
   *
   * 等待 TTS 流结束和音频队列播放完毕后再断开，
   * 避免截断正在播放的音频。
   */
  const gracefullyDisconnectTts = async () => {
    if (!voiceEnabled.value || !ttsStreamService.isConnected) {
      disconnectTts()
      return
    }
    try {
      await ttsStreamService.waitForTtsEnd(15000)
    } catch {
      // 超时也继续断开
    }
    disconnectTts()
  }

  /**
   * 断开 TTS 语音播报连接
   */
  const disconnectTts = () => {
    ttsStreamService.disconnect()
    syncTtsStatus()
  }

  /**
   * 切换语音播报开关
   */
  const handleTtsToggle = () => {
    voiceEnabled.value = !voiceEnabled.value
    voiceService.updateConfig({ autoPlay: voiceEnabled.value })

    if (!voiceEnabled.value) {
      disconnectTts()
    } else if (currentConversationId.value && isLoading.value) {
      connectTtsIfEnabled(currentConversationId.value)
    }
  }

  /**
   * 切换视频对话开关
   * 开启视频对话时自动启用 TTS 语音播报并建立连接
   */
  const handleVideoToggle = () => {
    videoEnabled.value = !videoEnabled.value

    // 开启视频对话时自动启用 TTS
    if (videoEnabled.value && !voiceEnabled.value) {
      voiceEnabled.value = true
      voiceService.updateConfig({ autoPlay: true })
      // 立即连接 TTS，避免空窗期
      if (currentConversationId.value) {
        connectTtsIfEnabled(currentConversationId.value)
      }
    }
  }

  /**
   * 确保存在当前会话，如果不存在则自动创建
   * @returns 是否成功获取到会话ID
   */
  const ensureConversationExists = async (): Promise<boolean> => {
    if (currentConversationId.value) return true

    try {
      // 根据是否选中智能体决定会话类型
      const conversationType = selectedAgent.value ? 'agent' : 'model'
      const targetId = selectedAgent.value || selectedLlmModel.value || 'mcp-llm'

      const res = await conversationService.create({
        conversationType,
        targetId,
      })
      currentConversationId.value = res.data.id
      selectedType.value = conversationType as 'model' | 'agent'

      // 刷新会话列表
      await loadConversations()

      return true
    } catch (error) {
      console.error('自动创建会话失败:', error)
      ElMessage.error('创建会话失败，请重试')
      return false
    }
  }

  /**
   * 切换 S2S 端到端语音模式
   */
  const handleS2sToggle = async () => {
    // 检查浏览器支持
    if (!s2sAudio.isSupported.value) {
      ElMessage.error('浏览器不支持实时语音对话')
      return
    }

    // 如果没有对话，自动创建一个
    if (!currentConversationId.value) {
      const created = await ensureConversationExists()
      if (!created) return
    }

    s2sEnabled.value = !s2sEnabled.value

    if (s2sEnabled.value) {
      // 启用 S2S 时，禁用 TTS（避免冲突）
      if (voiceEnabled.value) {
        voiceEnabled.value = false
        voiceService.updateConfig({ autoPlay: false })
        ttsStreamService.disconnect()
      }

      // 启动 S2S 会话
      s2sAudio.startSession(currentConversationId.value ?? undefined, selectedAgent.value || undefined)
      ElMessage.success('实时语音对话已启动，请开始说话')
    } else {
      // 禁用 S2S 时，停止会话
      s2sAudio.stopSession()
      ElMessage.info('实时语音对话已关闭')
    }
  }

  /**
   * 启动 S2S 会话
   */
  const handleS2sStart = async () => {
    if (!s2sAudio.isSupported.value) {
      ElMessage.error('浏览器不支持实时语音对话')
      return
    }

    // 如果没有对话，自动创建一个
    if (!currentConversationId.value) {
      const created = await ensureConversationExists()
      if (!created) return
    }

    await s2sAudio.startSession(currentConversationId.value ?? undefined, selectedAgent.value || undefined)
  }

  /**
   * 停止 S2S 会话
   */
  const handleS2sStop = () => {
    s2sAudio.stopSession()
    // 清空 S2S 流式文本追踪
    s2sLastUserText.value = ''
    s2sLastAssistantText.value = ''
    s2sCurrentUserMsgIndex.value = -1
    s2sCurrentAssistantMsgIndex.value = -1
  }

  /** S2S 用户文本累积 */
  const s2sLastUserText = ref('')

  /** S2S 助手文本累积 */
  const s2sLastAssistantText = ref('')

  /** S2S 当前用户消息索引 */
  const s2sCurrentUserMsgIndex = ref(-1)

  /** S2S 当前助手消息索引 */
  const s2sCurrentAssistantMsgIndex = ref(-1)

  /**
   * 处理 S2S 文本回调，将对话文本显示在对话区域
   *
   * @param text 文本内容
   * @param role 角色（user/assistant）
   */
  const handleS2sText = (text: string, role: 'user' | 'assistant') => {
    if (!text.trim()) return
    console.log('[useChat] handleS2sText:', { text, role })

    if (role === 'user') {
      // 如果已经有上一轮的助手消息，说明是新一轮对话开始
      // 重置助手的消息状态，让下一次助手回复创建新消息
      if (s2sCurrentAssistantMsgIndex.value >= 0 || s2sLastAssistantText.value.length > 0) {
        console.log('[useChat] 检测到新一轮对话，重置助手消息状态')
        s2sCurrentAssistantMsgIndex.value = -1
        s2sLastAssistantText.value = ''
      }

      // 用户语音识别文本：追加到当前用户消息
      s2sLastUserText.value += text
      if (s2sCurrentUserMsgIndex.value < 0 || !messages.value[s2sCurrentUserMsgIndex.value]) {
        // 创建新的用户消息
        const msg: Message = {
          role: 'user',
          content: s2sLastUserText.value,
          timestamp: Date.now(),
        }
        messages.value.push(msg)
        s2sCurrentUserMsgIndex.value = messages.value.length - 1
        console.log('[useChat] 创建用户消息:', { index: s2sCurrentUserMsgIndex.value, content: s2sLastUserText.value })
      } else {
        // 更新现有用户消息
        messages.value[s2sCurrentUserMsgIndex.value].content = s2sLastUserText.value
        console.log('[useChat] 更新用户消息:', { index: s2sCurrentUserMsgIndex.value, content: s2sLastUserText.value })
      }
      scrollToBottom()
    } else {
      // 助手回复文本：追加到当前助手消息
      s2sLastAssistantText.value += text
      if (s2sCurrentAssistantMsgIndex.value < 0 || !messages.value[s2sCurrentAssistantMsgIndex.value]) {
        // 创建新的助手消息
        const msg: Message = {
          role: 'assistant',
          content: s2sLastAssistantText.value,
          timestamp: Date.now(),
        }
        messages.value.push(msg)
        s2sCurrentAssistantMsgIndex.value = messages.value.length - 1
        console.log('[useChat] 创建助手消息:', { index: s2sCurrentAssistantMsgIndex.value, content: s2sLastAssistantText.value })
      } else {
        // 更新现有助手消息
        messages.value[s2sCurrentAssistantMsgIndex.value].content = s2sLastAssistantText.value
        console.log('[useChat] 更新助手消息:', { index: s2sCurrentAssistantMsgIndex.value, content: s2sLastAssistantText.value })
      }
      scrollToBottom()

      // 助手回复结束后，重置用户消息索引，准备下一轮对话
      // （ASR 识别到新一轮用户语音时会创建新的用户消息）
      s2sCurrentUserMsgIndex.value = -1
      s2sLastUserText.value = ''
    }
  }

  /**
   * 暂停语音播报
   */
  const handleTtsPause = () => {
    ttsStreamService.pause()
    syncTtsStatus()
  }

  /**
   * 恢复语音播报
   */
  const handleTtsResume = () => {
    ttsStreamService.resume()
    syncTtsStatus()
  }

  /**
   * 切换语音
   */
  const handleTtsChangeVoice = (voiceId: string) => {
    ttsStreamService.changeVoice(voiceId)
  }

  /**
   * 调整语速
   */
  const handleTtsChangeSpeed = (speed: number) => {
    ttsStreamService.changeSpeed(speed)
  }

  // ========== 文件上传 ==========

  /**
   * 处理文件上传
   * 将文件上传到服务器，添加用户消息并自动触发 AI 处理
   * 消息内容使用服务器 URL（UI 显示和 DB 存储），服务端会自行下载图片转为多模态内容传给 AI
   * @param file 文件对象
   * @param fileType 文件类型（image/video/file）
   */
  const handleFileUpload = async (file: File, fileType: string) => {
    try {
      const response = await chatService.uploadFile(file, fileType);
      const result = response.data || response;
      const fileUrl = result.fileUrl || '';

      const fileSize = (file.size / 1024 / 1024).toFixed(2);

      if (fileType === 'image') {
        const displayContent = `![${file.name}](${fileUrl})`;
        await sendChatMessage(displayContent);
      } else {
        messages.value.push({
          role: "user",
          content: `[${fileType === 'video' ? '视频' : '文件'}] ${file.name}（${fileSize}MB）\n${fileUrl}`,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      ElMessage.error("文件上传失败");
      console.error("文件上传错误:", error);
    }
  };

  // ========== 初始化 ==========

  /** 加载模型列表 */
  const loadModels = async () => {
    try {
      const response = await chatService.getModels();
      models.value = response.data || [];
    } catch (error) {
      console.error("加载模型列表失败:", error);
    }
  };

  /** 加载智能体列表 */
  const loadAgents = async () => {
    try {
      const response = await agentService.getList();
      agents.value = response.data || [];
    } catch (error) {
      console.error("加载智能体列表失败:", error);
    }
  };

  /** 初始化 */
  const init = async () => {
    await loadModels();
    await loadAgents();
    await loadConversations();
  };

  // ========== 暴露接口 ==========

  return {
    chatMode,
    messagesRef,
    selectedAgent,
    selectedLlmModel,
    selectedModelType,
    filteredModels,
    messages,
    isLoading,
    currentConversationId,
    currentConversationTitle,
    conversations,
    models,
    agents,
    enabledAgents,
    toolPolicies,
    workspaceIsActive,
    workspaceDirName,
    workspaceFileTree,
    workspaceIsLoading,
    kbList,
    selectedKb,
    selectedKbInfo,
    topN,
    similarityThresh,
    isMessageStreaming,
    voiceEnabled,
    ttsStatus,
    videoEnabled,
    s2sEnabled,
    s2sAudio,
    handleModeChange,
    handleLlmModelChange,
    handleModelTypeChange,
    handleAgentChange,
    handleKbChange,
    handleSendMessage,
    handleSelectConversation,
    handleDeleteConversation,
    handleNewConversation,
    handleStopGeneration,
    handleWorkspaceSelect,
    handleWorkspaceClear,
    handleWorkspaceRefresh,
    handleFileClick,
    handleTtsToggle,
    handleVideoToggle,
    handleS2sToggle,
    handleS2sStart,
    handleS2sStop,
    handleTtsPause,
    handleTtsResume,
    handleTtsChangeVoice,
    handleTtsChangeSpeed,
    handleFileUpload,
    getModelName,
    getAgentName,
    getKbName,
    getEmptyTitle,
    getEmptyDescription,
    init,
  };
}
