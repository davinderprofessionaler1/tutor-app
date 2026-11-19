import { spawnSync } from "node:child_process";
import path from "node:path";

const nextCli = path.resolve(process.cwd(), "node_modules/next/dist/bin/next");
const wasmDirectory = path.resolve(process.cwd(), "../../node_modules/@next/swc-wasm-nodejs");
const result = spawnSync(process.execPath, [nextCli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NEXT_TEST_WASM_DIR: wasmDirectory },
});

process.exit(result.status ?? 1);
