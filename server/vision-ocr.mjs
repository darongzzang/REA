import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('./vision-ocr.swift', import.meta.url));

export async function recognizeImage(bytes) {
  if (process.platform !== 'darwin') {
    const error = new Error('이미지 OCR은 현재 macOS Apple Vision 환경에서만 지원합니다.');
    error.status = 501;
    throw error;
  }
  const directory = await mkdtemp(join(tmpdir(), 'papago-study-ocr-'));
  try {
    const path = join(directory, 'image');
    await writeFile(path, bytes);
    const { stdout } = await execFileAsync('/usr/bin/swift', [script, path], {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        SWIFT_MODULE_CACHE_PATH: join(tmpdir(), 'papago-study-swift-cache'),
        CLANG_MODULE_CACHE_PATH: join(tmpdir(), 'papago-study-clang-cache')
      }
    });
    return stdout.trim();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
