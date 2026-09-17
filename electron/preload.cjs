const { contextBridge } = require('electron');

// Передаём путь к WASM файлам в renderer process
const wasmPath = process.env.ORT_WASM_PATH || './assets/';

contextBridge.exposeInMainWorld('ORT_WASM_PATH', wasmPath);
