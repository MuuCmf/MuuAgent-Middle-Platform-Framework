<template>
  <div class="database-config-editor">
    <div class="config-section">
      <div class="section-label">数据库连接</div>
      <el-row :gutter="12">
        <el-col :span="14">
          <el-form-item label="主机地址">
            <el-input v-model="localConfig.connection.host" placeholder="127.0.0.1" />
          </el-form-item>
        </el-col>
        <el-col :span="10">
          <el-form-item label="端口">
            <el-input-number v-model="localConfig.connection.port" :min="1" :max="65535" controls-position="right"
              class="w-full" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="用户名">
            <el-input v-model="localConfig.connection.user" placeholder="root" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="密码">
            <el-input v-model="localConfig.connection.password" type="password" show-password placeholder="数据库密码" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="数据库名">
        <el-input v-model="localConfig.connection.database" placeholder="请输入数据库名称" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" plain :loading="testing" @click="handleTestConnection">
          <el-icon>
            <Connection />
          </el-icon>
          测试连接
        </el-button>
        <span v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
          {{ testResult.success ? `连接成功 (${testResult.latencyMs}ms, v${testResult.serverVersion})` : `连接失败:
          ${testResult.error}` }}
        </span>
      </el-form-item>
    </div>

    <div class="config-section">
      <div class="section-label">查询配置</div>
      <el-form-item label="数据库类型">
        <el-select v-model="localConfig.databaseType" class="w-full">
          <el-option label="MySQL" value="mysql" />
          <el-option label="PostgreSQL" value="postgresql" disabled />
        </el-select>
      </el-form-item>
      <el-form-item label="SQL 查询">
        <el-input v-model="localConfig.query" type="textarea" :rows="4"
          placeholder="SELECT * FROM users WHERE city = :city" />
        <div class="field-tip">使用 :参数名 作为命名参数占位符，如 :city、:status</div>
      </el-form-item>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="最大行数">
            <el-input-number v-model="localConfig.maxRows" :min="1" :max="10000" :step="100" controls-position="right"
              class="w-full" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="只读模式">
        <el-switch v-model="localConfig.readOnly" active-text="只读" inactive-text="读写" />
        <div class="field-tip">只读模式仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN</div>
      </el-form-item>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection } from '@element-plus/icons-vue'
import { testDatabaseConnection } from '@/api/skill'

interface DatabaseConnectionConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

interface DatabaseSkillConfig {
  databaseType: string
  readOnly: boolean
  maxRows: number
  query: string
  connection: DatabaseConnectionConfig
}

interface TestResult {
  success: boolean
  serverVersion?: string
  latencyMs?: number
  error?: string
}

const props = defineProps<{
  config?: string
}>()

const emit = defineEmits<{
  (e: 'update:config', value: string): void
}>()

const testing = ref(false)
const testResult = ref<TestResult | null>(null)

const defaultConfig: DatabaseSkillConfig = {
  databaseType: 'mysql',
  readOnly: true,
  maxRows: 1000,
  query: '',
  connection: {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: '',
  },
}

const localConfig = reactive<DatabaseSkillConfig>({ ...defaultConfig })

const parseConfig = (configStr: string): DatabaseSkillConfig => {
  try {
    const parsed = JSON.parse(configStr)
    return {
      databaseType: parsed.databaseType || 'mysql',
      readOnly: parsed.readOnly ?? true,
      maxRows: parsed.maxRows || 1000,
      query: parsed.query || '',
      connection: {
        host: parsed.connection?.host || '127.0.0.1',
        port: parsed.connection?.port || 3306,
        user: parsed.connection?.user || 'root',
        password: parsed.connection?.password || '',
        database: parsed.connection?.database || '',
      },
    }
  } catch {
    return { ...defaultConfig }
  }
}

const syncToParent = () => {
  emit('update:config', JSON.stringify(localConfig, null, 2))
}

watch(() => props.config, (newVal) => {
  const parsed = parseConfig(newVal || '{}')
  Object.assign(localConfig, parsed)
}, { immediate: true })

watch(localConfig, () => {
  syncToParent()
}, { deep: true })

const handleTestConnection = async () => {
  testing.value = true
  testResult.value = null
  try {
    const result = await testDatabaseConnection(JSON.stringify(localConfig))
    testResult.value = result
    if (result.success) {
      ElMessage.success('数据库连接成功')
    } else {
      ElMessage.error(result.error || '连接失败')
    }
  } catch (err: any) {
    testResult.value = { success: false, error: err.message || '连接测试失败' }
    ElMessage.error('连接测试失败')
  } finally {
    testing.value = false
  }
}
</script>

<style lang="scss" scoped>
.database-config-editor {
  width: 100%;
}

.config-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #ebeef5;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #dcdfe6;
}

.w-full {
  width: 100%;
}

.field-tip {
  width: 100%;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

.test-result {
  margin-left: 12px;
  font-size: 13px;

  &.success {
    color: #67c23a;
  }

  &.error {
    color: #f56c6c;
  }
}
</style>