import { Type } from '@nestjs/common';

// Leaf modules (no business dependencies)
import { ModelModule } from '../../model/model.module';
import { ModelTemplateModule } from '../../model-template/model-template.module';
import { ConversationModule } from '../../conversation/conversation.module';
import { LogModule } from '../../log/log.module';
import { VectorModule } from '../../vector/vector.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { KbModule } from '../../kb/kb.module';
import { OAuthModule } from '../../oauth/oauth.module';
import { McpServerModule } from '../../mcp-server/mcp-server.module';
import { AdminModule } from '../../admin/admin.module';
import { SystemControlModule } from '../../system-control/system-control.module';

// Mid-level modules
import { IntentModule } from '../../intent/intent.module';
import { ModelRoutingModule } from '../../model-routing/model-routing.module';
import { DocumentModule } from '../../document/document.module';

// Upper-level modules
import { AiModule } from '../../ai/ai.module';
import { RetrievalModule } from '../../retrieval/retrieval.module';
import { SkillModule } from '../../skill/skill.module';
import { AppModule as AppMgmtModule } from '../../app/app.module';

// Top-level modules
import { ReasoningModule } from '../../reasoning/reasoning.module';
import { AgentModule } from '../../agent/agent.module';

export const KNOWN_BUSINESS_MODULES: Type[] = [
  ModelModule,
  ModelTemplateModule,
  ConversationModule,
  LogModule,
  VectorModule,
  WorkspaceModule,
  KbModule,
  OAuthModule,
  McpServerModule,
  AdminModule,
  SystemControlModule,
  IntentModule,
  ModelRoutingModule,
  DocumentModule,
  AiModule,
  RetrievalModule,
  SkillModule,
  AppMgmtModule,
  ReasoningModule,
  AgentModule,
];
