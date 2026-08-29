import { test, expect } from '@playwright/test';

test.describe('QA Login and Setup Flow', () => {
  test('Admin First Login and Password Change', async ({ page }) => {
    await page.goto('http://localhost:8080/');
    
    // Login with admin-placeholder
    await page.fill('#userId', process.env.QA_ADMIN_USER || 'admin-placeholder');
    await page.keyboard.press('Tab');
    await page.keyboard.type(process.env.QA_PASSWORD || '000000');
    // For the login, it will auto-submit when 6 digits are typed.
    
    // Wait for the password setup prompt to appear
    try {
      await page.waitForSelector('text=Update Your PIN', { timeout: 8000 });
      // The first OTP input is focused automatically? Let's be safe.
      await page.keyboard.press('Tab'); // focus might be lost
      // Actually, we can click the first OTP slot
      await page.locator('.size-11').first().click();
      await page.keyboard.type(process.env.QA_NEW_PASSWORD || '111111');
      
      // Second OTP input (confirm)
      await page.locator('.size-11').nth(6).click();
      await page.keyboard.type(process.env.QA_NEW_PASSWORD || '111111');
      
      // Auto submits on 6th digit, or we click button
      // await page.getByRole('button', { name: /Secure My Account/i }).click();
    } catch (e) {
      console.log('Password might already be changed or no prompt appeared.');
    }
    
    // Ensure we are logged in by waiting for some dashboard element
    await page.waitForSelector('text=Dashboard', { timeout: 15000 });
    
    // Logout
    await page.click('text=admin-placeholder');
    await page.getByRole('menuitem', { name: /Sign out/i }).click();
    
    // Login Again with 112233
    await page.waitForSelector('#userId', { timeout: 10000 });
    await page.fill('#userId', process.env.QA_ADMIN_USER || 'admin-placeholder');
    await page.keyboard.press('Tab');
    await page.keyboard.type(process.env.QA_NEW_PASSWORD || '111111');
    
    await page.waitForSelector('text=Dashboard', { timeout: 15000 });
    console.log('Admin login verified.');
  });
});


