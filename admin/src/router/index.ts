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
        path: 'apps',
        name: 'Apps',
        meta: { title: '应用管理', icon: 'Grid' },
        redirect: { name: 'AppList' },
        children: [
          {
            path: 'list',
            name: 'AppList',
            component: () => import('@/views/apps/index.vue'),
            meta: { title: '应用列表' }
          },
          {
            path: 'detail/:id',
            name: 'AppDetail',
            component: () => import('@/views/apps/detail.vue'),
            meta: { title: '应用详情' }
          }
        ]
      },
      {
        path: 'models',
        name: 'Models',
        component: () => import('@/views/models/index.vue'),
        meta: { title: '模型配置', icon: 'Setting' }
      },
      {
        path: 'model-routing',
        name: 'ModelRouting',
        component: () => import('@/views/model-routing/index.vue'),
        meta: { title: '模型路由调度', icon: 'Connection' }
      },
      {
        path: 'agents',
        name: 'Agents',
        component: () => import('@/views/agents/index.vue'),
        meta: { title: '智能体', icon: 'User' }
      },
      {
        path: 'skills',
        name: 'Skills',
        component: () => import('@/views/skills/index.vue'),
        meta: { title: '技能', icon: 'Tools' }
      },
      {
        path: 'mcp-server',
        name: 'McpServer',
        component: () => import('@/views/mcp-server/index.vue'),
        meta: { title: 'MCP Server', icon: 'Connection' }
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
        path: 'cache',
        name: 'Cache',
        component: () => import('@/views/cache/index.vue'),
        meta: { title: '缓存管理', icon: 'Coin' }
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
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/logs/index.vue'),
        meta: { title: '调用日志', icon: 'Document' }
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
