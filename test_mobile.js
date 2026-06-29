const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  console.log('Navigating to mobile app...');
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 30000 });
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'mobile_dashboard.png' });
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body Text:', bodyText.substring(0, 500));
  
  await browser.close();
  console.log('Done.');
})();
