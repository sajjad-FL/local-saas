// ponytail: throwaway mobile-screenshot script, delete when done
import puppeteer from 'puppeteer-core';

const token = (await (await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '9999999999', password: 'test1234' }),
})).json()).token;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluateOnNewDocument((t) => localStorage.setItem('token', t), token);

const shots = [
  ['/', 'light', 'dash-light'],
  ['/', 'dark', 'dash-dark'],
  ['/members', 'light', 'members-light'],
  ['/members', 'dark', 'members-dark'],
];
for (const [path, theme, name] of shots) {
  await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), theme);
  await page.goto(`http://localhost:5174${path}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200)); // let animations settle
  await page.screenshot({ path: `shots-${name}.png`, fullPage: true });
  console.log('saved', name);
}
await browser.close();
