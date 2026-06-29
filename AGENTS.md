# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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
| `followup` | Offer inactive past threshold (24h compra, 48h orcamento, 72h others) | `ultimoFollowUpEm` reset or offer edited |
| `prazo_entrega` | Delivery deadline 15/10/5/3/2/1 days away | Deadline passes or `pedido.entregue = "sim"` |
| `prazo_entrega_atrasado` | Delivery date past + not delivered | `pedido.entregue = "sim"` |
| `sem_resposta` | No update for 5+ days | `atualizadoEm` reset |
| `pedido_sem_nf` | Has order, no NF after 3 days | NF fields populated in `pedido` |

When an alert is resolved (directly or via approval), `aplicarEfeitoResolucaoAlerta()` updates the underlying offer field in Firestore so the loop won't immediately re-create the alert.

Alert status flow: `aberto` → `aguardando_aprovacao_resolucao` (user role) or `resolvido` (admin/supervisor) → `resolvido`. Also: `adiado`, `ignorado`, `arquivado` (when offer moves to lixeira).

`criarOuAtualizarAlerta()` only creates a new alert document when the existing one has status `resolvido` or `ignorado` — otherwise it updates in place (preserving status).

**Duplicate alert cleanup:** `buscarAlertaPorChave()` queries without `.limit(1)` and handles multiple docs with the same `chaveUnica` — it keeps the active alert (or most recent if all finalized) and batch-deletes the rest silently. This self-heals accumulated duplicates on the next loop run.

**`resolverAlertaDireto` / `aprovarResolucaoAlerta`:** Look up the alert object from `window.alertasCache` first, then fall back to a Firestore fetch. This avoids a race condition where the cache hasn't updated yet and `aplicarEfeitoResolucaoAlerta` would be skipped.

**`onRegistroSalvoReset`:** Called from `script.js` after saving an offer. Resolves `followup`, `sem_resposta`, and (when NF is present) `pedido_sem_nf` alerts. Writes directly to Firestore — does NOT call `resolverAlertaDireto` to avoid a tab switch side-effect. Passes the already-fetched alert object to `aplicarEfeitoResolucaoAlerta` directly (no cache dependency).

### Offer Lifecycle

Offers live in `ofertas` collection. Soft-delete uses `deletado: true` + `deletadoEm` timestamp (shown in Lixeira UI). Permanent delete removes the document and batch-deletes all related `alertas` docs.

When an offer is saved/edited, `onRegistroSalvoReset()` in `alertas.js` is called to auto-resolve pending `followup`, `sem_resposta`, and `pedido_sem_nf` (when NF exists) alerts for that offer.

### Dashboard (`dashboard.html` / `dashboard.js`)

Separate page. Loads its own Firebase connection. Reads `ofertas`, `clientes`, `representadas`, `projetos` directly and renders Chart.js charts. No shared state with the main app.
