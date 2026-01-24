<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const settingsSchema = z.object({
  foo: z.string().min(2, 'Too short')
})

type SettingsSchema = z.output<typeof settingsSchema>

const profile = reactive<Partial<SettingsSchema>>({
  foo: 'Bar'
})
const toast = useToast()
async function onSubmit(event: FormSubmitEvent<SettingsSchema>) {
  toast.add({
    title: 'Success',
    description: 'Your settings have been updated.',
    icon: 'i-lucide-check',
    color: 'success'
  })

  // Save settings
  console.log('Submitted settings:', event.data)
}
</script>

<template>
  <UForm
    id="settings"
    :schema="settingsSchema"
    :state="profile"
    @submit="onSubmit"
  >
    <UPageCard variant="subtle">
      <UFormField
        name="foo"
        label="Foo"
        description="Foo description."
        required
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.foo"
          autocomplete="off"
        />
      </UFormField>
      <USeparator />
    </UPageCard>
  </UForm>
</template>
