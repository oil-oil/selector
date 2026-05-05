const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..'); // two levels up from tests/helpers/ → project root

function readAsset(relPath) {
  const abs = path.join(ROOT, relPath);
  try {
    return fs.readFileSync(abs, 'utf8');
  } catch (e) {
    throw new Error(`inject.js: cannot read asset "${abs}" — ${e.message}`);
  }
}

async function injectSelector(page) {
  const css = readAsset('assets/editor.css');
  const js  = readAsset('assets/editor.js');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
}

module.exports = { injectSelector };
