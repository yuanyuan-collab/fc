#!/usr/bin/env node
/**
 * 生成 file:// 降级数据文件 data/quizzes.js
 *
 * 用法：node data/build.js
 *
 * 说明：
 * - data/*.json 是权威数据源（部署后由前端 fetch 加载）
 * - 本脚本把所有测试打包为 window.__QUIZZES__ 映射，
 *   供 file:// 直接双击打开（fetch 被浏览器拦截）时降级使用
 * - 新增/修改测试 JSON 后运行一次即可保持同步
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = __dirname;
const LIST_FILE = path.join(DATA_DIR, 'quizzes.json');
const OUT_FILE = path.join(DATA_DIR, 'quizzes.js');

const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
const out = {};

for (const q of list.quizzes) {
  // basename 防止路径穿越，确保只读 data 目录内的文件
  const file = path.join(DATA_DIR, path.basename(q.file));
  if (!fs.existsSync(file)) {
    console.error('❌ 找不到数据文件：' + file);
    process.exit(1);
  }
  out[q.id] = JSON.parse(fs.readFileSync(file, 'utf8'));
}

const header = [
  '/* 由 data/build.js 生成，勿手改。权威数据源为 data/*.json。',
  ' * 用途：file:// 直接打开时 fetch 被拦截的降级数据。 */',
  'window.__QUIZZES__ = '
].join('\n');

fs.writeFileSync(OUT_FILE, header + JSON.stringify(out) + ';\n');
console.log('✅ 已生成 ' + OUT_FILE + '（包含 ' + Object.keys(out).length + ' 个测试）');
