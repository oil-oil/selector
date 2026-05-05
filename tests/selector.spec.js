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

// ── Selection ─────────────────────────────────────────────
test.describe('Selection', () => {
  test('click selects element — overlay and tag appear', async ({ page }) => {
    await activate(page);
    await page.locator('#intro-para').click();

    await expect(page.locator('.ai-editor-sel-box')).toBeVisible();
    await expect(page.locator('.ai-editor-chat-tags .ai-editor-tag')).toHaveCount(1);
  });

  test('clicking a different element replaces selection', async ({ page }) => {
    await activate(page);
    await page.locator('#intro-para').click();
    await page.locator('#action-btn').click();

    await expect(page.locator('.ai-editor-tag')).toHaveCount(1);
    await expect(page.locator('.ai-editor-tag-label')).toContainText('action-btn');
  });

  test('shift+click adds to selection', async ({ page }) => {
    await activate(page);
    await page.locator('#intro-para').click();
    await page.locator('#action-btn').click({ modifiers: ['Shift'] });

    await expect(page.locator('.ai-editor-tag')).toHaveCount(2);
    await expect(page.locator('.ai-editor-sel-box')).toHaveCount(2);
  });
});

// ── Clear / deselect ──────────────────────────────────────
test.describe('Clear', () => {
  test('Escape clears all selected elements', async ({ page }) => {
    await activate(page);
    await page.locator('#intro-para').click();
    await page.locator('#action-btn').click({ modifiers: ['Shift'] });

    await page.keyboard.press('Escape');

    await expect(page.locator('.ai-editor-tag')).toHaveCount(0);
    await expect(page.locator('.ai-editor-sel-box')).toHaveCount(0);
  });

  test('tag X button removes only that element', async ({ page }) => {
    await activate(page);
    await page.locator('#intro-para').click();
    await page.locator('#action-btn').click({ modifiers: ['Shift'] });

    await page.locator('.ai-editor-tag-x').first().click({ force: true });

    await expect(page.locator('.ai-editor-tag')).toHaveCount(1);
    await expect(page.locator('.ai-editor-sel-box')).toHaveCount(1);
  });
});
