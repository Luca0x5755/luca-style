import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 來源證明（--provenance）要求 package.json 的 repository.url 與發佈的 GitHub 倉庫一致，否則 registry 回 422（第一次發佈實際遇到）。
// dry-run 不會把證明送去驗證，所以在這裡離線檢查。
const repoUrl = 'git+https://github.com/Luca0x5755/luca-style.git';

for (const name of ['tokens', 'react']) {
  test(`@luca-style/${name} declares the GitHub repository that provenance is checked against`, () => {
    const pkg = JSON.parse(readFileSync(new URL(`../packages/${name}/package.json`, import.meta.url), 'utf8'));
    expect(pkg.repository).toEqual({ type: 'git', url: repoUrl, directory: `packages/${name}` });
  });
}
