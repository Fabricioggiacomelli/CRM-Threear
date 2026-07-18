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

Login flow: Firebase Auth → check `aprovado` + `ativo` in `usuarios` collection → TOTP check via backend API → **backend stamps `mfa`/`mfaExp` custom claims** → client forces `getIdToken(true)` → load app data.

The API base is resolved in `getApiBase()` in `script.js`:
- `localhost` / `127.0.0.1` → `http://127.0.0.1:3001` (local Express server in `backend/`)
- Production → `https://southamerica-east1-crm-three-ar.cloudfunctions.net/api` (Firebase Functions in `functions/`)
- Override with `?api=local` or `?api=prod` query param

**MFA is enforced at the DATA layer, not just the UI.** The two backends share ONE module `functions/mfaCore.js` (`registrarRotasMfa(app, { admin, db, speakeasy, qrcode, limiter })`, deps injected so it resolves in both `node_modules`; backend requires `../functions/mfaCore`, functions requires `./mfaCore`). On a valid TOTP (`/mfa/activate` or `/mfa/verify`), the backend calls `emitirClaims` → `setCustomUserClaims` with `{ role, aprovado, ativo, mfa:true, mfaExp: now+12h }` (re-reads `usuarios` doc since setCustomUserClaims REPLACES all claims). Firestore rules require `mfaOk()` = `request.auth.token.mfa == true && request.auth.token.mfaExp > request.time.toMillis()` on every data collection (via `podeAcessarDados()`) — so email+password alone can't read/write data without a recent TOTP. `usuarios` and `usuarios_mfa` are exempt (usuarios is read in the pre-TOTP bootstrap). Client gate (in `onAuthStateChanged`) requires BOTH `sessionStorage.totpVerified === "1"` AND `mfaClaimValido(user)` (reads the claim via `getIdTokenResult(true)`). The `sessionStorage` half is per-tab (cleared on tab close), so **closing and reopening the CRM re-prompts the TOTP** — a company requirement. It is NOT a security control anymore: setting `sessionStorage.totpVerified` by hand no longer bypasses anything, because data access still needs the real `mfa` claim (enforced by the rules). TTL 12h is the DATA-layer window (max time email+password alone can touch data after the victim's last verify); the per-tab prompt is UX only. Satellite pages (`dashboard.js`/`gerador.js`/`correlacao.js`) each have a local `_mfaClaimOk(user)` and redirect to `index.html` when the claim is missing/expired (they don't host the TOTP modal). True per-session binding of the data layer would need Firebase native MFA (a bigger migration).

**Enrollment is authenticated:** `/mfa/qr`, `/mfa/activate`, `/mfa/verify` require `Authorization: Bearer <idToken>` and check `decoded.email === user` (can only configure your own 2FA). `/mfa/reset` is admin-only (verifies the caller is `role:admin`) and clears the target's `mfa` claim. Client sends the header in `apiGetQr/apiActivate/apiVerify/apiResetMfa`.

**Production hardening (`functions/index.js`):** `express-rate-limit` (20/15min) on the MFA routes — was previously ABSENT in prod; CORS restricted to `crm-three-ar.web.app`/`.firebaseapp.com` (was `origin:true`). **`functions/` needs `npm install`** (added `express-rate-limit`) before the next `firebase deploy --only functions`.

**Firebase App Check** is scaffolded in `firebase.js` (guarded by `APP_CHECK_SITE_KEY`, empty = disabled so nothing breaks) + the `firebase-app-check` SDK is loaded on every page. To turn on: register a reCAPTCHA v3 site key in the Firebase console, paste it into `APP_CHECK_SITE_KEY`, then flip "Enforce".

**⚠️ Deploy order (avoid lockout):** deploy client JS + `backend`/`functions` FIRST (so a TOTP mints the `mfa` claim), confirm an admin can log in + TOTP + load data, THEN `firebase deploy --only firestore:rules`. Deploying the stricter rules before anyone has the claim locks everyone out of data until they re-verify.

**By design (not a bug):** any approved user with a valid MFA session reads ALL `ofertas`/`clientes`/`representadas` — the per-user `podeVerDe` visibility is a UI filter, not a security boundary. Clientes/ofertas are a shared open book for the team.

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

**Obsolete follow-up cleanup.** `verificarAlertaFollowUpRegistro` calls `_resolverFollowUpObsoleto` to resolve a follow-up once its offer hits a status that excludes it (`statusExcluiAlertaOferta`: has a pedido / perdido / declinado / lixeira), but that path only runs for the offer's own responsible user AND the `alertas` update rule lets only admin/supervisor set status to `resolvido` — so ghost follow-ups for regular users' offers got stuck open. `resolverFollowUpsObsoletosGlobal()` runs every cycle as a backstop: it scans `window.alertasCache`, finds active `followup` alerts whose offers now satisfy `statusExcluiAlertaOferta`, and resolves them. Silent (only writes when there's something to fix), idempotent, wrapped in try/catch for non-admins. For an admin the cache holds every alert, so it clears ghosts for all users.

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

### Correlação de Cabos (`correlacao.html` / `correlacao.js`)

Separate page (reached from a sidebar item in `index.html`), same standalone pattern as the generator: loads Firebase SDK + `firebase.js` + `toast.js` + SheetJS (`xlsx-js-style`), with an `onAuthStateChanged` guard that redirects to `index.html` when logged out. Internal tool for Prysmian: upload an `.xlsx` (descriptions in column A, one per row), process in batches, and get a table (rows needing attention highlighted yellow) plus a read-only textarea of codes — one per line, aligned to the original Excel rows (`_corMontarBloco` pads gaps so the user can paste straight into a column) — with a Copy button.

**Backend (Express, `backend/`):** `correlacao.js` loads the price table into an in-memory index keyed by `(produto|condutor|classe|seção)` normalized — `normTexto` strips accents (the sheet stores `ALUMÍNIO`, the model sends `ALUMINIO`), uppercases, collapses spaces; `normSecao` also drops spaces, `mm²`→`mm2`, trailing `,0`. `lookup(attrs)` returns OK / PENDENCIA / AMBIGUO and the code — the code always comes from here, never the model.
- **Table path auto-resolves** (`_resolverCaminhoTabela`): env `TABELA_PATH`, else the most-recent `TABELA USO INTERNO*.xlsx` in the project root — so swapping the spreadsheet (JUNHO26, JULHO26…) just needs dropping the file and a reload, no code change.
- **Columns are detected by header** (`_mapearColunas`), NOT hardcoded indices. It finds the header row (the one with CONDUTOR + CÓDIGO) and maps CÓDIGO/PRODUTO/CLASSE/SEÇÃO/etc. by name. This survived a real layout change where a new spreadsheet shifted every column left by one and moved the header from row 7 to row 6.
- **Lookup fallbacks:** exact key first; on a miss, `_buscarPorPrefixoProduto` matches by product-name prefix + same section/condutor/classe (handles `COBRE NU 1/2 DURO` vs the sheet's `…7F` — "offers by section", flagged in `observacao`). Among remaining ties it prefers unidade **METRO** (cables are quoted per metre; the KG row is bulk).

`correlacao_api.js` calls the Anthropic Messages API per batch with the SKILL (`rules/correlacao_cabos_rules.md`) as a cached system block (`cache_control: ephemeral`) + a short output-format block, parses the JSON attributes, then runs the lookup. **Tolerant parse:** `parseAtributos` falls back to `_extrairAtributosTolerante` (regex per object, drops `observacao`) when `JSON.parse` throws — models sometimes emit unescaped `"` inside `observacao`, which otherwise breaks the WHOLE batch. **Two-pass cost strategy (`processarLote`):** the cheap `CLAUDE_MODEL_RAPIDO` (Haiku) interprets the whole batch first; only the items left PENDENCIA/AMBIGUO are re-interpreted by `CLAUDE_MODEL_FORTE` (Sonnet) and kept if they improved. `_resolverUm` holds the shared defaults+lookup+status logic. **Calibration rules live in the SKILL** (`rules/correlacao_cabos_rules.md`, section "## Regras de calibracao") — the SINGLE source shared by the CRM and the Excel skill; new confirmed cases go there. It holds: default condutor Cobre / cor Preto / embalagem Bobina|Caixa / unidade METRO; fractional MT class → higher voltage (12/20kV → 20kV); MT isolation **XLPE → VOLTALENE** vs **EPR/HEPR → EPRO COMPACT**; MT aluminum name = `EPRO COMPACT Al`; **atox/LSZH → AFUMEX** (not SUPERASTIC/PVC); cobre-nu wire count. **But cor/embalagem defaults are ALSO enforced in the backend** (`_embalagemPadrao` + `_resolverUm`): `INSTRUCOES_SAIDA` tells the model to leave `cor`/`embalagem` NULL when the description doesn't specify, and the backend fills them deterministically — otherwise the model would sometimes fill "Bobina" and miss the 750V→Caixa exception. Only **confiança "baixa"** downgrades an OK to AMBIGUO (média with a unique match stays OK — the code is deterministic). Endpoints in `index.js`: `GET /correlacao/status`, `POST /correlacao/reload`, `POST /correlacao/lote` (`{ descricoes: [{linhaOriginal, descricao}] }`). Key + model come from `backend/.env` (`ANTHROPIC_API_KEY`, `CLAUDE_MODEL`); see `backend/.env.example`. The table and `rules/` are git-ignored (`*.xlsx`) and hosting-ignored (confidential). **Any backend code/spreadsheet change needs a restart (`Ctrl+C` → `npm start`) — it reads the table at startup.**

**Frontend → backend:** `_corProcessar` splits descriptions into batches of `COR_TAM_LOTE` (45) and POSTs each to `_corApiBase()` (`http://127.0.0.1:3001` when on localhost/127.0.0.1). A failed batch marks its rows `ERRO` (yellow) and processing continues. **Header+formation grouping (`_corAgruparFormacoes`, runs on read):** a description line with no bitola of its own acts as a group header, and following lines that are just a formation (`35mm2`, `3x35mm2` — matched by `_corEhSoFormacao`) inherit it (combined into `"<header> <formation>"`); the header row itself is flagged `ehCabecalho`, kept out of the API call, and shown as status `CABECALHO` (gray "Grupo" badge, blank in the copy block). **Local-only for now:** the table/key live on the dev's machine — production would need this ported to a Cloud Function. Run: stop any old `backend` process on :3001, then `cd backend && npm start`, and open the CRM from localhost (not `file://`) so CORS + `_corApiBase` resolve.
