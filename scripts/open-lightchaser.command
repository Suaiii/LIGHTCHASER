#!/bin/zsh

set -u

PROJECT_DIR="/Users/hubin/Documents/追光/LIGHTCHASER"
HOST="127.0.0.1"
PORT="5174"
URL="http://${HOST}:${PORT}/"
LOG_DIR="${PROJECT_DIR}/.runtime"
LOG_FILE="${LOG_DIR}/preview.log"

mkdir -p "${LOG_DIR}"
cd "${PROJECT_DIR}" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先安装 Node.js 后再双击此脚本。"
  read -r "?按回车退出..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "首次运行，正在安装依赖..."
  npm install
fi

if ! curl -fsS --max-time 2 "${URL}" >/dev/null 2>&1; then
  echo "正在启动追·光本地预览..."
  HOST="${HOST}" PORT="${PORT}" npm run dev:preview > "${LOG_FILE}" 2>&1 &

  for i in {1..30}; do
    if curl -fsS --max-time 2 "${URL}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

echo "正在打开：${URL}"
open "${URL}"

echo ""
echo "追·光网页已打开。"
echo "本地服务地址：${URL}"
echo "运行日志：${LOG_FILE}"
echo ""
echo "这个窗口可以关闭，预览服务会继续在后台运行。"
read -r "?按回车关闭窗口..."
