import { test, expect } from '@playwright/test'
import { waitForHydration } from './utils'

test.describe.serial('Project Creation API Tests', () => {
  test('should create a project via API', async ({ request }) => {
    const name = `api-created-project-${Date.now()}`
    const res = await request.post('/api/projects', {
      data: {
        name,
        label: 'My API Project',
        description: 'Created via API in tests'
      }
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.project).toBeDefined()
    expect(data.project.name).toBe(name)
    expect(data.project.label).toBe('My API Project')
    expect(data.project.description).toBe('Created via API in tests')
    expect(data.project.id).toBeDefined()
  })

  test('should reject missing project name', async ({ request }) => {
    const res = await request.post('/api/projects', {
      data: { label: 'No name project' }
    })
    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBe(400)
  })

  test('should reject empty project name', async ({ request }) => {
    const res = await request.post('/api/projects', {
      data: { name: '' }
    })
    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBe(400)
  })

  test('should reject duplicate project name', async ({ request }) => {
    const name = `duplicate-project-${Date.now()}`
    await request.post('/api/projects', { data: { name } })
    const res = await request.post('/api/projects', { data: { name } })
    expect(res.ok()).toBeFalsy()
    expect(res.status()).toBe(400)
  })

  test('should create a project with only name (optional fields omitted)', async ({ request }) => {
    const name = `minimal-project-${Date.now()}`
    const res = await request.post('/api/projects', { data: { name } })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.project.name).toBe(name)
    expect(data.project.label).toBeNull()
    expect(data.project.description).toBeNull()
  })

  test('new project should appear in projects list', async ({ request }) => {
    const name = `list-visible-project-${Date.now()}`
    await request.post('/api/projects', { data: { name, label: 'Listed Project' } })

    const listRes = await request.get('/api/projects')
    expect(listRes.ok()).toBeTruthy()
    const projects = await listRes.json()
    const found = projects.find((p: { name: string }) => p.name === name)
    expect(found).toBeDefined()
    expect(found.label).toBe('Listed Project')
    expect(found.totalRuns).toBe(0)
  })
})

test.describe('Project Creation UI Tests', () => {
  test('should show New Project button on projects page', async ({ page }) => {
    await page.goto('/projects')
    await waitForHydration(page)
    await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible()
  })

  test('should open New Project modal when clicking button', async ({ page }) => {
    await page.goto('/projects')
    await waitForHydration(page)

    await page.getByRole('button', { name: 'New Project' }).click()

    await expect(page.getByRole('heading', { name: 'Create New Project' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByLabel('Project Name')).toBeVisible()
    await expect(page.getByLabel('Display Label')).toBeVisible()
    await expect(page.getByLabel('Description')).toBeVisible()
  })

  test('should close modal when clicking Cancel', async ({ page }) => {
    await page.goto('/projects')
    await waitForHydration(page)

    await page.getByRole('button', { name: 'New Project' }).click()
    await expect(page.getByRole('heading', { name: 'Create New Project' })).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Create New Project' })).not.toBeVisible()
  })

  test('should create a new project from the UI', async ({ page }) => {
    const projectName = `ui-created-${Date.now()}`
    await page.goto('/projects')
    await waitForHydration(page)

    await page.getByRole('button', { name: 'New Project' }).click()
    await expect(page.getByRole('heading', { name: 'Create New Project' })).toBeVisible({ timeout: 10000 })

    await page.getByLabel('Project Name').fill(projectName)
    await page.getByLabel('Display Label').fill('My UI Project')

    await page.getByRole('button', { name: 'Create Project' }).click()

    // Should show success toast
    await expect(page.getByText('Project created', { exact: true })).toBeVisible({ timeout: 5000 })

    // Modal should close
    await expect(page.getByRole('heading', { name: 'Create New Project' })).not.toBeVisible()

    // New project should appear in the list
    await expect(page.getByRole('link', { name: 'My UI Project' })).toBeVisible({ timeout: 5000 })
  })

  test('should show error when creating project with duplicate name', async ({ page, request }) => {
    const projectName = `dup-ui-project-${Date.now()}`
    // Pre-create the project
    await request.post('/api/projects', { data: { name: projectName } })

    await page.goto('/projects')
    await waitForHydration(page)

    await page.getByRole('button', { name: 'New Project' }).click()
    await expect(page.getByRole('heading', { name: 'Create New Project' })).toBeVisible({ timeout: 10000 })

    await page.getByLabel('Project Name').fill(projectName)
    await page.getByRole('button', { name: 'Create Project' }).click()

    // Should show error toast
    await expect(page.getByText('Failed to create project', { exact: true })).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Tag Management UI Tests', () => {
  // Clean up any test tags before running
  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/tags')
    const data = await res.json()
    for (const tag of (data.tags || [])) {
      if (tag.text.startsWith('ui-test-tag-')) {
        await request.delete(`/api/tags/${tag.id}`)
      }
    }
  })

  test('should display Tags page', async ({ page }) => {
    await page.goto('/settings/tags')
    await waitForHydration(page)

    await expect(page.getByRole('heading', { name: 'Tag Management' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Tag' }).first()).toBeVisible()
  })

  test('should open Add Tag modal', async ({ page }) => {
    await page.goto('/settings/tags')
    await waitForHydration(page)

    await page.getByRole('button', { name: 'Add Tag' }).first().click()

    await expect(page.getByRole('heading', { name: 'Add new tag' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByLabel('Tag text')).toBeVisible()
    await expect(page.getByLabel('Pick tag color')).toBeVisible()
  })

  test('should close Add Tag modal when clicking Cancel', async ({ page }) => {
    await page.goto('/settings/tags')
    await waitForHydration(page)

    await page.getByRole('button', { name: 'Add Tag' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add new tag' })).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Add new tag' })).not.toBeVisible()
  })

  test('should create a new tag from the UI', async ({ page }) => {
    const tagName = `ui-test-tag-${Date.now()}`
    await page.goto('/settings/tags')
    await waitForHydration(page)

    await page.getByRole('button', { name: 'Add Tag' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add new tag' })).toBeVisible({ timeout: 10000 })

    await page.getByLabel('Tag text').fill(tagName)
    await page.getByRole('button', { name: 'Create Tag' }).click()

    // Success toast
    await expect(page.getByText('Tag created', { exact: true })).toBeVisible({ timeout: 5000 })

    // Tag should appear in the table
    await expect(page.getByText(tagName, { exact: true }).first()).toBeVisible({ timeout: 5000 })
  })

  test('should show color picker input in Add Tag modal', async ({ page }) => {
    await page.goto('/settings/tags')
    await waitForHydration(page)

    await page.getByRole('button', { name: 'Add Tag' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add new tag' })).toBeVisible({ timeout: 10000 })

    // Color picker input should be an input[type=color]
    const colorPicker = page.locator('input[type="color"]').first()
    await expect(colorPicker).toBeVisible()
  })

  test('should show tag preview when text is entered', async ({ page }) => {
    await page.goto('/settings/tags')
    await waitForHydration(page)

    await page.getByRole('button', { name: 'Add Tag' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add new tag' })).toBeVisible({ timeout: 10000 })

    await page.getByLabel('Tag text').fill('preview-test')
    await expect(page.getByText('Preview:')).toBeVisible()
    await expect(page.getByText('preview-test')).toBeVisible()
  })

  test('should delete a tag', async ({ page, request }) => {
    // Create a tag to delete
    const tagRes = await request.post('/api/tags', {
      data: { text: `ui-test-tag-del-${Date.now()}`, color: '#ef4444' }
    })
    const { tag } = await tagRes.json()

    await page.goto('/settings/tags')
    await waitForHydration(page)

    // Find the row for our tag and click delete
    page.on('dialog', dialog => dialog.accept())
    const row = page.locator('tr').filter({ hasText: tag.text })
    await row.getByRole('button').last().click()

    await expect(page.getByText('Tag deleted', { exact: true })).toBeVisible({ timeout: 5000 })
  })
})
