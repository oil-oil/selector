const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

async function injectSelector(page) {
  const css = fs.readFileSync(path.join(ROOT, 'assets/editor.css'), 'utf8');
  const js  = fs.readFileSync(path.join(ROOT, 'assets/editor.js'),  'utf8');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
}

module.exports = { injectSelector };
