const { test, expect } = require('@playwright/test');
const { injectSelector } = require('./helpers/inject');
const path = require('path');
const fs   = require('fs');

const FIXTURE_HTML = fs.readFileSync(
  path.join(__dirname, 'fixtures/page.html'),
  'utf8'
);

test.beforeEach(async ({ page }) => {
  await page.setContent(FIXTURE_HTML);
  await injectSelector(page);
});

// ── Helpers ──────────────────────────────────────────────
const launcher = (page) => page.locator('.ai-editor-launcher');
const activate  = (page) => launcher(page).click();

// ── Launcher ─────────────────────────────────────────────
test.describe('Launcher', () => {
  test('is visible after injection', async ({ page }) => {
    await expect(launcher(page)).toBeVisible();
  });

  test('activates on first click', async ({ page }) => {
    await activate(page);
    await expect(launcher(page)).toHaveClass(/ai-editor-launcher-active/);
  });

  test('deactivates on second click', async ({ page }) => {
    await activate(page);
    await launcher(page).click();
    await expect(launcher(page)).not.toHaveClass(/ai-editor-launcher-active/);
  });
});
