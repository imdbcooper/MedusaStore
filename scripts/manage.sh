#!/usr/bin/env bash
# ============================================================
# medusa-agency-boilerplate :: интерактивный менеджер проекта
# ------------------------------------------------------------
# Запуск:   bash scripts/manage.sh
#           или   npm run manage   (если добавлен alias в package.json)
#
# Скрипт намеренно тонкий: он НЕ дублирует canonical-логику
# (`bootstrap.sh`, `preflight.sh`, `dev.sh`, docker compose),
# а предоставляет интерактивную обёртку с проверками.
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Цветовой вывод ──────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RESET="\033[0m"; C_BOLD="\033[1m"
  C_RED="\033[31m"; C_GREEN="\033[32m"; C_YELLOW="\033[33m"
  C_BLUE="\033[34m"; C_CYAN="\033[36m"; C_GRAY="\033[90m"
else
  C_RESET=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_CYAN=""; C_GRAY=""
fi

log()      { echo -e "${C_GRAY}[manage]${C_RESET} $*"; }
ok()       { echo -e "${C_GREEN}[ok]${C_RESET} $*"; }
warn()     { echo -e "${C_YELLOW}[warn]${C_RESET} $*"; }
err()      { echo -e "${C_RED}[err]${C_RESET} $*" >&2; }
title()    { echo -e "\n${C_BOLD}${C_CYAN}━━ $* ━━${C_RESET}"; }
hr()       { echo -e "${C_GRAY}────────────────────────────────────────────────${C_RESET}"; }

# ── Утилиты ─────────────────────────────────────────────────
need() {
  local missing=0
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      err "Не найдена обязательная команда: $cmd"
      missing=1
    fi
  done
  return $missing
}

confirm() {
  local prompt="${1:-Продолжить?} [y/N]: "
  local ans
  read -r -p "$(echo -e "${C_YELLOW}${prompt}${C_RESET}")" ans
  [[ "$ans" =~ ^[YyДд]([Ee][Ss])?$ ]]
}

press_enter() {
  echo
  read -r -p "$(echo -e "${C_GRAY}Нажмите Enter, чтобы вернуться в меню...${C_RESET}")" _ || true
}

run() {
  echo -e "${C_BLUE}\$${C_RESET} $*"
  "$@"
}

# Загружает .env, чтобы знать порты
load_env() {
  if [[ -f "$ROOT_DIR/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env"
    set +a
  fi
  : "${POSTGRES_PORT:=5433}"
  : "${REDIS_PORT:=6379}"
  : "${MEDUSA_BACKEND_PORT:=9000}"
  : "${STOREFRONT_PORT:=8000}"
  : "${PAYLOAD_PORT:=3100}"
  : "${MEDUSA_BACKEND_URL:=http://localhost:${MEDUSA_BACKEND_PORT}}"
  : "${PAYLOAD_CMS_URL:=http://localhost:${PAYLOAD_PORT}}"
}

port_busy() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]${port}\$"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}

http_ok() {
  curl -fsS -o /dev/null --max-time 3 "$1"
}

# ── Команды ─────────────────────────────────────────────────

cmd_status() {
  title "Состояние проекта"

  echo -e "${C_BOLD}Окружение:${C_RESET}"
  if [[ -f "$ROOT_DIR/.env" ]]; then ok "root .env"; else err "нет root .env (cp .env.example .env)"; fi
  if [[ -f "$ROOT_DIR/medusa-agency-boilerplate/.env" ]]; then ok "backend .env"; else warn "нет backend .env (npm run bootstrap)"; fi
  if [[ -f "$ROOT_DIR/medusa-agency-boilerplate-storefront/.env.local" ]]; then ok "storefront .env.local"; else warn "нет storefront .env.local"; fi

  hr
  echo -e "${C_BOLD}Docker контейнеры:${C_RESET}"
  if need docker; then
    docker compose ps 2>/dev/null || true
  fi

  hr
  echo -e "${C_BOLD}Порты:${C_RESET}"
  for pair in "PostgreSQL:${POSTGRES_PORT}" "Redis:${REDIS_PORT}" "Backend:${MEDUSA_BACKEND_PORT}" "Storefront:${STOREFRONT_PORT}" "Payload CMS:${PAYLOAD_PORT}"; do
    label="${pair%%:*}"; port="${pair##*:}"
    if port_busy "$port"; then
      ok "${label} :${port} занят (сервис работает)"
    else
      warn "${label} :${port} свободен"
    fi
  done

  hr
  echo -e "${C_BOLD}HTTP healthchecks:${C_RESET}"
  if http_ok "${MEDUSA_BACKEND_URL}/health"; then ok "backend ${MEDUSA_BACKEND_URL}/health"; else warn "backend не отвечает"; fi
  if http_ok "http://localhost:${STOREFRONT_PORT}"; then ok "storefront http://localhost:${STOREFRONT_PORT}"; else warn "storefront не отвечает"; fi
  if http_ok "${PAYLOAD_CMS_URL%/}/admin"; then ok "payload admin ${PAYLOAD_CMS_URL%/}/admin"; else warn "payload admin не отвечает"; fi
}

cmd_bootstrap() {
  title "Bootstrap (env-sync + БД + seed + publishable key)"
  warn "Это пересоздаст backend/.env и storefront/.env.local из root .env."
  confirm "Запустить bootstrap?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run npm run bootstrap )
}

cmd_preflight() {
  title "Preflight (валидация окружения и портов)"
  ( cd "$ROOT_DIR" && run npm run preflight )
}

cmd_up_infra() {
  title "Поднять infra (PostgreSQL + Redis)"
  ( cd "$ROOT_DIR" && run docker compose up -d medusa-db medusa-redis )
}

cmd_up_backend() {
  title "Поднять backend (контейнер)"
  ( cd "$ROOT_DIR" && run docker compose up -d medusa-backend )
  log "Логи: docker compose logs -f medusa-backend"
}

cmd_up_storefront() {
  title "Запустить storefront dev (host node, не контейнер)"
  warn "Storefront в этом репо НЕ контейнеризован (см. инструкцию scripts/MANAGE.md §2)."
  warn "Будет запущен 'npm run dev' в medusa-agency-boilerplate-storefront/ на хосте."
  confirm "Запустить storefront dev в текущем терминале (foreground)?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run bash ./scripts/storefront-dev.sh )
}

cmd_start_storefront() {
  title "Запустить storefront production preview (host node)"
  warn "Требуется предварительная сборка: npm run storefront:build."
  warn "Будет запущен 'next start' в medusa-agency-boilerplate-storefront/ на хосте."
  confirm "Запустить storefront production preview в текущем терминале (foreground)?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run bash ./scripts/storefront-start.sh )
}

cmd_up_all() {
  title "Полный запуск проекта (canonical npm run dev)"
  log "Эквивалент: preflight -> infra up -> backend up -> ожидание /health -> storefront dev (foreground)."
  confirm "Запустить?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run npm run dev )
}

# Останавливает host-процесс storefront, слушающий $STOREFRONT_PORT.
# Storefront не контейнеризован (см. MANAGE.md §2), поэтому
# `docker compose stop` его не трогает — нужна отдельная остановка.
# БЕЗОПАСНОСТЬ:
# Эта функция НЕ использует kill по process group (-PGID) и НЕ использует
# pgrep с широкими шаблонами. Раньше pgid storefront мог совпасть с pgid
# сессии терминала / VSCode shell, и kill -TERM -PGID гасил рабочую сессию.
# Теперь убиваем строго конкретные PID, которые сами слушают $STOREFRONT_PORT
# (LISTEN-сокет), плюс их прямого родителя ТОЛЬКО если это явно
# scripts/storefront-dev.sh / npm / next dev обёртка.

# Возвращает в stdout уникальные PID, слушающие TCP-порт $1 (LISTEN).
_pids_listening_on_port() {
  local port="$1"
  local pids=""

  if command -v ss >/dev/null 2>&1; then
    pids=$(ss -ltnpH "sport = :$port" 2>/dev/null \
      | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
  fi

  if [[ -z "${pids//[[:space:]]/}" ]] && command -v fuser >/dev/null 2>&1; then
    # `fuser -n tcp PORT` без флагов покажет всех — и listeners, и
    # клиентов. Берём пересечение с реальным listener-PID через ss выше;
    # если ss недоступен — соглашаемся, fuser должен быть достаточен,
    # т.к. для bind на одном TCP-порту LISTEN держит только один процесс.
    pids=$(fuser -n tcp "$port" 2>/dev/null \
      | tr -s ' \t' '\n' | grep -E '^[0-9]+$' | sort -u || true)
  fi

  if [[ -z "${pids//[[:space:]]/}" ]] && command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u || true)
  fi

  echo "$pids"
}

# Безопасно ли убивать данный PID? Условия (все обязательны):
#   1) PID существует и принадлежит текущему UID;
#   2) PID НЕ является session leader (sid == pid) — иначе можем
#      зацепить сессию терминала / VSCode shell;
#   3) PID НЕ является pid 1 / init / systemd / shell ($$ родителей);
#   4) cmdline соответствует одному из ожидаемых шаблонов
#      (next-server / next dev / storefront-dev.sh / npm run dev в storefront).
_safe_to_kill_storefront_pid() {
  local pid="$1"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  [[ "$pid" -gt 1 ]] || return 1

  # Свой UID?
  local pid_uid
  pid_uid=$(stat -c '%u' "/proc/$pid" 2>/dev/null || echo "")
  [[ "$pid_uid" == "$(id -u)" ]] || return 1

  # Не session leader?
  local sid
  sid=$(ps -o sid= -p "$pid" 2>/dev/null | tr -d ' ' || echo "")
  [[ -n "$sid" && "$sid" != "$pid" ]] || return 1

  # cmdline относится к storefront?
  local cmdline
  cmdline=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || echo "")
  case "$cmdline" in
    *next-server*|*"next dev"*|*"/next dev"*|*storefront-dev.sh*|*"medusa-agency-boilerplate-storefront"*)
      return 0 ;;
  esac
  return 1
}

cmd_stop_storefront() {
  local port="${STOREFRONT_PORT:-8000}"
  title "Остановить storefront (host process на :${port})"

  if ! command -v ss >/dev/null 2>&1 \
     && ! command -v fuser >/dev/null 2>&1 \
     && ! command -v lsof >/dev/null 2>&1; then
    err "Не найдено ни ss, ни fuser, ни lsof — не могу определить PID на :$port."
    return 1
  fi

  local listener_pids
  listener_pids=$(_pids_listening_on_port "$port")

  if [[ -z "${listener_pids//[[:space:]]/}" ]]; then
    warn "На :$port слушающих процессов не найдено — storefront уже остановлен."
    return 0
  fi

  # Расширим listener-PID их родителями вверх по дереву, пока родитель —
  # тоже storefront-обёртка (npm / sh -c 'next dev' / storefront-dev.sh).
  # Это гасит npm-обёртку и не даёт ей мгновенно перезапустить next.
  local candidate_pids="$listener_pids"
  for pid in $listener_pids; do
    local cur="$pid"
    while :; do
      local ppid
      ppid=$(ps -o ppid= -p "$cur" 2>/dev/null | tr -d ' ' || echo "")
      [[ -z "$ppid" || "$ppid" -le 1 ]] && break
      if _safe_to_kill_storefront_pid "$ppid"; then
        candidate_pids+=$'\n'"$ppid"
        cur="$ppid"
      else
        break
      fi
    done
  done

  # Финальный список: уникальные, прошедшие safety-фильтр.
  local target_pids=""
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    if _safe_to_kill_storefront_pid "$pid"; then
      target_pids+="$pid"$'\n'
    else
      log "skip PID $pid (не прошёл safety-фильтр)"
    fi
  done < <(echo "$candidate_pids" | grep -E '^[0-9]+$' | sort -u)

  target_pids=$(echo "$target_pids" | grep -E '^[0-9]+$' | sort -u || true)

  if [[ -z "${target_pids//[[:space:]]/}" ]]; then
    err "Не нашёл безопасных PID для остановки. Listener PID(ы): $(echo "$listener_pids" | tr '\n' ' ')."
    err "Остановите вручную: kill <PID>  (см. ss -ltnp 'sport = :$port')"
    return 1
  fi

  log "Целевые PID (только storefront, без pgid/сессии): $(echo "$target_pids" | tr '\n' ' ')"

  # SIGTERM по конкретным PID. Никаких kill -PGID.
  for pid in $target_pids; do
    run kill -TERM "$pid" 2>/dev/null || true
  done

  # Ждём до 8 секунд завершения.
  local waited=0
  while (( waited < 8 )); do
    local alive=0
    for pid in $target_pids; do
      if kill -0 "$pid" 2>/dev/null; then alive=1; break; fi
    done
    if [[ "$alive" -eq 0 ]] && ! port_busy "$port"; then break; fi
    sleep 1
    waited=$((waited + 1))
  done

  # Жёсткая добивка ТОЛЬКО для тех же конкретных PID, что прошли safety.
  for pid in $target_pids; do
    if kill -0 "$pid" 2>/dev/null; then
      warn "PID $pid не завершился по SIGTERM — отправляю SIGKILL."
      run kill -KILL "$pid" 2>/dev/null || true
    fi
  done

  # Финальная подчистка: если порт всё ещё занят — найдём актуальный
  # listener-PID и применим к нему ту же safety-проверку.
  if port_busy "$port"; then
    local late_pids
    late_pids=$(_pids_listening_on_port "$port")
    for pid in $late_pids; do
      if _safe_to_kill_storefront_pid "$pid"; then
        warn "Порт :$port всё ещё занят PID $pid — KILL."
        run kill -KILL "$pid" 2>/dev/null || true
      else
        warn "Порт :$port занят PID $pid, но он не storefront — НЕ трогаю."
      fi
    done
    sleep 1
  fi

  if port_busy "$port"; then
    err "Порт :$port не освободился. Проверьте вручную: ss -ltnp 'sport = :$port'"
    return 1
  fi
  ok "Storefront остановлен, порт :$port свободен."
}

cmd_stop() {
  title "Остановить контейнеры + storefront"
  ( cd "$ROOT_DIR" && run docker compose stop )
  ok "Контейнеры остановлены. Тома и сети сохранены."
  hr
  cmd_stop_storefront || warn "Не удалось полностью остановить storefront."
}

cmd_down() {
  title "Down: остановить и удалить контейнеры"
  warn "Тома (БД) при этом НЕ удаляются."
  confirm "Выполнить docker compose down?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run docker compose down )
  hr
  cmd_stop_storefront || warn "Не удалось полностью остановить storefront."
}

cmd_nuke() {
  title "ОПАСНО: down -v (удалить контейнеры И тома, в т.ч. БД)"
  err "Это удалит volume medusa-db-data вместе со всей БД, ключами и сидами."
  confirm "Точно удалить тома?" || { log "Отменено."; return; }
  confirm "Подтвердите ещё раз — данные будут потеряны навсегда?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run docker compose down -v )
  hr
  cmd_stop_storefront || warn "Не удалось полностью остановить storefront."
  ok "Тома удалены. Для нового старта: cmd 'bootstrap' -> 'up all'."
}

cmd_restart_backend() {
  title "Перезапуск backend контейнера"
  ( cd "$ROOT_DIR" && run docker compose restart medusa-backend )
}

cmd_rebuild() {
  title "Пересобрать backend (npm install + build) внутри контейнера"
  warn "Backend использует образ node:20-bookworm с bind-mount, без своего Dockerfile."
  warn "Будет: stop backend -> rm node_modules-кэш Vite -> install deps -> build."
  confirm "Продолжить?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run docker compose stop medusa-backend )
  ( cd "$ROOT_DIR" && run npm run permissions:fix )
  ( cd "$ROOT_DIR" && run npm --prefix ./medusa-agency-boilerplate install )
  ( cd "$ROOT_DIR" && run npm run backend:build )
  ( cd "$ROOT_DIR" && run docker compose up -d medusa-backend )
  ok "Backend пересобран и поднят."
}

cmd_rebuild_storefront() {
  title "Пересобрать storefront (host)"
  ( cd "$ROOT_DIR" && run npm --prefix ./medusa-agency-boilerplate-storefront install )
  ( cd "$ROOT_DIR" && run npm run storefront:build )
}

cmd_payload_status() {
  title "Payload CMS status / health"
  ( cd "$ROOT_DIR" && run bash ./scripts/payload-run.sh status )
}

cmd_payload_dev() {
  title "Payload CMS dev"
  warn "Будет запущен Payload/Next dev server на порту ${PAYLOAD_PORT} в текущем терминале (foreground)."
  confirm "Запустить Payload CMS dev?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run npm run payload:dev )
}

cmd_payload_build() {
  title "Payload CMS build"
  ( cd "$ROOT_DIR" && run npm run payload:build )
}

cmd_payload_start() {
  title "Payload CMS production start"
  warn "Перед production start должен быть выполнен build: npm run payload:build."
  warn "Next start будет работать в текущем терминале (foreground) на порту ${PAYLOAD_PORT}."
  confirm "Запустить Payload CMS production server?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run npm run payload:start )
}

cmd_payload_types() {
  title "Payload CMS types + importmap"
  ( cd "$ROOT_DIR" && run npm run payload:types )
  ( cd "$ROOT_DIR" && run npm run payload:importmap )
}

cmd_payload_seed() {
  title "Payload CMS seed тестового контента"
  warn "Seed создаст или обновит маркетинговые страницы и globals navigation/footer/siteSettings."
  warn "Нужны доступная PostgreSQL БД Payload и корректные payload-cms/.env значения DATABASE_URL/PAYLOAD_SECRET."
  confirm "Запустить Payload CMS seed?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run npm run payload:seed )
}

cmd_payload_stop() {
  title "Payload CMS stop"
  warn "Это остановит активные Payload/Next dev/start процессы без очистки payload-cms/.next."
  confirm "Остановить Payload CMS?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run npm run payload:stop )
}

cmd_payload_clean() {
  title "Payload CMS clean (.next cache/build)"
  warn "Это остановит активные Payload/Next dev/start процессы и удалит payload-cms/.next."
  confirm "Выполнить Payload CMS clean?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run npm run payload:clean )
}

cmd_payload_restart() {
  title "Payload CMS restart (stop + clean + dev)"
  warn "Это остановит активный Payload/Next dev/start, удалит payload-cms/.next и запустит dev server в текущем терминале (foreground)."
  confirm "Перезапустить Payload CMS dev?" || { log "Отменено."; return; }
  ( cd "$ROOT_DIR" && run npm run payload:restart )
}

cmd_logs() {
  title "Логи (Ctrl+C — выйти)"
  echo "1) backend"
  echo "2) postgres"
  echo "3) redis"
  echo "4) все сервисы"
  read -r -p "Выбор [1-4]: " ans
  case "$ans" in
    1) ( cd "$ROOT_DIR" && docker compose logs -f --tail=200 medusa-backend ) ;;
    2) ( cd "$ROOT_DIR" && docker compose logs -f --tail=200 medusa-db ) ;;
    3) ( cd "$ROOT_DIR" && docker compose logs -f --tail=200 medusa-redis ) ;;
    4) ( cd "$ROOT_DIR" && docker compose logs -f --tail=200 ) ;;
    *) warn "Неизвестный выбор" ;;
  esac
}

cmd_shell_backend() {
  title "Shell в backend контейнере"
  ( cd "$ROOT_DIR" && run docker compose exec medusa-backend bash )
}

cmd_db_psql() {
  title "psql в medusa-db"
  ( cd "$ROOT_DIR" && run docker compose exec medusa-db psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-medusa}" )
}

cmd_permissions() {
  title "Починить права на сгенерированные файлы backend"
  ( cd "$ROOT_DIR" && run npm run permissions:fix )
}

cmd_typecheck() {
  title "Typecheck (backend + storefront)"
  ( cd "$ROOT_DIR" && run npm run typecheck )
}

cmd_smoke() {
  title "Smoke-тесты"
  echo "1) backend"
  echo "2) storefront"
  echo "3) browser"
  echo "4) notification"
  echo "5) delivery-hub cutover (browser)"
  read -r -p "Выбор [1-5]: " ans
  case "$ans" in
    1) ( cd "$ROOT_DIR" && run npm run smoke:backend ) ;;
    2) ( cd "$ROOT_DIR" && run npm run smoke:storefront ) ;;
    3) ( cd "$ROOT_DIR" && run npm run smoke:browser ) ;;
    4) ( cd "$ROOT_DIR" && run npm run smoke:notification ) ;;
    5) ( cd "$ROOT_DIR" && run npm run smoke:delivery-hub-cutover:browser ) ;;
    *) warn "Неизвестный выбор" ;;
  esac
}

cmd_help() {
  title "Помощь"
  cat <<'EOF'
Этот скрипт — интерактивная обёртка над canonical npm-скриптами и docker compose.
Канонический путь чистого старта (см. SKILL.md):
  cp .env.example .env
  npm run bootstrap
  npm run preflight
  npm run dev

Storefront НЕ контейнеризован в docker-compose.yml — это сознательное решение:
  - bootstrap читает publishable key из живого backend и пишет его в storefront/.env.local;
  - staging deploy path (см. Docs/staging_deploy_path.md) трактует storefront как
    отдельный runtime surface;
  - Next.js dev/HMR удобнее запускать на хосте.
Если очень нужно — добавьте свой compose-override storefront-сервиса локально,
но это вне master-repo контракта.

Payload CMS:
  bash scripts/manage.sh payload:status   # статус процессов/порта/admin health
  bash scripts/manage.sh payload:stop     # остановить dev/start без очистки payload-cms/.next
  bash scripts/manage.sh payload:clean    # остановить dev/start и удалить payload-cms/.next
  bash scripts/manage.sh payload:restart  # clean + dev foreground
EOF
}

# ── Меню ────────────────────────────────────────────────────
print_menu() {
  clear 2>/dev/null || true
  echo -e "${C_BOLD}${C_CYAN}╔════════════════════════════════════════════════════╗${C_RESET}"
  echo -e "${C_BOLD}${C_CYAN}║  medusa-agency-boilerplate :: project manager       ║${C_RESET}"
  echo -e "${C_BOLD}${C_CYAN}╚════════════════════════════════════════════════════╝${C_RESET}"
  echo
  echo -e "  ${C_BOLD}Состояние / проверки${C_RESET}"
  echo "    1) status       — статус контейнеров, портов, healthchecks"
  echo "    2) preflight    — валидация env/портов"
  echo "    3) typecheck    — backend + storefront"
  echo
  echo -e "  ${C_BOLD}Запуск${C_RESET}"
  echo "    4) bootstrap    — синхронизация env, seed, publishable key"
  echo "    5) up all       — полный запуск (npm run dev)"
  echo "    6) up infra     — только Postgres + Redis"
  echo "    7) up backend   — поднять backend контейнер"
  echo "    8) up storefront dev — запустить storefront dev (host)"
  echo "    9) start storefront — production preview после build (host)"
  echo
  echo -e "  ${C_BOLD}Управление${C_RESET}"
  echo "   10) restart backend"
  echo "   11) rebuild backend (install + build)"
  echo "   12) rebuild storefront"
  echo "   13) permissions:fix"
  echo "   14) logs (выбор сервиса)"
  echo "   15) shell в backend"
  echo "   16) psql в medusa-db"
  echo "   17) smoke-тесты"
  echo
  echo -e "  ${C_BOLD}Остановка${C_RESET}"
  echo "   18) stop         — docker compose stop + storefront (host)"
  echo "   19) down         — удалить контейнеры (тома сохранены) + storefront"
  echo "   20) nuke (down -v)— удалить контейнеры И БД (опасно) + storefront"
  echo "   21) stop storefront — только host-процесс storefront"
  echo
  echo -e "  ${C_BOLD}Payload CMS${C_RESET}"
  echo "   22) payload status/health"
  echo "   23) payload dev          — Next/Payload dev server"
  echo "   24) payload build        — production build"
  echo "   25) payload start        — production start (после build)"
  echo "   26) payload types        — generate types + importmap"
  echo "   27) payload seed         — тестовые страницы + globals"
  echo "   28) payload stop         — только остановить dev/start, без очистки .next"
  echo "   29) payload clean        — stop + очистить .next"
  echo "   30) payload restart      — clean + dev foreground"
  echo
  echo "    h) help          q) quit"
  echo
}

main_loop() {
  load_env
  while true; do
    print_menu
    read -r -p "$(echo -e "${C_BOLD}Выбор:${C_RESET} ")" choice
    case "$choice" in
      1)  cmd_status              ; press_enter ;;
      2)  cmd_preflight           ; press_enter ;;
      3)  cmd_typecheck           ; press_enter ;;
      4)  cmd_bootstrap           ; press_enter ;;
      5)  cmd_up_all              ; press_enter ;;
      6)  cmd_up_infra            ; press_enter ;;
      7)  cmd_up_backend          ; press_enter ;;
      8)  cmd_up_storefront       ; press_enter ;;
      9)  cmd_start_storefront    ; press_enter ;;
      10) cmd_restart_backend     ; press_enter ;;
      11) cmd_rebuild             ; press_enter ;;
      12) cmd_rebuild_storefront  ; press_enter ;;
      13) cmd_permissions         ; press_enter ;;
      14) cmd_logs                ; press_enter ;;
      15) cmd_shell_backend       ; press_enter ;;
      16) cmd_db_psql             ; press_enter ;;
      17) cmd_smoke               ; press_enter ;;
      18) cmd_stop                ; press_enter ;;
      19) cmd_down                ; press_enter ;;
      20) cmd_nuke                ; press_enter ;;
      21) cmd_stop_storefront     ; press_enter ;;
      22) cmd_payload_status      ; press_enter ;;
      23) cmd_payload_dev         ; press_enter ;;
      24) cmd_payload_build       ; press_enter ;;
      25) cmd_payload_start       ; press_enter ;;
      26) cmd_payload_types       ; press_enter ;;
      27) cmd_payload_seed        ; press_enter ;;
      28) cmd_payload_stop        ; press_enter ;;
      29) cmd_payload_clean       ; press_enter ;;
      30) cmd_payload_restart     ; press_enter ;;
      h|H) cmd_help               ; press_enter ;;
      q|Q|exit) log "Выход."; exit 0 ;;
      *) warn "Неизвестный выбор: $choice"; sleep 1 ;;
    esac
  done
}

# ── Не-интерактивный режим (CLI флаги) ──────────────────────
if [[ $# -gt 0 ]]; then
  load_env
  case "$1" in
    status)            cmd_status ;;
    preflight)         cmd_preflight ;;
    bootstrap)         cmd_bootstrap ;;
    up)                cmd_up_all ;;
    up:infra)          cmd_up_infra ;;
    up:backend)        cmd_up_backend ;;
    up:storefront|up:storefront:dev) cmd_up_storefront ;;
    start:storefront|storefront:start) cmd_start_storefront ;;
    stop)              cmd_stop ;;
    stop:storefront)   cmd_stop_storefront ;;
    down)              cmd_down ;;
    nuke)              cmd_nuke ;;
    restart:backend)   cmd_restart_backend ;;
    rebuild:backend)   cmd_rebuild ;;
    rebuild:storefront) cmd_rebuild_storefront ;;
    logs)              cmd_logs ;;
    shell)             cmd_shell_backend ;;
    psql)              cmd_db_psql ;;
    permissions)       cmd_permissions ;;
    typecheck)         cmd_typecheck ;;
    smoke)             cmd_smoke ;;
    payload:status)    cmd_payload_status ;;
    payload:dev)       cmd_payload_dev ;;
    payload:build)     cmd_payload_build ;;
    payload:start)     cmd_payload_start ;;
    payload:types)     cmd_payload_types ;;
    payload:seed)      cmd_payload_seed ;;
    payload:stop)      cmd_payload_stop ;;
    payload:clean)     cmd_payload_clean ;;
    payload:restart)   cmd_payload_restart ;;
    help|-h|--help)    cmd_help ;;
    *) err "Неизвестная команда: $1"; cmd_help; exit 2 ;;
  esac
  exit 0
fi

main_loop
