import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import i18n from '@/locales'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: 'route.login', requiresAuth: false }
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
        meta: { title: 'route.dashboard', icon: 'Odometer' }
      },
      {
        path: 'apps',
        name: 'Apps',
        meta: { title: 'route.apps', icon: 'Grid' },
        redirect: { name: 'AppList' },
        children: [
          {
            path: 'list',
            name: 'AppList',
            component: () => import('@/views/apps/index.vue'),
            meta: { title: 'route.appList' }
          },
          {
            path: 'detail/:id',
            name: 'AppDetail',
            component: () => import('@/views/apps/detail.vue'),
            meta: { title: 'route.appDetail' }
          }
        ]
      },
      {
        path: 'models',
        name: 'Models',
        component: () => import('@/views/models/index.vue'),
        meta: { title: 'route.models', icon: 'Setting' }
      },
      {
        path: 'agents',
        name: 'Agents',
        component: () => import('@/views/agents/index.vue'),
        meta: { title: 'route.agents', icon: 'User' }
      },
      {
        path: 'skills',
        name: 'Skills',
        component: () => import('@/views/skills/index.vue'),
        meta: { title: 'route.skills', icon: 'Tools' }
      },
      {
        path: 'mcp-server',
        name: 'McpServer',
        component: () => import('@/views/mcp-server/index.vue'),
        meta: { title: 'route.mcpServer', icon: 'Connection' }
      },
      {
        path: 'kb',
        name: 'Kb',
        meta: { title: 'route.knowledge', icon: 'Collection' },
        redirect: 'kb/list',
        children: [
          {
            path: 'list',
            name: 'KbList',
            component: () => import('@/views/kb/KbList.vue'),
            meta: { title: 'route.kbList' }
          },
          {
            path: 'detail/:id',
            name: 'KbDetail',
            component: () => import('@/views/kb/KbDetail.vue'),
            meta: { title: 'route.kbDetail' }
          }
        ]
      },
      {
        path: 'prompt-templates',
        name: 'PromptTemplates',
        component: () => import('@/views/prompt-templates/index.vue'),
        meta: { title: 'route.promptTemplates', icon: 'Document' }
      },
      {
        path: 'rate-limit',
        name: 'RateLimit',
        component: () => import('@/views/rate-limit/index.vue'),
        meta: { title: 'route.rateLimit', icon: 'Warning' }
      },
      {
        path: 'cache',
        name: 'Cache',
        component: () => import('@/views/cache/index.vue'),
        meta: { title: 'route.cache', icon: 'Coin' }
      },
      {
        path: 'conversations',
        name: 'Conversations',
        meta: { title: 'route.conversations', icon: 'ChatLineSquare' },
        redirect: 'conversations/list',
        children: [
          {
            path: 'list',
            name: 'ConversationList',
            component: () => import('@/views/conversations/index.vue'),
            meta: { title: 'route.conversationList' }
          },
          {
            path: 'detail/:id',
            name: 'ConversationDetail',
            component: () => import('@/views/conversations/detail.vue'),
            meta: { title: 'route.conversationDetail' }
          }
        ]
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/logs/index.vue'),
        meta: { title: 'route.logs', icon: 'Document' }
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
  
  // 设置页面标题
  if (to.meta.title) {
    const title = i18n.global.t(to.meta.title as string)
    document.title = `${title} - MuuAI中台管理系统`
  }
  
  if (to.meta.requiresAuth !== false && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/')
  } else {
    next()
  }
})

export default router
