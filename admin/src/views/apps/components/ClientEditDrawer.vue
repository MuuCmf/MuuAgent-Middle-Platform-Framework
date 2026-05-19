<template>
  <el-drawer
    v-model="visible"
    :title="isEdit ? $t('app.editClient') : $t('app.createClient')"
    direction="rtl"
    size="600px"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
      style="padding: 20px;"
    >
      <el-form-item :label="$t('app.clientName')" prop="name">
        <el-input v-model="formData.name" :placeholder="$t('app.pleaseInputClientName')" />
      </el-form-item>

      <el-form-item :label="$t('app.callbackUrl')" prop="redirectUris">
        <div style="width: 100%;">
          <div
            v-for="(_, index) in formData.redirectUris"
            :key="index"
            style="display: flex; gap: 8px; margin-bottom: 8px;"
          >
            <el-input
              v-model="formData.redirectUris[index]"
              :placeholder="$t('app.pleaseInputCallbackUrl')"
              style="flex: 1;"
            />
            <el-button
              type="danger"
              :icon="Delete"
              @click="removeRedirectUri(index)"
              :disabled="formData.redirectUris.length === 1"
            />
          </div>
          <el-button type="primary" :icon="Plus" @click="addRedirectUri">
            {{ $t('app.addCallbackUrl') }}
          </el-button>
        </div>
      </el-form-item>

      <el-form-item :label="$t('app.permissionScope')" prop="scopes">
        <div style="width: 100%;">
          <div
            v-for="group in scopeGroups"
            :key="group.label"
            style="margin-bottom: 12px;"
          >
            <div style="font-weight: 500; margin-bottom: 4px; color: #606266; font-size: 13px;">
              {{ group.label }}
            </div>
            <el-checkbox-group v-model="formData.scopes" style="display: flex; flex-wrap: wrap; gap: 8px;">
              <el-tooltip
                v-for="scope in group.scopes"
                :key="scope.value"
                :content="scope.description"
                placement="top"
              >
                <el-checkbox :label="scope.value">
                  {{ scope.label }}
                </el-checkbox>
              </el-tooltip>
            </el-checkbox-group>
          </div>
        </div>
      </el-form-item>

      <el-form-item :label="$t('app.authorizationType')" prop="grants">
        <el-checkbox-group v-model="formData.grants">
          <el-checkbox label="authorization_code">{{ $t('app.authorizationCodeMode') }}</el-checkbox>
          <el-checkbox label="refresh_token">{{ $t('app.refreshToken') }}</el-checkbox>
        </el-checkbox-group>
      </el-form-item>

      <el-form-item v-if="isEdit" :label="$t('app.clientStatus')" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :label="1">{{ $t('app.enabled') }}</el-radio>
          <el-radio :label="0">{{ $t('app.disabled') }}</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <div style="text-align: right;">
        <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ isEdit ? $t('app.save') : $t('app.create') }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { oauthApi, type OAuthClient, type CreateClientDto, type UpdateClientDto } from '@/api/oauth'
import { scopeApi } from '@/api/scope'
import type { ScopeOption } from '@/constants/scope'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  visible: boolean
  client: OAuthClient | null
  appCode?: string
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const visible = computed({
  get: () => props.visible,
  set: (value) => emits('update:visible', value),
})

const isEdit = computed(() => !!props.client)

const formRef = ref<FormInstance>()
const submitting = ref(false)
const scopeGroups = ref<Array<{ label: string; scopes: ScopeOption[] }>>([])

const formData = ref<CreateClientDto & { status?: number }>({
  name: '',
  redirectUris: [''],
  scopes: [],
  grants: ['authorization_code', 'refresh_token'],
  status: 1,
})

const rules: FormRules = {
  name: [
    { required: true, message: t('app.pleaseInputClientName'), trigger: 'blur' },
  ],
  redirectUris: [
    { required: true, message: t('app.atLeastOneCallbackUrl'), trigger: 'change' },
  ],
  scopes: [
    { required: true, message: t('app.pleaseSelectPermissionScope'), trigger: 'change' },
  ],
  grants: [
    { required: true, message: t('app.pleaseSelectAuthorizationType'), trigger: 'change' },
  ],
}

/**
 * 加载 scope 数据
 */
const loadScopeData = async () => {
  try {
    // 获取 scope 分组和描述信息
    const [groups, descriptions] = await Promise.all([
      scopeApi.getAdminGroups(),
      scopeApi.getDescriptions()
    ])
    
    // 转换为前端需要的格式
    scopeGroups.value = groups.map(group => ({
      label: group.label,
      scopes: group.scopes.map(scope => {
        const [module, action] = scope.split(':')
        const actionMap: Record<string, string> = {
          read: '读取',
          write: '写入',
          execute: '执行',
        }
        return {
          value: scope,
          label: `${module}-${actionMap[action] || action}`,
          description: descriptions[scope] || scope
        }
      })
    }))
  } catch (error) {
    console.error('获取 scope 数据失败:', error)
    ElMessage.error(t('app.getPermissionDataFailed'))
  }
}

onMounted(() => {
  loadScopeData()
})

/**
 * 添加回调地址
 */
const addRedirectUri = () => {
  formData.value.redirectUris.push('')
}

/**
 * 删除回调地址
 * @param index 索引
 */
const removeRedirectUri = (index: number) => {
  formData.value.redirectUris.splice(index, 1)
}

/**
 * 重置表单
 */
const resetForm = () => {
  formData.value = {
    name: '',
    redirectUris: [''],
    scopes: [],
    grants: ['authorization_code', 'refresh_token'],
    status: 1,
  }
  formRef.value?.clearValidate()
}

/**
 * 关闭抽屉
 */
const handleClose = () => {
  visible.value = false
  resetForm()
}

/**
 * 提交表单
 */
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    try {
      if (isEdit.value && props.client) {
        const updateData: UpdateClientDto = {
          name: formData.value.name,
          redirectUris: formData.value.redirectUris,
          scopes: formData.value.scopes,
          grants: formData.value.grants,
          status: formData.value.status,
        }
        await oauthApi.updateClient(props.client.id, updateData)
        ElMessage.success(t('app.clientUpdateSuccess'))
      } else {
        const createData: CreateClientDto = {
          name: formData.value.name,
          redirectUris: formData.value.redirectUris,
          scopes: formData.value.scopes,
          grants: formData.value.grants,
          appCode: props.appCode,
        }
        const response = await oauthApi.createClient(createData)
        
        await ElMessageBox.alert(
          `${t('app.clientId')}：${response.data.data.clientId}\n${t('app.clientSecret')}：${response.data.data.clientSecret}`,
          t('app.createClientSuccess'),
          {
            confirmButtonText: t('common.confirm'),
            type: 'success',
          }
        )
      }
      
      emits('success')
      handleClose()
    } catch (error: any) {
      ElMessage.error(error.response?.data?.message || t('app.operationFailed'))
    } finally {
      submitting.value = false
    }
  })
}

watch(
  () => props.visible,
  (newVisible) => {
    if (newVisible && props.client) {
      formData.value = {
        name: props.client.name,
        redirectUris: [...props.client.redirectUris],
        scopes: [...props.client.scopes],
        grants: [...props.client.grants],
        status: props.client.status,
      }
    }
  }
)
</script>
