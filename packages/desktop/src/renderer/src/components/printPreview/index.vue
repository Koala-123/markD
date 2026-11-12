<template>
  <div class="print-preview">
    <el-dialog
      v-model="visible"
      :modal="true"
      custom-class="ag-dialog-table"
      width="720px"
    >
      <h3>{{ t('editor.printPreview.title') }}</h3>
      <!-- Empty `sandbox` blocks scripts and same-origin access: the export HTML is
           DOMPurify-sanitized, this is the second layer if that is ever bypassed. -->
      <iframe
        class="preview-frame"
        sandbox=""
        :srcdoc="html"
      />
      <div class="button-controlls">
        <button
          class="button-primary"
          @click="handlePrintClicked"
        >
          {{ printLabel }}
        </button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import bus from '@/bus'

interface PreviewPayload {
  html: string
  options: Record<string, unknown>
}

const { t } = useI18n()
const visible = ref(false)
const html = ref('')
const options = ref<Record<string, unknown>>({})

const printLabel = computed(() =>
  options.value.type === 'pdf' ? t('exportSettings.export') : t('editor.printPreview.print')
)

const show = (payload: unknown): void => {
  const { html: content, options: opts } = payload as PreviewPayload
  html.value = content
  options.value = opts
  visible.value = true
}

const handlePrintClicked = (): void => {
  visible.value = false
  bus.emit('export', options.value)
}

onMounted(() => bus.on('preview-html', show))
onBeforeUnmount(() => bus.off('preview-html', show))
</script>

<style scoped>
.preview-frame {
  width: 100%;
  height: 55vh;
  margin-top: 10px;
  border: 1px solid var(--editorColor30);
  background: #fff;
}
:deep(.el-dialog__body) {
  max-height: 80vh;
  overflow-y: auto;
}
.button-controlls {
  margin-top: 8px;
  text-align: right;
}
.button-controlls .button-primary {
  font-size: 14px;
}
</style>
