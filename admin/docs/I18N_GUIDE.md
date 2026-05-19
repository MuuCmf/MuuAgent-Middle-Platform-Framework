# 国际化使用指南

## 概述

本项目使用 `vue-i18n` 实现中英双语支持，支持动态切换语言。

## 文件结构

```
admin/src/locales/
├── index.ts          # i18n 配置文件
├── types.d.ts        # TypeScript 类型定义
├── zh-CN.ts          # 中文语言包
└── en-US.ts          # 英文语言包
```

## 使用方法

### 1. 在模板中使用

```vue
<template>
  <!-- 基础用法 -->
  <el-button>{{ $t('common.save') }}</el-button>
  
  <!-- 带参数的翻译 -->
  <p>{{ $t('validation.minLength', { min: 6 }) }}</p>
  
  <!-- 在组件属性中使用 -->
  <el-input :placeholder="$t('common.pleaseInput')" />
</template>
```

### 2. 在 Script 中使用

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

// 获取翻译文本
const saveText = t('common.save')

// 切换语言
const switchLanguage = () => {
  locale.value = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  localStorage.setItem('locale', locale.value)
}
</script>
```

### 3. 在 TypeScript 中使用

```typescript
import i18n from '@/locales'

// 获取翻译文本
const text = i18n.global.t('common.save')

// 切换语言
i18n.global.locale.value = 'en-US'
```

## 语言切换组件

使用 `LocaleSwitch` 组件切换语言：

```vue
<template>
  <LocaleSwitch />
</template>

<script setup lang="ts">
import LocaleSwitch from '@/components/LocaleSwitch.vue'
</script>
```

## 添加新的翻译

### 1. 在中文语言包中添加

```typescript
// admin/src/locales/zh-CN.ts
export default {
  // ... 其他翻译
  newModule: {
    title: '新模块标题',
    description: '新模块描述',
  },
}
```

### 2. 在英文语言包中添加

```typescript
// admin/src/locales/en-US.ts
export default {
  // ... 其他翻译
  newModule: {
    title: 'New Module Title',
    description: 'New Module Description',
  },
}
```

### 3. 使用新的翻译

```vue
<template>
  <h1>{{ $t('newModule.title') }}</h1>
  <p>{{ $t('newModule.description') }}</p>
</template>
```

## 最佳实践

### 1. 命名规范

- 使用模块化命名：`模块.功能.动作`
- 例如：`user.login.title`、`model.edit.success`

### 2. 组织结构

```typescript
export default {
  // 模块名
  module: {
    // 功能区域
    feature: {
      // 具体文本
      title: '标题',
      description: '描述',
      // 动作
      actions: {
        save: '保存',
        delete: '删除',
      },
    },
  },
}
```

### 3. 带参数的翻译

```typescript
// 语言包
export default {
  validation: {
    minLength: '最少需要 {min} 个字符',
    maxLength: '最多允许 {max} 个字符',
  },
}

// 使用
$t('validation.minLength', { min: 6 })
// 输出: 最少需要 6 个字符
```

### 4. 复数处理

```typescript
// 语言包
export default {
  items: '没有项目 | 1 个项目 | {count} 个项目',
}

// 使用
$t('items', 0)  // 输出: 没有项目
$t('items', 1)  // 输出: 1 个项目
$t('items', 5)  // 输出: 5 个项目
```

## Element Plus 国际化

Element Plus 组件会自动跟随应用语言切换，无需额外配置。

## 注意事项

1. **语言持久化**：语言设置会自动保存到 `localStorage`
2. **浏览器语言检测**：首次访问会自动检测浏览器语言
3. **默认语言**：如果未检测到语言，默认使用中文
4. **TypeScript 支持**：所有翻译键都有类型提示和检查

## 示例：完整页面

```vue
<template>
  <div class="user-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ $t('user.title') }}</span>
          <el-button type="primary" @click="handleAdd">
            {{ $t('common.add') }}
          </el-button>
        </div>
      </template>
      
      <el-form :model="form" :rules="rules" ref="formRef">
        <el-form-item :label="$t('user.username')" prop="username">
          <el-input 
            v-model="form.username"
            :placeholder="$t('common.pleaseInput')"
          />
        </el-form-item>
        
        <el-form-item :label="$t('user.password')" prop="password">
          <el-input 
            v-model="form.password"
            type="password"
            :placeholder="$t('common.pleaseInput')"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSubmit">
            {{ $t('common.submit') }}
          </el-button>
          <el-button @click="handleReset">
            {{ $t('common.reset') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

const { t } = useI18n()
const formRef = ref()

const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [
    { required: true, message: t('validation.required'), trigger: 'blur' },
    { min: 3, max: 20, message: t('validation.minLength', { min: 3 }), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('validation.required'), trigger: 'blur' },
    { min: 6, message: t('validation.minLength', { min: 6 }), trigger: 'blur' },
  ],
}

const handleAdd = () => {
  // 添加逻辑
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    // 提交逻辑
    ElMessage.success(t('message.saveSuccess'))
  } catch (error) {
    ElMessage.error(t('message.saveFailed'))
  }
}

const handleReset = () => {
  formRef.value.resetFields()
}
</script>

<style scoped lang="scss">
.user-management {
  padding: 20px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
```

## 相关资源

- [vue-i18n 官方文档](https://vue-i18n.intlify.dev/)
- [Element Plus 国际化](https://element-plus.org/zh-CN/guide/i18n.html)
