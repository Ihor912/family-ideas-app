import { expect, test, type Page } from '@playwright/test';

const resetLabel = 'Скинути історію';
const confirmationTitle = 'Почати нове коло?';
const successMessage = 'Історію скинуто. Можна починати нове коло!';

async function draw(page: Page) {
  await page.getByRole('button', { name: /^(Знайти пригоду|Ще одну пригоду!)$/ }).click();
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeEnabled();
  await expect(page.getByRole('article')).toBeVisible();
}

async function chooseCategory(page: Page, name: string) {
  await page.getByText('Куди хочеться?', { exact: true }).click();
  await page.getByRole('radio', { name: new RegExp(name) }).check();
}

async function openConfirmation(page: Page) {
  await page.getByRole('button', { name: resetLabel, exact: true }).click();
  const confirmation = page.getByRole('group', { name: confirmationTitle, exact: true });
  await expect(confirmation).toBeVisible();
  return confirmation;
}

test('partly used all-ideas history resets once without drawing a new idea', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: resetLabel, exact: true })).toBeDisabled();
  await draw(page);
  await draw(page);
  await expect(page.getByText('8 з 10 ідей ще чекають на вас')).toBeVisible();

  const confirmation = await openConfirmation(page);
  await expect(confirmation).toContainText(/ус(і|іх)/i);
  await expect(confirmation).toContainText('для всієї родини');
  const resetStartedAt = new Date();
  await page.clock.install({ time: resetStartedAt });
  await page.clock.pauseAt(new Date(resetStartedAt.getTime() + 1_000));
  await confirmation.getByRole('button', { name: 'Так, скинути', exact: true }).dblclick();
  // The pending request dismisses confirmation and locks any overlapping action.
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByRole('button', { name: resetLabel, exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Скидаємо історію…', exact: true })).toBeDisabled();
  await expect(page.locator('summary').filter({ hasText: 'Куди хочеться?' })).toHaveAttribute('aria-disabled', 'true');

  await page.clock.runFor(300);
  await expect(page.getByRole('status').filter({ hasText: successMessage })).toBeVisible();
  await expect(page.getByText('10 з 10 ідей ще чекають на вас')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Знайти пригоду', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: resetLabel, exact: true })).toBeDisabled();
});

test('a category reset preserves ideas already drawn in another category', async ({ page }) => {
  await page.goto('./');
  await chooseCategory(page, 'Творча планета');
  await draw(page);
  await chooseCategory(page, 'Планета відкриттів');
  await expect(page.getByRole('button', { name: resetLabel, exact: true })).toBeDisabled();
  await draw(page);
  await expect(page.getByText('1 з 2 ідей ще чекають на вас')).toBeVisible();

  const confirmation = await openConfirmation(page);
  await expect(confirmation).toContainText('Планета відкриттів');
  await expect(confirmation).toContainText('для всієї родини');
  await confirmation.getByRole('button', { name: 'Так, скинути', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: successMessage })).toBeVisible();
  await expect(page.getByText('2 з 2 ідей ще чекають на вас')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: resetLabel, exact: true })).toBeDisabled();

  await chooseCategory(page, 'Творча планета');
  await expect(page.getByText('1 з 2 ідей ще чекають на вас')).toBeVisible();
  await expect(page.getByRole('button', { name: resetLabel, exact: true })).toBeEnabled();
  await chooseCategory(page, 'Усі пригоди');
  await expect(page.getByText('9 з 10 ідей ще чекають на вас')).toBeVisible();
});

test('cancel keeps the current idea and history and unlocks the picker', async ({ page }) => {
  await page.goto('./');
  await draw(page);
  const idea = await page.getByRole('article').innerText();
  const confirmation = await openConfirmation(page);
  await expect(page.getByRole('article')).toHaveText(idea, { useInnerText: true });
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeDisabled();
  const categoryTrigger = page.locator('summary').filter({ hasText: 'Куди хочеться?' });
  await expect(categoryTrigger).toHaveAttribute('aria-disabled', 'true');
  await categoryTrigger.click({ force: true });
  await expect(page.getByRole('radio', { name: /Творча планета/ })).not.toBeVisible();

  await confirmation.getByRole('button', { name: 'Залишити історію', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveText(idea, { useInnerText: true });
  await expect(page.getByText('9 з 10 ідей ще чекають на вас')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeEnabled();
  await expect(categoryTrigger).toHaveAttribute('aria-disabled', 'false');
  await expect(page.getByRole('status').filter({ hasText: successMessage })).toHaveCount(0);
});

test('a failed reset retains the result and history and can be retried', async ({ page }) => {
  await page.goto('./?scenario=reset-error');
  await draw(page);
  const idea = await page.getByRole('article').innerText();
  const confirmation = await openConfirmation(page);
  await confirmation.getByRole('button', { name: 'Так, скинути', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Спробуйте ще раз');
  await expect(page.getByRole('article')).toHaveText(idea, { useInnerText: true });
  await expect(page.getByText('9 з 10 ідей ще чекають на вас')).toBeVisible();
  await expect(page.getByRole('button', { name: resetLabel, exact: true })).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: successMessage })).toHaveCount(0);

  const retry = await openConfirmation(page);
  await retry.getByRole('button', { name: 'Так, скинути', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: successMessage })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText('10 з 10 ідей ще чекають на вас')).toBeVisible();
});

test('confirmation works with the keyboard and fits a reduced-motion mobile layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await draw(page);
  const reset = page.getByRole('button', { name: resetLabel, exact: true });
  await reset.focus();
  await page.keyboard.press('Enter');
  const confirmation = page.getByRole('group', { name: confirmationTitle, exact: true });
  await expect(confirmation).toBeVisible();
  const cancel = confirmation.getByRole('button', { name: 'Залишити історію', exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(confirmation).toHaveCount(0);
  await expect(reset).toBeFocused();

  await reset.focus();
  await page.keyboard.press('Enter');
  await expect(confirmation).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await confirmation.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await confirmation.getByRole('button', { name: 'Так, скинути', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: successMessage })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Знайти пригоду', exact: true })).toBeFocused();
});
