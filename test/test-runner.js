import { JSDOM } from 'jsdom';

// Set up jsdom environment with a URL to avoid opaque origin issues
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
global.window = dom.window;
global.document = window.document;
global.localStorage = window.localStorage;
global.MouseEvent = window.MouseEvent;

async function log(message){
  const pre = document.createElement('pre');
  pre.style.fontFamily = 'monospace';
  pre.style.fontSize = '12px';
  pre.textContent = message;
  // Ensure test-log div exists
  let testLogDiv = document.getElementById('test-log');
  if (!testLogDiv) {
    testLogDiv = document.createElement('div');
    testLogDiv.id = 'test-log';
    document.body.appendChild(testLogDiv);
  }
  testLogDiv.appendChild(pre);
  console.log(message);
}

(async function runTests(){
  // Setup minimal DOM required for i18n and theme tests
  document.body.innerHTML = `
    <button id="btnToggleTheme"></button>
    <button id="btnToggleLang"></button>
    <h3 data-i18n="personal_settings" id="settingsHeader">الإعدادات</h3>
  `;

  // Ensure env
  localStorage.setItem('bookflow_lang', 'ar');
  localStorage.setItem('bookflow_theme', 'light');

  // Import i18n (which will lazy-load theme-manager.js)
  const i18n = await import('../i18n.js');
  await i18n.initI18n();

  // Step 1: Arabic -> toggle dark
  const btnTheme = document.getElementById('btnToggleTheme');
  btnTheme.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  const darkApplied = document.documentElement.classList.contains('dark-theme');
  await log('DarkTheme after toggle (AR): ' + darkApplied);
  await log('Theme storage: ' + localStorage.getItem('bookflow_theme'));
  await log('Theme button label: ' + (btnTheme.textContent || btnTheme.innerHTML));

  // Step 2: Switch to English and test
  localStorage.setItem('bookflow_lang', 'en');
  i18n.translateUI();
  btnTheme.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  const labelEN = btnTheme.textContent || btnTheme.innerHTML;
  await log('English label after toggle: ' + labelEN);

  // Step 3: Check translation of personal_settings
  const settingsHeader = document.getElementById('settingsHeader');
  localStorage.setItem('bookflow_lang', 'en');
  i18n.translateUI();
  await log('Header after English translation: ' + (settingsHeader.textContent || settingsHeader.innerHTML));
})();
