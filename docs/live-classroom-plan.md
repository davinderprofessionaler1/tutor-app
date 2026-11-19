# Live Classroom implementation

The module extends the existing Next.js admin, Fastify API and Flutter student app. Existing Roboto/Poppins fonts, blue admin tokens, green mobile colors, shared shells and course records remain in use.

## Baseline and checkpoint

The original workspace typechecks and Flutter login widget test passed before implementation. Branch: `feature/live-classroom`. The source archive, original mobile build changes and existing development data backup are outside the repository in the workspace `.tools/checkpoints/live-classroom-before` directory.

## Architecture

1. Add an isolated Fastify Live Classroom service, authenticated with existing admin sessions and student bearer tokens. Reuse existing students, courses and manually assigned/purchased course access.
2. Add PostgreSQL module tables through a separate, additive SQL migration. The current platform uses a JSON store; only development may use an isolated classroom JSON adapter. Production requires `LIVE_DATABASE_URL`. Existing JSON identities remain application-validated references until the platform's existing data is migrated to PostgreSQL.
3. Add Razorpay for individual classes and existing course packages. No gateway is currently wired to the platform. Verify server-side capture and amount/currency/order ownership; handle signed, idempotent payment/refund webhooks.
4. Add LiveKit self-hosted room management and official browser/Flutter clients. The signaling gateway checks entitlement on every connection, including refreshed JWTs. Issue short-lived receive-only tokens so ICE can negotiate; a signed participant webhook grants publishing permissions after checking a single-use join ticket. Students cannot publish until the teacher grants specific sources.
5. Add Live Classes to the existing admin sidebar and mobile drawer/course details. Reuse the existing UI components and tokens, with module-scoped styles.
6. Add moderation, attendance, reports and in-app notifications with reminder/reconciliation jobs. Prepare independent infrastructure templates and test the feature locally. Do not deploy or claim 100-participant readiness without measured load tests.

## Infrastructure boundaries

Razorpay merchant credentials, signed webhooks, a reachable LiveKit SFU with TLS/TURN and production PostgreSQL are required for production. Real financial transactions are not run during implementation. Recording remains off. The current platform has one admin identity; its authenticated administrator acts as the teacher. This module does not invent a second user or course system.
