import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'
import RagTestView from '../views/RagTestView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: ChatView,
    },
    {
      path: '/rag-test',
      name: 'rag-test',
      component: RagTestView,
    },
  ],
})

export default router
