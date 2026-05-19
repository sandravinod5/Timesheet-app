#!/usr/bin/env bash
set -euo pipefail

cd /var/www/Timesheet-app

git fetch origin main
git reset --hard origin/main
npm ci
npm run build

if [ "$(id -u)" -ne 0 ]; then
  sudo -n systemctl restart timesheet-app.service
else
  systemctl restart timesheet-app.service
fi
