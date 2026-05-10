import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '仪表盘', icon: 'Odometer' }
      },
      {
        path: 'models',
        name: 'Models',
        component: () => import('@/views/models/index.vue'),
        meta: { title: '模型配置', icon: 'Setting' }
      },
      {
        path: 'mcp',
        name: 'MCP',
        component: () => import('@/views/mcp/index.vue'),
        meta: { title: 'MCP调度', icon: 'Connection' }
      },
      {
        path: 'skills',
        name: 'Skills',
        component: () => import('@/views/skills/index.vue'),
        meta: { title: '技能', icon: 'Tools' }
      },
      {
        path: 'agents',
        name: 'Agents',
        component: () => import('@/views/agents/index.vue'),
        meta: { title: '智能体', icon: 'User' }
      },
      {
        path: 'kb',
        name: 'Kb',
        meta: { title: '知识库', icon: 'Collection' },
        redirect: 'kb/list',
        children: [
          {
            path: 'list',
            name: 'KbList',
            component: () => import('@/views/kb/KbList.vue'),
            meta: { title: '知识库列表' }
          },
          {
            path: 'detail/:id',
            name: 'KbDetail',
            component: () => import('@/views/kb/KbDetail.vue'),
            meta: { title: '知识库详情' }
          }
        ]
      },
      {
        path: 'prompt-templates',
        name: 'PromptTemplates',
        component: () => import('@/views/prompt-templates/index.vue'),
        meta: { title: 'Prompt模板', icon: 'Document' }
      },
      {
        path: 'rate-limit',
        name: 'RateLimit',
        component: () => import('@/views/rate-limit/index.vue'),
        meta: { title: '熔断限流', icon: 'Warning' }
      },
      {
        path: 'conversations',
        name: 'Conversations',
        meta: { title: '会话管理', icon: 'ChatLineSquare' },
        redirect: 'conversations/list',
        children: [
          {
            path: 'list',
            name: 'ConversationList',
            component: () => import('@/views/conversations/index.vue'),
            meta: { title: '会话列表' }
          },
          {
            path: 'detail/:id',
            name: 'ConversationDetail',
            component: () => import('@/views/conversations/detail.vue'),
            meta: { title: '会话详情' }
          }
        ]
      },
      {
        path: 'chat',
        name: 'Chat',
        component: () => import('@/views/chat/index.vue'),
        meta: { title: '对话测试', icon: 'ChatDotRound' }
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/logs/index.vue'),
        meta: { title: '调用日志', icon: 'Document' }
      },
      {
        path: 'oauth-clients',
        name: 'OAuthClients',
        component: () => import('@/views/oauth-clients/index.vue'),
        meta: { title: 'OAuth管理', icon: 'Key' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_ROUTER_BASE || '/admin/'),
  routes
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('admin_token')
  
  if (to.meta.requiresAuth !== false && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/')
  } else {
    next()
  }
})

export default router
