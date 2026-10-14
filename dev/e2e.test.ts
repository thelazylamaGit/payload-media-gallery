import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

// this is an example Playwright e2e test
test('should navigate to media collection', async ({ page }) => {
  await page.goto('/admin')

  // login
  await page.fill('#field-email', 'dev@payloadcms.com')
  await page.fill('#field-password', 'test')
  await page.click('.form-submit button')

  // should show dashboard
  await expect(page).toHaveTitle(/Dashboard/)

  // Navigate to media
  // Navigate to media via URL for reliability
  await page.goto('/admin/collections/media?limit=25')
  await expect(page).toHaveURL(/\/collections\/media/)

  // Check for gallery toggle button (plugin specific)
  // We use the custom class added in MediaListView.tsx. There are three buttons (List/Grid/Justified).
  const toggleButtons = page.locator('button.media-gallery-toggle')
  await expect(toggleButtons.first()).toBeVisible()
  await expect(toggleButtons).toHaveCount(4)
  await expect(page.locator('.media-card--title-visible')).toHaveCount(0)
  await expect(page.locator('.media-card__label', { hasText: /^Image$/ })).toHaveCount(0)
  await expect(page.locator('.media-card__label', { hasText: /^Video$/ })).toHaveCount(1)
  await expect(page.locator('.media-card__label', { hasText: /^Audio$/ })).toHaveCount(1)
})

test('ordinary collection cards retain source identity and show configured fields', async ({
  page,
}) => {
  await page.goto('/admin/login')
  await page.fill('#field-email', 'dev@payloadcms.com')
  await page.fill('#field-password', 'test')
  await page.click('.form-submit button')
  await expect(page).toHaveTitle(/Dashboard/)
  await page.goto('/admin/collections/practitioners')

  const jane = page.getByRole('gridcell', { name: 'Dr Jane', exact: true })
  await expect(jane).toBeVisible()
  for (const layout of ['Justified', 'Grid', 'Masonry']) {
    await page.getByRole('button', { name: `Switch to ${layout} view` }).click()
    await page.mouse.move(0, 0)
    await expect(jane.locator('.media-card__footer')).toHaveCSS('opacity', '1')
    await expect(jane.locator('.media-card__filename')).toHaveCSS(
      'text-decoration-color',
      'rgba(0, 0, 0, 0)',
    )
    await expect(jane.locator('.media-gallery-grid__controls')).toHaveCSS('visibility', 'hidden')
    await jane.hover()
    await expect(jane.locator('.media-card__filename')).not.toHaveCSS(
      'text-decoration-color',
      'rgba(0, 0, 0, 0)',
    )
    await expect(jane.locator('.media-gallery-grid__controls')).toHaveCSS('visibility', 'visible')
  }
  await expect(jane.locator('.media-card__label')).toHaveText('Dentistry')
  await expect(jane.locator('img')).toHaveAttribute('alt', /Seed Image/)
  const sourceHref = await jane.locator('a').getAttribute('href')
  expect(sourceHref).toMatch(/\/admin\/collections\/practitioners\//)
  const placeholder = page.getByRole('gridcell', { name: 'Dr Placeholder', exact: true })
  await expect(placeholder.locator('.icon--document')).toBeVisible()
  await expect(placeholder.locator('.media-gallery-grid__expand-btn')).toHaveCount(0)

  const search = page.getByRole('textbox', { name: 'Search by Name' })
  await search.fill('Jane')
  await expect(placeholder).toHaveCount(0)
  await search.fill('')
  await expect(placeholder).toBeVisible()

  await jane.hover()
  await jane.locator('.media-gallery-grid__expand-btn').click()
  await expect(page.locator('.media-gallery-lightbox__filename')).toHaveText('Dr Jane')
  await expect(page.locator('.media-gallery-lightbox__image-wrapper img')).toHaveAttribute(
    'alt',
    /Seed Image/,
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Media Lightbox' })).toHaveCount(0)

  await page.goto(
    `/admin/collections/practitioners?columns=${encodeURIComponent(JSON.stringify(['name', 'portrait', 'specialty']))}`,
  )
  await page.getByRole('button', { name: 'Switch to List view' }).click()
  const row = page.getByRole('row').filter({ hasText: 'Dr Jane' })
  await expect(row.locator('.relationship-cell .file__filename')).toHaveText(/seed-image/)
  await expect(row).not.toContainText('No Portrait')
  await page.getByRole('button', { name: 'Switch to Justified view' }).click()
  await jane.hover()
  await jane.locator('.media-gallery-grid__edit-btn').click()
  await expect(page.locator('input[name="name"]')).toHaveValue('Dr Jane')
})

test('long subtitles truncate without squeezing the title off a narrow card', async ({ page }) => {
  await page.request.post('/api/users/login', {
    data: { email: 'dev@payloadcms.com', password: 'test' },
  })
  const mediaResponse = await page.request.get('/api/media', {
    params: { 'where[mimeType][contains]': 'image/', limit: '1' },
  })
  const media = await mediaResponse.json()
  const subtitle =
    'Clinical Nutritionist and Integrative Health Practitioner with a very long specialty label'
  const response = await page.request.post('/api/practitioners', {
    data: { name: 'Dr Long Subtitle', specialty: subtitle, portrait: media.docs[0].id },
  })
  expect(response.ok()).toBeTruthy()
  const { doc } = await response.json()
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin/collections/practitioners?search=Long%20Subtitle')
    const card = page.getByRole('gridcell', { name: 'Dr Long Subtitle', exact: true })
    await expect(card).toBeVisible()
    await card.hover()
    const measurements = await card.locator('.media-card__footer').evaluate((footer) => {
      const title = footer.querySelector<HTMLElement>('.media-card__filename')!
      const label = footer.querySelector<HTMLElement>('.media-card__label')!
      return {
        width: footer.clientWidth,
        titleWidth: title.clientWidth,
        labelWidth: label.clientWidth,
        labelScrollWidth: label.scrollWidth,
      }
    })
    expect(measurements.titleWidth).toBeGreaterThan(measurements.width * 0.35)
    expect(measurements.labelWidth).toBeLessThanOrEqual(measurements.width * 0.45)
    expect(measurements.labelScrollWidth).toBeGreaterThan(measurements.labelWidth)
    await expect(card.locator('.media-card__label')).toHaveAttribute('title', subtitle)
  } finally {
    await page.request.delete(`/api/practitioners/${doc.id}`)
  }
})
