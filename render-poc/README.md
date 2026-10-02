# Render POC: mock only

This folder is an isolated experiment, not a production migration. It imports
the compiled original HTTP adapter, handler and RAG V1 without copying or changing
their logic. No Gemini gateway, Function entrypoint or real AI SDK is imported.
There are no new dependencies: Node HTTP and the existing functions dependencies
are sufficient. The build compiles functions; it does not deploy anything.

## Modes and local checks

- `SYLVINHO_POC_MODE=health` (default): `/health` is available, CORS and protected
  endpoint errors work, but all bearer tokens are rejected. No Firebase SDK is
  initialized and no credentials are read. A 200 health response only proves HTTP
  process readiness, not Firebase connectivity. This is the initial online mode.
- `SYLVINHO_POC_MODE=emulator`: requires `GCLOUD_PROJECT=demo-sylvinho-render-poc`
  and both emulator hosts on loopback. Not permitted with `RENDER=true`.
  Real Admin token verification and Firestore operations run only on emulators,
  with a fixed mock response. No production mode or ADC fallback is implemented.

From the repository root:

```powershell
npm --prefix functions run build
node --test render-poc/test/adapter.test.cjs tests/rag-v1-paridade.test.mjs
```

To start the health-only server, set nonsecret environment variables in the current
terminal, then run `node render-poc/server.cjs`. `PORT` defaults to 10000. Choose an
unused local port if needed. `GET /health` returns only status and service name.
The server binds to `0.0.0.0` for Render; emulator mode binds to loopback.

For the emulator integration, set `SYLVINHO_POC_MODE=emulator`, the demo project,
and `ASSISTENTE_CORS_ORIGINS=http://localhost:5000,http://127.0.0.1:5000`. Run:

```text
firebase emulators:exec --only auth,firestore --project demo-sylvinho-render-poc --config render-poc/firebase.emulators.json "node render-poc/test/emulators.cjs"
```

Auth uses 9199 and Firestore 8180. The CLI supplies both emulator host variables
to the test. The integration creates an anonymous fake user, a fake conversation
and two fake chunks (active/inactive), verifies a real emulator token, sends HTTP,
checks V1 context and the single bot append, and closes the server.
Use the existing `local-e2e/network-guard.cjs` preload and an isolated CLI home
to block non-loopback access and production ADC during this test.
The POC emulator rules deny all client access; Admin fixture operations bypass
Rules locally. This test does not validate the deployed Firestore Rules.

## Render configuration (not executed)

Source must first be made available in a separately authorized Git publication
or an independently approved deployment artifact. Render cannot deploy uncommitted
local files. Nothing was committed, pushed, or uploaded by this POC.

In the Render dashboard: New -> Web Service -> select the authorized repository
containing both `render-poc/` and the validated `functions/` modules. For the current
repository this is `joaonascimento1b1a2024-commits/tcc-etec-assistente-ia`, but do not
deploy its current remote main as though it already contained these local files.
Prefer a separately authorized POC branch/source; do not change the group's main.

- Name: `sylvinho-render-poc` (or an available unique name).
- Language: Node. Instance type: Free. Auto-deploy: Off.
- Root Directory: leave empty (repository root). Render excludes sibling files
  outside a configured root, so setting `render-poc` would hide `functions/`.
- Build Command: `npm --prefix functions ci --include=dev && npm --prefix functions run build`.
- Start Command: `node render-poc/server.cjs`.
- Health Check Path: `/health`.
- Environment: `NODE_VERSION=24.16.0`, `NODE_ENV=production`,
  `SYLVINHO_POC_MODE=health`.
- `ASSISTENTE_CORS_ORIGINS=https://tcc-ia-d8891.web.app,https://tcc-ia-d8891.firebaseapp.com`.
- Use Render's supplied `PORT`; do not hardcode a different port.
- No Firebase credential or AI key is needed for this online health-only mode.
- Never set emulator variables on Render. Do not add a payment method. Stop if
  the account/service flow requires a card, upgrade, or paid plan.

Local development origins are `http://localhost:5000` and `http://127.0.0.1:5000`.
Use only the two HTTPS Firebase origins in a future public configuration. No `*`.
The original adapter enforces exact Origin and Bearer validation. CORS is not
authentication: clients outside a browser still require a valid verified token.

## Future Firebase Admin outside Google (not enabled)

Admin can run outside Google. Prefer workload identity federation if the host
provides a trustworthy runtime identity. This requires an actual issuer/token
integration; no Render runtime OIDC integration was confirmed here. Do not assume
`applicationDefault()` on Render inherits the local developer ADC.

A documented fallback is a dedicated, minimally privileged service account,
provided manually as a Render Secret File (not a repository file). A future
adapter could use ADC via `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-admin.json`.
The operator would insert the existing authorized credential only in Render's
Environment -> Secret Files UI, never in chat, command arguments or source.
No key was created, opened, copied or configured in this phase.
Project ID is an identifier, not a secret; private key and credential JSON are
secret, and service account email should not be exposed by health responses.

Firestore access needs appropriate IAM (typically `roles/datastore.user` for
reads and conversation writes). Admin bypasses Firestore Rules; this role does
not enforce per-collection access. Do not grant Owner/Editor, Firebase Auth Admin
or arbitrary project-wide privileges by trial and error. Verify token validation
and Firestore permissions separately before enabling any production data access.
Online Auth -> Firestore -> mock writes require separate explicit authorization.

No real AI credential is used here. Any later gateway must read a secret only
at runtime, redact errors, and resolve provider eligibility/privacy first.
Moving Gemini to Render does NOT remove its audience restrictions or free-tier
data handling requirements. The school-audience issue remains unresolved.

## Limits and risks

Render Free sleeps after 15 idle minutes and startup can take about a minute;
the frontend's current 30-second timeout is not a reliable cold-start budget.
Do not automatically resend: the unchanged handler is not request-idempotent,
so a retry after a committed response could append a second bot.
Free has 750 shared instance hours/month, ephemeral filesystem, no persistent
disk and limited bandwidth/build minutes. Excessive outbound database/API traffic
can suspend the service. Do not add keepalive workarounds, paid storage or upgrades.
Without payment method, excess usage can suspend services/builds rather than bill.
Actual account eligibility and any anti-abuse card prompt are not verified.

This POC has a 16 KiB JSON body limit, HTTP timeouts, generic errors and no token,
prompt or credential logging. It is not hardened public production: distributed
rate limiting, abuse controls, credential IAM and deployment behavior remain
future work. The 514 real chunks, production conversations, frontend and Rules
were not accessed or changed. Future frontend work would change only the verified
endpoint first, then test cold starts and error behavior with explicit approval.

## Official references

- https://render.com/docs/free
- https://render.com/docs/web-services
- https://render.com/docs/monorepo-support
- https://render.com/docs/node-version
- https://render.com/docs/configure-environment-variables
- https://firebase.google.com/docs/admin/setup
- https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-providers
- https://ai.google.dev/gemini-api/terms
