#!/usr/bin/env bash
# 一键部署到 GitHub Pages（main 分支 + Pages 托管 root，push 后自动更新）
# 用法：./deploy.sh "本次更新说明"
set -e
cd "$(dirname "$0")"

msg="${1:-update $(date '+%Y-%m-%d %H:%M')}"

git add .
if git diff --cached --quiet; then
  echo "无变更，无需提交"
else
  git commit -m "$msg"
fi
git push origin main
echo ""
echo "✅ 已推送。GitHub Pages 将自动重新部署，链接不变。"
