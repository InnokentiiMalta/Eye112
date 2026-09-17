#!/usr/bin/env node

import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к WASM файлам в node_modules
const wasmSourceDir = join(__dirname, 'node_modules', 'onnxruntime-web', 'dist');
const wasmDestDir = join(__dirname, 'dist', 'assets');

// Создаём папку dest если её нет
if (!existsSync(wasmDestDir)) {
  mkdirSync(wasmDestDir, { recursive: true });
}

// Копируем все .wasm файлы
const wasmFiles = readdirSync(wasmSourceDir).filter(f => f.endsWith('.wasm'));

console.log(`Copying ${wasmFiles.length} WASM files to dist/assets/...`);

for (const file of wasmFiles) {
  const src = join(wasmSourceDir, file);
  const dest = join(wasmDestDir, file);
  copyFileSync(src, dest);
  console.log(`  ✓ ${file}`);
}

console.log('Done!');
