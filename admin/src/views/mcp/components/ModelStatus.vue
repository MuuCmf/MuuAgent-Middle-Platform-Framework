<template>
    <div class="help-tip">
        <div class="help-tip-title">💡 状态说明</div>
        <ul>
            <li><strong>并发控制</strong>：限制同时进行的请求数，防止过载</li>
            <li><strong>QPS限制</strong>：每秒最大请求数</li>
            <li><strong>重置熔断</strong>：手动将熔断的模型恢复正常</li>
            <li><strong>熔断状态</strong>：
                <ul>
                    <li><code>closed</code>：正常状态，可正常调用</li>
                    <li><code>open</code>：熔断状态，模型暂时不可用（错误次数过多触发）</li>
                    <li><code>half_open</code>：半开状态，正在尝试恢复</li>
                </ul>
            </li>
        </ul>
    </div>
    <div class="card">
        <div class="card-title">
            状态监控
        </div>
        <el-table :data="modelStatus" stripe v-loading="statusLoading">
            <el-table-column label="模型">
                <template #default="{ row }">
                    <strong>{{ row.modelName }}</strong>
                    <br>
                    <small style="color: #999">{{ row.modelCode }}</small>
                </template>
            </el-table-column>
            <el-table-column prop="circuitStatus" label="熔断状态" width="120">
                <template #default="{ row }">
                    <el-tag :type="getCircuitTagType(row.circuitStatus)">
                        {{ getCircuitStatusText(row.circuitStatus) }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="errorCount" label="错误次数" width="100">
                <template #default="{ row }">
                    <el-tag v-if="row.errorCount > 0" type="danger">{{ row.errorCount }}</el-tag>
                    <span v-else>{{ row.errorCount }}</span>
                </template>
            </el-table-column>
            <el-table-column label="当前并发" width="120">
                <template #default="{ row }">
                    {{ row.currentConcurrent }} / {{ row.maxConcurrent }}
                </template>
            </el-table-column>
            <el-table-column prop="maxConcurrent" label="最大并发" width="100" />
            <el-table-column prop="qpsLimit" label="QPS限制" width="100" />
            <el-table-column label="操作" width="120" align="right">
                <template #default="{ row }">
                    <el-button v-if="row.circuitStatus !== 'closed'" size="small" type="primary"
                        @click="handleResetCircuit(row.modelId)">
                        重置熔断
                    </el-button>
                    <el-button v-else size="small" type="primary" disabled>
                        重置熔断
                    </el-button>
                </template>
            </el-table-column>
        </el-table>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { mcpApi } from '@/api/mcp'

const statusLoading = ref(false)
const modelStatus = ref<any[]>([])

const getCircuitTagType = (status: string) => {
    const map: Record<string, any> = {
        'closed': 'success',
        'open': 'danger',
        'half_open': 'warning'
    }
    return map[status] || 'info'
}

const getCircuitStatusText = (status: string) => {
    const map: Record<string, string> = {
        'closed': '正常',
        'open': '熔断',
        'half_open': '恢复中'
    }
    return map[status] || status
}

const loadModelStatus = async () => {
    statusLoading.value = true
    try {
        const { data } = await mcpApi.getStatus()
        modelStatus.value = data.data || []
    } catch (error) {
        console.error('加载模型状态失败', error)
        ElMessage.error('加载模型状态失败')
    } finally {
        statusLoading.value = false
    }
}

const handleResetCircuit = async (modelId: string) => {
    try {
        await mcpApi.resetCircuit(modelId)
        ElMessage.success('熔断状态已重置')
        loadModelStatus()
    } catch (error) {
        console.error('重置熔断失败', error)
        ElMessage.error('重置熔断失败')
    }
}

onMounted(() => {
    loadModelStatus()
})
</script>