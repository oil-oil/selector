#!/usr/bin/env node

import { run } from "../dev/install.mjs";

try {
  run();
} catch (error) {
  console.error(`Selector setup failed: ${error.message}`);
  process.exitCode = 1;
}
