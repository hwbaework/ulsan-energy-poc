#!/usr/bin/env bash
# 개발 서버(.next)를 건드리지 않고 배포 — 저장소의 현재 커밋을 별도 작업 폴더(worktree)에 꺼내 거기서 빌드 · 배포한다.
# node_modules 는 원본을 연결(junction)만 한다. 끝나면 연결부터 끊고(원본 삭제 방지) 작업 폴더를 지운다.
set -u
REPO="$1"
WT="$2"
REPO_W=$(cd "$REPO" && pwd -W | sed 's|/|\\|g')
WT_W=$(echo "$WT" | sed 's|/|\\|g')

cleanup() {
  if [ -e "$WT/node_modules" ]; then
    cmd //c rmdir "$WT_W\\node_modules" >/dev/null 2>&1   # 연결만 끊는다(원본은 그대로)
  fi
  if [ -e "$WT/node_modules" ]; then
    echo "[deploy] node_modules 연결을 끊지 못했습니다 — 작업 폴더를 지우지 않고 둡니다: $WT"
    return
  fi
  git -C "$REPO" worktree remove --force "$WT" >/dev/null 2>&1
  git -C "$REPO" worktree prune >/dev/null 2>&1
  echo "[deploy] 작업 폴더 정리 완료"
}
trap cleanup EXIT

cd "$REPO" || exit 1
HEAD=$(git rev-parse --short HEAD)
echo "[deploy] 커밋 $HEAD"
[ -e "$WT" ] && { echo "[deploy] 작업 폴더가 이미 있습니다: $WT"; exit 1; }
git worktree add --detach "$WT" HEAD >/dev/null 2>&1 || { echo "[deploy] worktree 생성 실패"; exit 1; }
cmd //c mklink //J "$WT_W\\node_modules" "$REPO_W\\node_modules" >/dev/null || { echo "[deploy] node_modules 연결 실패"; exit 1; }
for f in .env .env.local; do [ -f "$REPO/$f" ] && cp "$REPO/$f" "$WT/$f"; done

cd "$WT" || exit 1
echo "[deploy] 빌드 시작"
npx next build > build.log 2>&1
BUILD=$?
tail -6 build.log
if [ $BUILD -ne 0 ]; then echo "[deploy] 빌드 실패(exit $BUILD)"; grep -n "Error\|error" build.log | head -20; exit 1; fi
[ -f .next-build/index.html ] || { echo "[deploy] 빌드 결과(.next-build)가 없습니다"; exit 1; }
echo "[deploy] 파일 수 $(find .next-build -type f | wc -l)"
echo "[deploy] 배포 시작"
npx wrangler deploy > deploy.log 2>&1
DEP=$?
tail -8 deploy.log
[ $DEP -ne 0 ] && { echo "[deploy] 배포 실패(exit $DEP)"; exit 1; }
echo "[deploy] 완료 — 커밋 $HEAD"
