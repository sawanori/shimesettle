import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const FOLDER_PATH = '/Users/noritakasawada/Downloads/receipt/2';
const FOLDER_NUMBER = '2';
const BASE_URL = 'http://localhost:3000';
const EMAIL = 'snp.inc.info@gmail.com';
const PASSWORD = 'noritaka8';

async function main() {
  // Get all jpg files in the folder
  const files = fs.readdirSync(FOLDER_PATH)
    .filter(f => f.endsWith('.jpg') && !f.startsWith('.'))
    .sort();

  console.log(`Found ${files.length} images in folder ${FOLDER_NUMBER}`);
  console.log('Files:', files);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect after login
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  console.log('Login successful!');

  // Navigate to expenses page
  await page.goto(`${BASE_URL}/expenses`);
  await page.waitForLoadState('networkidle');
  console.log('Navigated to expenses page');

  // Process each image
  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const filePath = path.join(FOLDER_PATH, fileName);

    console.log(`\n[${i + 1}/${files.length}] Processing: ${fileName}`);

    try {
      // Make sure we're on the expenses page
      if (!page.url().includes('/expenses')) {
        await page.goto(`${BASE_URL}/expenses`);
        await page.waitForLoadState('networkidle');
      }

      // Find the file input and upload
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(filePath);
      console.log('  File uploaded, waiting for AI analysis...');

      // Wait for AI analysis to complete (look for form to be populated or error)
      // The AI analysis can take 10-30 seconds
      await page.waitForTimeout(3000); // Initial wait

      // Wait for either success (amount field populated) or loading to finish
      let analysisComplete = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max wait

      while (!analysisComplete && attempts < maxAttempts) {
        await page.waitForTimeout(1000);
        attempts++;

        // Check if loading indicator is gone and form is ready
        const loadingVisible = await page.locator('text=解析中').isVisible().catch(() => false);
        const amountValue = await page.locator('input[name="amount"]').inputValue().catch(() => '');

        if (!loadingVisible && (amountValue !== '' || attempts > 30)) {
          analysisComplete = true;
        }

        if (attempts % 10 === 0) {
          console.log(`  Still waiting... (${attempts}s)`);
        }
      }

      console.log('  AI analysis complete');

      // Fill in folder number
      const folderNumberInput = page.locator('input[name="folder_number"]');
      if (await folderNumberInput.isVisible()) {
        await folderNumberInput.fill(FOLDER_NUMBER);
        console.log(`  Folder number set to: ${FOLDER_NUMBER}`);
      }

      // Click register button
      const registerButton = page.locator('button:has-text("登録")').first();
      await registerButton.click();
      console.log('  Clicked register button');

      // Wait for registration to complete
      await page.waitForTimeout(2000);

      // Check for success message or form reset
      const successVisible = await page.locator('text=登録しました').isVisible().catch(() => false);
      if (successVisible) {
        console.log('  Registration successful!');
      } else {
        console.log('  Registration submitted (no explicit success message)');
      }

      // Wait a bit before next upload
      await page.waitForTimeout(1000);

    } catch (error) {
      console.error(`  Error processing ${fileName}:`, error);
      console.log('  Continuing to next file...');

      // Try to reset the form or navigate back
      await page.goto(`${BASE_URL}/expenses`);
      await page.waitForLoadState('networkidle');
    }
  }

  console.log('\n=== All files processed! ===');

  // Keep browser open for review
  console.log('Browser will remain open for review. Press Ctrl+C to close.');
  await page.waitForTimeout(60000 * 5); // Keep open for 5 minutes

  await browser.close();
}

main().catch(console.error);
