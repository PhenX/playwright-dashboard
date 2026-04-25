<script setup lang="ts">
import { z } from 'zod'
import type { TableColumn } from '@nuxt/ui'
import type { TagInfo, TagsResponse } from '~~/types/api'

const { data: tagsData, refresh } = await useFetch<TagsResponse>('/api/tags')
const toast = useToast()
const { authState } = useAuth()
const config = useRuntimeConfig()

const allTags = computed(() => tagsData.value?.tags || [])

const isAdmin = computed(() => {
  if (!config.public.authEnabled) return true
  return authState.value.user?.role === 'administrator'
})

const TAG_COLORS = [
  { label: 'Neutral', value: 'neutral' },
  { label: 'Red', value: 'red' },
  { label: 'Orange', value: 'orange' },
  { label: 'Amber', value: 'amber' },
  { label: 'Yellow', value: 'yellow' },
  { label: 'Lime', value: 'lime' },
  { label: 'Green', value: 'green' },
  { label: 'Emerald', value: 'emerald' },
  { label: 'Teal', value: 'teal' },
  { label: 'Cyan', value: 'cyan' },
  { label: 'Sky', value: 'sky' },
  { label: 'Blue', value: 'blue' },
  { label: 'Indigo', value: 'indigo' },
  { label: 'Violet', value: 'violet' },
  { label: 'Purple', value: 'purple' },
  { label: 'Fuchsia', value: 'fuchsia' },
  { label: 'Pink', value: 'pink' },
  { label: 'Rose', value: 'rose' },
  { label: 'Primary', value: 'primary' },
  { label: 'Info', value: 'info' },
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' }
]

const columns: TableColumn<TagInfo>[] = [
  { accessorKey: 'text', header: 'Tag' },
  { accessorKey: 'color', header: 'Color' },
  { accessorKey: 'createdAt', header: 'Created' },
  { accessorKey: 'actions', header: '' }
]

// Add tag modal
const isAddTagModalOpen = ref(false)
const addTagSchema = z.object({
  text: z.string().min(1, 'Tag text is required').max(50, 'Tag text must be at most 50 characters'),
  color: z.string().min(1, 'Color is required')
})
type AddTagSchema = z.output<typeof addTagSchema>

const newTag = reactive<Partial<AddTagSchema>>({
  text: '',
  color: 'neutral'
})

// Edit tag modal
const isEditTagModalOpen = ref(false)
const editingTag = ref<TagInfo | null>(null)
const editTagState = reactive<Partial<AddTagSchema>>({
  text: '',
  color: 'neutral'
})

function openEditTag(tag: TagInfo) {
  editingTag.value = tag
  editTagState.text = tag.text
  editTagState.color = tag.color
  isEditTagModalOpen.value = true
}

async function handleAddTag() {
  try {
    await $fetch('/api/tags', {
      method: 'POST',
      body: newTag
    })

    toast.add({
      title: 'Tag created',
      description: `Tag "${newTag.text}" has been created successfully`,
      color: 'success'
    })

    isAddTagModalOpen.value = false
    newTag.text = ''
    newTag.color = 'neutral'

    await refresh()
  } catch (error: unknown) {
    const errorMessage = error && typeof error === 'object' && 'data' in error
      ? (error.data as { message?: string })?.message
      : undefined
    toast.add({
      title: 'Failed to create tag',
      description: errorMessage || 'An error occurred',
      color: 'error'
    })
  }
}

async function handleEditTag() {
  if (!editingTag.value) return
  try {
    await $fetch(`/api/tags/${editingTag.value.id}`, {
      method: 'PUT',
      body: {
        text: editTagState.text,
        color: editTagState.color
      }
    })

    toast.add({
      title: 'Tag updated',
      description: `Tag has been updated successfully`,
      color: 'success'
    })

    isEditTagModalOpen.value = false
    editingTag.value = null

    await refresh()
  } catch (error: unknown) {
    const errorMessage = error && typeof error === 'object' && 'data' in error
      ? (error.data as { message?: string })?.message
      : undefined
    toast.add({
      title: 'Failed to update tag',
      description: errorMessage || 'An error occurred',
      color: 'error'
    })
  }
}

async function handleDeleteTag(tag: TagInfo) {
  if (!confirm(`Are you sure you want to delete tag "${tag.text}"? It will be removed from all projects.`)) {
    return
  }

  try {
    await $fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })

    toast.add({
      title: 'Tag deleted',
      description: `Tag "${tag.text}" has been deleted`,
      color: 'success'
    })

    await refresh()
  } catch (error: unknown) {
    const errorMessage = error && typeof error === 'object' && 'data' in error
      ? (error.data as { message?: string })?.message
      : undefined
    toast.add({
      title: 'Failed to delete tag',
      description: errorMessage || 'An error occurred',
      color: 'error'
    })
  }
}
</script>

<template>
  <UDashboardPanel grow>
    <template #header>
      <UDashboardNavbar title="Tag Management">
        <template #right>
          <UButton
            v-if="isAdmin"
            label="Add Tag"
            icon="i-lucide-tag"
            @click="isAddTagModalOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Tags table -->
      <UCard v-if="allTags.length > 0">
        <template #header>
          Tags ({{ allTags.length }})
        </template>

        <UTable
          :data="allTags"
          :columns="columns"
        >
          <template #text-cell="{ row }">
            <UBadge :color="(row.original.color as any)" variant="subtle">
              {{ row.original.text }}
            </UBadge>
          </template>

          <template #color-cell="{ row }">
            <UBadge :color="(row.original.color as any)" variant="solid" class="capitalize">
              {{ row.original.color }}
            </UBadge>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm text-muted">
              {{ new Date(row.original.createdAt).toLocaleDateString() }}
            </span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex gap-1 justify-end">
              <UButton
                v-if="isAdmin"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="openEditTag(row.original)"
              />
              <UButton
                v-if="isAdmin"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                @click="handleDeleteTag(row.original)"
              />
            </div>
          </template>
        </UTable>
      </UCard>

      <!-- Empty state -->
      <UCard v-else>
        <div class="text-center py-12">
          <div class="flex justify-center mb-4">
            <UIcon name="i-lucide-tags" class="text-4xl text-muted" />
          </div>
          <h3 class="text-lg font-semibold mb-2">
            No tags yet
          </h3>
          <p class="text-muted mb-4">
            Create tags to categorize and filter your projects
          </p>
          <UButton
            v-if="isAdmin"
            label="Add Tag"
            icon="i-lucide-tag"
            @click="isAddTagModalOpen = true"
          />
        </div>
      </UCard>
    </template>
  </UDashboardPanel>

  <!-- Add Tag Modal -->
  <ClientOnly>
    <UModal :open="isAddTagModalOpen" title="Add New Tag" @update:open="isAddTagModalOpen = $event">
      <template #body>
        <UForm :schema="addTagSchema" :state="newTag">
          <UFormField
            label="Tag Text"
            name="text"
            required
            class="mb-4"
          >
            <UInput v-model="newTag.text" placeholder="Enter tag name" />
          </UFormField>

          <UFormField
            label="Color"
            name="color"
            required
            class="mb-4"
          >
            <USelect v-model="newTag.color" :items="TAG_COLORS" />
          </UFormField>

          <div v-if="newTag.text" class="mt-2">
            <span class="text-sm text-muted mr-2">Preview:</span>
            <UBadge :color="(newTag.color as any)" variant="subtle">
              {{ newTag.text }}
            </UBadge>
          </div>
        </UForm>
      </template>

      <template #footer>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          label="Cancel"
          @click="isAddTagModalOpen = false"
        />
        <UButton
          type="submit"
          label="Create Tag"
          icon="i-lucide-tag"
          @click="handleAddTag"
        />
      </template>
    </UModal>

    <!-- Edit Tag Modal -->
    <UModal :open="isEditTagModalOpen" title="Edit Tag" @update:open="isEditTagModalOpen = $event">
      <template #body>
        <UForm :schema="addTagSchema" :state="editTagState">
          <UFormField
            label="Tag Text"
            name="text"
            required
            class="mb-4"
          >
            <UInput v-model="editTagState.text" placeholder="Enter tag name" />
          </UFormField>

          <UFormField
            label="Color"
            name="color"
            required
            class="mb-4"
          >
            <USelect v-model="editTagState.color" :items="TAG_COLORS" />
          </UFormField>

          <div v-if="editTagState.text" class="mt-2">
            <span class="text-sm text-muted mr-2">Preview:</span>
            <UBadge :color="(editTagState.color as any)" variant="subtle">
              {{ editTagState.text }}
            </UBadge>
          </div>
        </UForm>
      </template>

      <template #footer>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          label="Cancel"
          @click="isEditTagModalOpen = false"
        />
        <UButton
          type="submit"
          label="Save Changes"
          icon="i-lucide-check"
          @click="handleEditTag"
        />
      </template>
    </UModal>
  </ClientOnly>
</template>
