#!/bin/bash
find server -name "*.ts" -type f | while read f; do
  if ! git ls-files "$f" | grep -q .; then
    echo "$f"
  fi
done
