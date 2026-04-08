#!/usr/bin/env bash

set -euo pipefail

origins="http://localhost:3000"

for ip in $(ifconfig 2>/dev/null | awk '/inet / { print $2 }' | grep -E '^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)' || true); do
  [[ -n "$ip" ]] || continue
  case ",$origins," in
    *",http://$ip:3000,"*) ;;
    *) origins="$origins,http://$ip:3000" ;;
  esac
done

printf '%s\n' "$origins"
