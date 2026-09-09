#!/bin/bash
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('file_path', ''))
except Exception:
    print('')
")

case "$FILE" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || exit 0

OUTPUT=$(npm run type-check 2>&1)
if [ $? -ne 0 ]; then
  echo "Type-check failed after editing $FILE:" >&2
  echo "$OUTPUT" >&2
  exit 2
fi

exit 0
