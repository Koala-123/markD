<template>
  <div class="format-toolbar">
    <button
      v-for="item in paragraphButtons"
      :key="item.type"
      class="toolbar-btn"
      :title="item.title"
      @click="emitParagraph(item.type)"
    >
      {{ item.label }}
    </button>
    <span class="divider" />
    <button
      v-for="item in formatButtons"
      :key="item.type"
      class="toolbar-btn"
      :title="item.title"
      @click="emitFormat(item.type)"
    >
      {{ item.label }}
    </button>
    <span class="divider" />
    <button
      class="toolbar-btn"
      :title="t('editor.toolbar.table')"
      @click="emitParagraph('table')"
    >
      ▦
    </button>
    <button
      class="toolbar-btn"
      :title="t('editor.toolbar.horizontalRule')"
      @click="emitParagraph('hr')"
    >
      ―
    </button>
    <span class="divider" />
    <button
      class="toolbar-btn"
      :title="t('editor.toolbar.print')"
      @click="bus.emit('showExportDialog', 'print')"
    >
      🖶
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import bus from '@/bus'

// Every button below just re-emits the same `bus` events the application
// menu already sends for these actions (see main/menu/actions/paragraph.ts
// and format.ts) — `editor.vue`'s existing `bus.on('paragraph'|'format', ...)`
// handlers do the rest, so this toolbar owns no formatting logic itself.
const { t } = useI18n()

const paragraphButtons = computed(() => [
  { type: 'heading 1', label: 'H1', title: t('editor.toolbar.heading1') },
  { type: 'heading 2', label: 'H2', title: t('editor.toolbar.heading2') },
  { type: 'heading 3', label: 'H3', title: t('editor.toolbar.heading3') },
  { type: 'blockquote', label: '❝', title: t('editor.toolbar.quote') },
  { type: 'ul-bullet', label: '•', title: t('editor.toolbar.bulletList') },
  { type: 'ol-order', label: '1.', title: t('editor.toolbar.orderedList') },
  { type: 'ul-task', label: '☑', title: t('editor.toolbar.taskList') },
  { type: 'pre', label: '{ }', title: t('editor.toolbar.codeBlock') }
])

const formatButtons = computed(() => [
  { type: 'strong', label: 'B', title: t('editor.toolbar.bold') },
  { type: 'em', label: 'I', title: t('editor.toolbar.italic') },
  { type: 'del', label: 'S', title: t('editor.toolbar.strikethrough') },
  { type: 'inline_code', label: '<>', title: t('editor.toolbar.inlineCode') },
  { type: 'link', label: '🔗', title: t('editor.toolbar.link') },
  { type: 'image', label: '🖼', title: t('editor.toolbar.image') }
])

const emitParagraph = (type: string): void => bus.emit('paragraph', type)
const emitFormat = (type: string): void => bus.emit('format', type)
</script>

<style scoped>
.format-toolbar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 2px;
  padding: 4px 8px;
  background: var(--editorBgColor);
  border-bottom: 1px solid var(--floatBorderColor, transparent);
  -webkit-app-region: no-drag;
}
.toolbar-btn {
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor50);
  font-size: 13px;
  line-height: 26px;
  cursor: pointer;
}
.toolbar-btn:hover {
  background: var(--floatBgColor);
  color: var(--themeColor);
}
.divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--editorColor30);
}
</style>
