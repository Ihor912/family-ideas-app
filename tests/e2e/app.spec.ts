import { expect, test } from '@playwright/test';

test('starts muted, draws once per click, and reveals readable content', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Яка пригода');
  const sound = page.getByRole('button', { name: /Звук: вимкнено/ });
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('10 з 10 ідей ще чекають на вас')).toBeVisible();
  await page.getByRole('button', { name: 'Знайти пригоду', exact: true }).click();
  await expect(page.getByRole('article')).toBeVisible();
  await expect(page.getByText('9 з 10 ідей ще чекають на вас')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeEnabled();
  await expect(page.getByRole('article')).toContainText('Головне — зробити це разом.');
});

test('categories share history and an exhausted category resets explicitly', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Куди хочеться?', { exact: true }).click();
  await page.getByRole('radio', { name: /Творча планета/ }).check();
  await expect(page.getByText('2 з 2 ідей ще чекають на вас')).toBeVisible();
  await page.getByRole('button', { name: 'Знайти пригоду', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeEnabled();
  const first = await page.getByRole('article').innerText();
  await page.getByRole('button', { name: 'Ще одну пригоду!' }).click();
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeEnabled();
  await expect(page.getByRole('article')).not.toHaveText(first);
  await expect(page.getByText('0 з 2 ідей ще чекають на вас')).toBeVisible();
  await page.getByRole('button', { name: 'Ще одну пригоду!' }).click();
  await expect(page.getByRole('button', { name: 'Почати нове коло' })).toBeVisible();
  await page.getByRole('button', { name: 'Почати нове коло' }).click();
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeEnabled();
  await expect(page.getByText('1 з 2 ідей ще чекають на вас')).toBeVisible();
  await page.getByText('Куди хочеться?', { exact: true }).click();
  await page.getByRole('radio', { name: /Усі пригоди/ }).check();
  await expect(page.getByText('9 з 10 ідей ще чекають на вас')).toBeVisible();
});

test('sound preference persists and can be muted again', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Звук: вимкнено/ }).click();
  await expect(page.getByRole('button', { name: /Звук: увімкнено/ })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: /Звук: увімкнено/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Звук: увімкнено/ }).click();
  await expect(page.getByRole('button', { name: /Звук: вимкнено/ })).toHaveAttribute('aria-pressed', 'false');
});

test('sign-in and sign-out gates private UI', async ({ page }) => {
  await page.goto('./?scenario=signed-out');
  await expect(page.getByRole('button', { name: 'Увійти з Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Знайти пригоду', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Увійти з Google' }).click();
  await page.getByRole('button', { name: 'Знайти пригоду', exact: true }).click();
  await expect(page.getByRole('article')).toBeVisible();
  await page.getByRole('button', { name: 'Вийти з облікового запису' }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Увійти з Google' })).toBeVisible();
});

test('unapproved accounts cannot see activities', async ({ page }) => {
  await page.goto('./?scenario=unapproved');
  await expect(page.getByText(/Попросіть власника додати/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Знайти пригоду', exact: true })).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('empty collections disable drawing', async ({ page }) => {
  await page.goto('./?scenario=empty');
  await expect(page.getByRole('button', { name: 'Знайти пригоду', exact: true })).toBeDisabled();
  await expect(page.getByText('У цьому напрямку поки немає ідей.')).toBeVisible();
});

test('a failed draw offers retry without consuming progress', async ({ page }) => {
  await page.goto('./?scenario=error');
  await page.getByRole('button', { name: 'Знайти пригоду', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Спробуйте ще раз');
  await expect(page.getByText('10 з 10 ідей ще чекають на вас')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Знайти пригоду', exact: true })).toBeEnabled();
});

test('keyboard and reduced-motion experience remain usable without horizontal overflow', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  // Mobile Safari does not include links in its default hardware-Tab sequence.
  if (isMobile) await page.getByRole('link', { name: 'До пригоди' }).focus();
  else await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'До пригоди' })).toBeFocused();
  await page.getByRole('button', { name: 'Знайти пригоду', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('article')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeEnabled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await expect(page.getByRole('status').filter({ hasText: 'Ваша пригода:' })).toBeAttached();
});
