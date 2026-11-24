#!/usr/bin/env bash
# Short SFU diagnostics only. App admission/control tests run separately.
set -euo pipefail
: "${LIVEKIT_URL:?Set the isolated lab URL}"
: "${LIVEKIT_API_KEY:?Set the isolated lab key}"
: "${LIVEKIT_API_SECRET:?Set the isolated lab secret}"
if [[ "$LIVEKIT_URL" != "ws://127.0.0.1:7990" ]]; then
  printf '%s\n' 'Use a separate loopback-only lab SFU at ws://127.0.0.1:7990.' >&2
  exit 1
fi
classroom_cli="${LIVEKIT_CLI:-lk}"
classroom_output="${CLASSROOM_SMOKE_OUTPUT_DIR:-.qa/classroom-media}"
mkdir -p "$classroom_output"
for students in 10 25 50; do
  timeout 90s "$classroom_cli" perf load-test --room "tutor-smoke-$students" \
    --video-publishers 1 --audio-publishers 1 --subscribers "$students" \
    --video-resolution low --video-codec vp8 --duration 30s \
    > "$classroom_output/load-$students.log" 2>&1
done
timeout 90s "$classroom_cli" perf load-test --room tutor-smoke-gallery \
  --video-publishers 10 --audio-publishers 10 --subscribers 1 --layout 5x5 \
  --video-resolution low --video-codec vp8 --duration 20s \
  > "$classroom_output/load-gallery-10.log" 2>&1
