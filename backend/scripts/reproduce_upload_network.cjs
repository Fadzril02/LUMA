const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const networkLogs = [];

  page.on('request', req => {
    if (req.url().includes('courses') || req.url().includes('degree_templates')) {
      networkLogs.push({
        type: 'REQUEST',
        url: req.url(),
        method: req.method(),
        startTime: Date.now()
      });
    }
  });

  page.on('response', async res => {
    if (res.url().includes('courses') || res.url().includes('degree_templates')) {
      let text = '';
      try { text = await res.text(); } catch (e) { text = '<error reading text: ' + e.message + '>'; }
      const match = networkLogs.find(l => l.url === res.url() && l.type === 'REQUEST');
      const duration = match ? (Date.now() - match.startTime) : null;
      networkLogs.push({
        type: 'RESPONSE',
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
        durationMs: duration,
        body: text.slice(0, 1000)
      });
    }
  });

  page.on('requestfailed', req => {
    if (req.url().includes('courses') || req.url().includes('degree_templates')) {
      networkLogs.push({
        type: 'FAILED',
        url: req.url(),
        failure: req.failure()
      });
    }
  });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // Click Advisor role button
  console.log('Selecting Advisor role...');
  const advisorBtn = page.locator('button:has-text("Advisor")').first();
  await advisorBtn.click();
  await page.waitForTimeout(500);

  // Fill login
  console.log('Filling login credentials...');
  await page.fill('#loginEmail', 'testing@utm.com');
  await page.fill('#loginPassword', 'LumaTest2026');
  await page.click('button[type="submit"]');

  console.log('Waiting for Advisor dashboard...');
  await page.waitForSelector('text=Curriculum Management', { timeout: 15000 });
  console.log('On Advisor Dashboard!');

  // Find and click curriculum upload button
  const uploadBtn = page.locator('button:has-text("Upload Syllabus Matrix")').first();
  await uploadBtn.scrollIntoViewIfNeeded();
  await uploadBtn.click();
  console.log('Clicked Upload button, waiting for modal...');

  await page.waitForSelector('input[placeholder*="Software Engineering 2026"]', { timeout: 5000 });
  console.log('Upload modal open!');

  // Fill form
  await page.fill('input[placeholder*="Software Engineering 2026"]', 'Software Engineering 2026');
  await page.fill('input[placeholder*="SECJ"]', 'SECJ');
  await page.fill('input[placeholder*="130"]', '130');

  // Set file input
  const fileInput = page.locator('input[type="file"]#curriculum-upload-input');
  await fileInput.setInputFiles('d:\\smart-aa-system\\test_curriculum.csv');
  console.log('Attached test_curriculum.csv');

  // Submit
  const submitBtn = page.locator('button[type="submit"]:has-text("Confirm")');
  console.log('Clicking Confirm & Ingest...');
  const t0 = Date.now();
  
  // Wait for the specific response to complete
  const responsePromise = page.waitForResponse(
    res => res.url().includes('/api/v1/courses/upload-csv'),
    { timeout: 60000 }
  ).catch(e => ({ error: e.message }));

  await submitBtn.click();
  console.log('Clicked! Awaiting response...');

  const uploadRes = await responsePromise;
  const elapsed = Date.now() - t0;
  console.log(`=== UPLOAD RESPONSE RECEIVED IN ${elapsed}ms ===`);
  if (uploadRes && !uploadRes.error) {
    console.log('Status Code:', uploadRes.status());
    console.log('Status Text:', uploadRes.statusText());
    console.log('Headers:', uploadRes.headers());
    try {
      console.log('Response Body:', await uploadRes.text());
    } catch (e) {
      console.log('Could not read body:', e.message);
    }
  } else {
    console.log('Response Error / Timed out:', uploadRes?.error);
  }

  await page.waitForTimeout(4000);

  console.log('=== NETWORK LOGS (courses & degree_templates) ===');
  console.log(JSON.stringify(networkLogs, null, 2));

  // Check modal text
  const forms = await page.locator('form').all();
  for (let i = 0; i < forms.length; i++) {
    const text = await forms[i].innerText();
    if (text.includes('Curriculum') || text.includes('Degree Template')) {
      console.log('=== MODAL CONTENT AFTER SUBMIT ===');
      console.log(text);
    }
  }

  await page.screenshot({ path: 'scratch_reproduce_upload.png' });
  console.log('Screenshot saved to scratch_reproduce_upload.png');

  await browser.close();
})().catch(e => {
  console.error('ERROR IN TEST:', e);
  process.exit(1);
});
