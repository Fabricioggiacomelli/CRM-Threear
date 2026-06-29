# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CRM web app for managing sales offers/proposals (ofertas) for ThreeAr. Vanilla JS frontend with Firebase (Firestore + Auth) backend and a small Express.js server for TOTP/2FA.

## Running Locally

```bash
# Start the MFA backend (required for login)
cd backend && npm start        # Runs on http://127.0.0.1:3001

# Open the app — no build step needed
# Just open index.html or serve the root folder statically
# Add ?api=local to the URL to force local backend
```

## Deploying

```bash
# Deploy Cloud Functions (MFA backend for production)
firebase deploy --only functions

# Deploy hosting
firebase deploy --only hosting
```

There is no build step, bundler, or transpilation. Files are served as-is.

**Stale-cache note:** the alert verification loop runs client-side in every logged-in user's browser, writing to the shared `ofertas`/`alertas` collections. So a fix to `alertas.js` (or any logic) only takes effect once each user loads the new file — a single user on a cached old version can keep recreating "fixed" alerts for everyone. After a deploy, ask users to hard-reload (Ctrl+Shift+R) if a logic change must take effect immediately.

## Architecture

### File Loading Order

`index.html` loads scripts in this order — order matters, later files depend on earlier ones:

1. Firebase SDK (CDN) — `firebase-app`, `firebase-auth`, `firebase-firestore`
2. `firebase.js` — initializes `window.db` and `window.auth`
3. `schema.js` — `SCHEMA_FIELDS` array (field metadata for the offer form)
4. `usuarios.js` — `USUARIOS_CRM` hardcoded array + `sincronizarUsuariosCRM()`
5. `alertas.js` — entire alert system (self-contained module, uses globals from script.js)
6. `script.js` — main application (~9700 lines, all UI + Firestore CRUD)

`dashboard.html` loads Chart.js + `firebase.js` + `dashboard.js` independently.

### Global State

All application state lives on `window` or as top-level `let`/`var` in `script.js`:

- `window.db` / `window.auth` — Firebase instances
- `window.usuarioLogadoCRM` — logged-in user object `{ email, nome, role, podeVerDe }`
- `registros` — in-memory array of all offers (ofertas collection)
- `clientes`, `representadas`, `projetos` — in-memory arrays
- `window.alertasCache` — in-memory array of alerts (maintained by alertas.js listener)

### Firestore Collections

| Collection | Purpose |
|---|---|
| `ofertas` | Main offer records (the "registros" in UI) |
| `usuarios` | User accounts — keyed by Firebase UID |
| `usuarios_mfa` | TOTP secrets and activation status |
| `clientes` | Client companies |
| `representadas` | Manufacturer representatives |
| `projetos` | Projects linked to offers |
| `alertas` | System-generated alerts |
| `backups` | Export history |

### User Roles & Permissions

Roles are defined in `usuarios.js` (`USUARIOS_CRM` array) and synced to Firestore on admin login via `sincronizarUsuariosCRM()`. Three roles:

- **admin** — sees everything (`podeVerDe: ["*"]`), resolves/ignores alerts directly
- **supervisor** — sees own + team's offers (`podeVerDe: [list of emails]`), resolves directly
- **user** — sees only own offers, alert actions require supervisor/admin approval

Permission checks at runtime use `window.usuarioLogadoCRM` loaded from Firestore. The hardcoded `ADMIN_EMAILS` array in `script.js` (around line 76) is a secondary admin check.

### MFA / 2FA Flow

Login flow: Firebase Auth → check `aprovado` + `ativo` in `usuarios` collection → TOTP check via backend API → load app data.

The API base is resolved in `getApiBase()` in `script.js`:
- `localhost` / `127.0.0.1` → `http://127.0.0.1:3001` (local Express server in `backend/`)
- Production → `https://southamerica-east1-crm-three-ar.cloudfunctions.net/api` (Firebase Functions in `functions/`)
- Override with `?api=local` or `?api=prod` query param

### Alert System (`alertas.js`)

Self-contained module. Runs a verification loop (`iniciarLoopAlertas`) every 60 seconds (10s in `DEBUG_ALERTAS = true` mode) calling `verificarAlertasSistema()`, which checks all in-memory `registros` against rules.

**Alert types and their stop conditions:**

| Alert | Triggered when | Stops when |
|---|---|---|
| `followup` | Offer inactive past threshold counted in **business hours** (24 = 1 business day for compra, 48 = 2 business days for orcamento; other types don't fire) | `ultimoFollowUpEm` reset or offer edited |
| `prazo_entrega` | Delivery deadline 15/10/5/3/2/1 days away | Deadline passes or `pedido.entregue = "sim"` |
| `prazo_entrega_atrasado` | Delivery date past + not delivered | `pedido.entregue = "sim"` |
| `sem_resposta` | No update for 5+ days | `atualizadoEm` reset |
| `pedido_sem_nf` | Has order, no NF after 3 days | NF fields populated in `pedido` |

**Representadas that don't issue invoices (`sem_nf: true`):** Some representadas never send an NF, so `pedido_sem_nf` alerts must never fire for their offers. The representada doc carries a `sem_nf` boolean (toggled via the "Não emite Nota Fiscal" checkbox in the representadas form). The blocklist of representada IDs lives in `window.repsSemNFIds` (populated by `carregarRepresentadasFirebase()` and on representada save in `script.js`). In `alertas.js`, `_repsSemNFSet()` returns that set (recomputing from the `representadas` array if the window cache is empty — never fails open), and `_ofertaTemRepSemNF(ofertaId)` checks whether an offer's representada is on it. Creation is blocked at the single chokepoint `criarOuAtualizarAlerta()` (returns `null` for `pedido_sem_nf` of a `sem_nf` rep) plus a guard in `verificarAlertasPedidoSemNF()`, and toasts are suppressed in the `onSnapshot` listener. `limparAlertasSemNFUmaVez()` runs once per session (flag `window._alertasSemNFLimpezaFeita`) to delete pre-existing `pedido_sem_nf` docs for these reps — it is NOT a per-cycle loop (avoids log spam).

**`pedido_sem_nf` card values are recomputed live.** `_dadosPedidoSemNF(reg)` is the single source for the financial figures (`valorPedido`, `somaNFs`, `valorFaltante`) and the description string — used both when creating/updating the alert and when rendering the card in `renderListaAlertas`. The card recomputes from the current offer in memory (`registros`) instead of trusting the snapshot stored on the alert doc, so it never shows stale "possui pedido, mas ainda não tem NF" text after the offer's `valor_pedido` is filled in. The stored doc still self-syncs on the next loop cycle via the merge-update in `criarOuAtualizarAlerta`.

**NF tolerance margin per representada (`margem_nf`):** Some representadas (e.g. Prysmian) routinely invoice within a ± percentage of the order value, so the NF sum rarely matches `valor_pedido` exactly. The representada doc carries a numeric `margem_nf` (percent, set via the "Margem de Nota Fiscal (%)" field in the representadas form). `_nfCobertaPedido(pedido, margemPct = 0)` treats the order as covered when `somaNFs >= valor_pedido * (1 - margemPct/100)` — default `0` keeps the exact-match behavior for every other rep. `_margemNFDaOferta(reg)` reads the margin from the offer's representada (from the `representadas` array, robust at runtime). The margin is applied in three places: the loop (`verificarAlertasPedidoSemNF` skips offers within margin), the save-time auto-resolve (`onRegistroSalvoReset` → `TIPOS_AUTO_RESET`), and a once-per-session batch `resolverAlertasMargemNFUmaVez()` (flag `window._alertasMargemResolvidaFeita`) that **resolves** (not deletes — preserves history) pre-existing open/adiado `pedido_sem_nf` alerts whose offers now fall within the margin.

**Follow-up counts business hours only.** `_horasUteisDecorridas(dataIso)` returns the hours elapsed since `dataIso` excluding Saturdays and Sundays (no holiday table). `verificarAlertaFollowUpRegistro` uses it both for the trigger threshold and for the reminder counter (`Math.floor(horas / intervaloLembrete)`), and for the post-resolution anti-recreation guard. So an offer touched Friday afternoon only fires its follow-up the next business day, not on the weekend. Note: only `followup` uses business hours — `pedido_sem_nf`'s 120h-without-prazo path still uses calendar hours via `diferencaHorasDesdeAlerta`.

When an alert is resolved (directly or via approval), `aplicarEfeitoResolucaoAlerta()` updates the underlying offer field in Firestore so the loop won't immediately re-create the alert.

Alert status flow: `aberto` → `aguardando_aprovacao_resolucao` (user role) or `resolvido` (admin/supervisor) → `resolvido`. Also: `adiado`, `ignorado`, `arquivado` (when offer moves to lixeira).

`criarOuAtualizarAlerta()` only creates a new alert document when the existing one has status `resolvido` or `ignorado` — otherwise it updates in place (preserving status).

**Duplicate alert cleanup:** `buscarAlertaPorChave()` queries without `.limit(1)` and handles multiple docs with the same `chaveUnica` — it keeps the active alert (or most recent if all finalized) and batch-deletes the rest silently. This self-heals accumulated duplicates on the next loop run. But it only runs for the offer's own responsible user (the loop skips others' offers) and the `alertas` delete rule is admin-only — so duplicates created by concurrent writers (same user logged in on two devices firing the loop in the same second) can survive. `deduplicarFollowUpsAtivos()` runs every cycle as a backstop: it groups active `followup` alerts by `entidadeId` in `window.alertasCache` and deletes all but one per offer (highest `lembreteNumero`, then oldest). It's silent (only logs when it actually deletes) and never recreates anything, so it can't loop. For an admin the cache holds every alert, so it cleans everyone's duplicates; the batch delete is wrapped in try/catch for non-admins.

**`resolverAlertaDireto` / `aprovarResolucaoAlerta`:** Look up the alert object from `window.alertasCache` first, then fall back to a Firestore fetch. This avoids a race condition where the cache hasn't updated yet and `aplicarEfeitoResolucaoAlerta` would be skipped.

**`onRegistroSalvoReset`:** Called from `script.js` after saving an offer. Resolves `followup`, `sem_resposta`, and (when NF is present) `pedido_sem_nf` alerts. Writes directly to Firestore — does NOT call `resolverAlertaDireto` to avoid a tab switch side-effect. Passes the already-fetched alert object to `aplicarEfeitoResolucaoAlerta` directly (no cache dependency).

### Offer Lifecycle

Offers live in `ofertas` collection. Soft-delete uses `deletado: true` + `deletadoEm` timestamp (shown in Lixeira UI). Permanent delete removes the document and batch-deletes all related `alertas` docs.

When an offer is saved/edited, `onRegistroSalvoReset()` in `alertas.js` is called to auto-resolve pending `followup`, `sem_resposta`, and `pedido_sem_nf` (when NF exists) alerts for that offer.

### Dashboard (`dashboard.html` / `dashboard.js`)

Separate page. Loads its own Firebase connection. Reads `ofertas`, `clientes`, `representadas`, `projetos` directly and renders Chart.js charts. No shared state with the main app.
