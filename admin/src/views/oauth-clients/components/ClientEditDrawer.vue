<template>
  <el-drawer
    v-model="visible"
    :title="isEdit ? '编辑客户端' : '创建客户端'"
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
      <el-form-item label="客户端名称" prop="name">
        <el-input v-model="formData.name" placeholder="请输入客户端名称" />
      </el-form-item>

      <el-form-item label="回调地址" prop="redirectUris">
        <div style="width: 100%;">
          <div
            v-for="(_, index) in formData.redirectUris"
            :key="index"
            style="display: flex; gap: 8px; margin-bottom: 8px;"
          >
            <el-input
              v-model="formData.redirectUris[index]"
              placeholder="https://example.com/callback"
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
            添加回调地址
          </el-button>
        </div>
      </el-form-item>

      <el-form-item label="权限范围" prop="scopes">
        <el-select
          v-model="formData.scopes"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="请选择或输入权限范围"
          style="width: 100%;"
        >
          <el-option label="读取用户信息" value="read" />
          <el-option label="写入用户信息" value="write" />
          <el-option label="管理员权限" value="admin" />
        </el-select>
      </el-form-item>

      <el-form-item label="授权类型" prop="grants">
        <el-checkbox-group v-model="formData.grants">
          <el-checkbox label="authorization_code">授权码模式</el-checkbox>
          <el-checkbox label="refresh_token">刷新令牌</el-checkbox>
        </el-checkbox-group>
      </el-form-item>

      <el-form-item v-if="isEdit" label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :label="1">启用</el-radio>
          <el-radio :label="0">禁用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <div style="text-align: right;">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ isEdit ? '保存' : '创建' }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { oauthApi, type OAuthClient, type CreateClientDto, type UpdateClientDto } from '@/api/oauth'

interface Props {
  visible: boolean
  client: OAuthClient | null
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

const formData = ref<CreateClientDto & { status?: number }>({
  name: '',
  redirectUris: [''],
  scopes: [],
  grants: ['authorization_code', 'refresh_token'],
  status: 1,
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入客户端名称', trigger: 'blur' },
  ],
  redirectUris: [
    { required: true, message: '请至少添加一个回调地址', trigger: 'change' },
  ],
  scopes: [
    { required: true, message: '请选择权限范围', trigger: 'change' },
  ],
  grants: [
    { required: true, message: '请选择授权类型', trigger: 'change' },
  ],
}

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
        ElMessage.success('客户端更新成功')
      } else {
        const createData: CreateClientDto = {
          name: formData.value.name,
          redirectUris: formData.value.redirectUris,
          scopes: formData.value.scopes,
          grants: formData.value.grants,
        }
        const response = await oauthApi.createClient(createData)
        
        await ElMessageBox.alert(
          `客户端ID：${response.data.data.clientId}\n客户端密钥：${response.data.data.clientSecret}`,
          '创建成功，请妥善保管密钥',
          {
            confirmButtonText: '确定',
            type: 'success',
          }
        )
      }
      
      emits('success')
      handleClose()
    } catch (error: any) {
      ElMessage.error(error.response?.data?.message || '操作失败')
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
