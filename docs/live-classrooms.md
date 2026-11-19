# Live Classroom delivery and operations

Implemented on `feature/live-classroom` in the existing Next.js admin, Fastify API and Flutter Android app. Existing course/student records, login flows, fonts, colors and navigation remain in use. No production deployment, real payment or destructive database operation was performed.

## Delivered functionality

| Surface           | Added behavior                                                                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher admin     | Live Classes sidebar, searchable status listing, create/edit/schedule, time-zone conversion, teacher conflict checks, thumbnail upload, course association, prices, deadlines, capacity, instructions and objectives |
| Course packages   | Group sessions under existing published courses; reuse their existing package prices and ownership                                                                                                                   |
| Teacher classroom | LiveKit connection, camera/mic/screen controls, connection quality, elapsed time, participants, raise-hand requests, source-specific speaking/camera grants, full enrolled student roster, shared teacher/student video gallery, individual session ending, chat pause/hide, leave and end confirmation    |
| Reports           | Class enrollment, individual/course access, payment/refund status, attendance across reconnects, revenue, audit history and CSV export                                                                               |
| Student app       | Existing drawer entry, class discovery/status filters, My Classes, details, both purchase options, included sessions on existing course details, notifications and attendance history                                |
| Student classroom | Teacher video/screen with self-preview in one frame, audio playback, connection quality, timer, participant count, chat, raise hand, teacher-approved camera/mic, background media pause, reconnect and leave                          |
| Notifications     | In-app enrollment/payment confirmation, scheduled-class reminder, start, reschedule, cancellation, completion and refund notices                                                                                     |

The current platform has one admin identity. Its authenticated administrator is the teacher. A multi-teacher account system was not invented or substituted for existing authentication. Optional browser recording and private MP4/WebM upload are available; no paid recording/egress service or paid notification provider was added.

## Razorpay payment models and rules

**Per class:** the API creates an INR order in paise. The official Flutter Razorpay checkout receives the public key and provider order ID. The backend checks callback HMAC and independently fetches the captured payment, matching its order, amount and currency before activating that class enrollment.

**Per course:** the same verified flow records ownership of the existing course. All sessions offering course access become accessible, and existing tutorial authorization also recognizes this ownership. Existing independently assigned course access remains valid. Already accessible classes are not offered another purchase.

Stable checkout receipts, transaction serialization, unique payment IDs and signed webhook receipts prevent duplicate activation. A timed-out create is reconciled by receipt before retry. Pending/failed payments confer no access. Pending checkouts reserve seats for 30 minutes; a course checkout checks every currently scheduled/live included session. This reservation is an application policy, not a Razorpay order expiry; late captures must be included in merchant acceptance testing, and concurrent classroom admission remains capped server-side.

Teacher refunds request a full captured order refund. Access changes after a signed `refund.processed` webhook. Partial refunds retain access; a full refund removes the purchased entitlement while preserving any independent course entitlement. Cancellations close admission and flag captured orders for teacher review; they do not silently issue financial refunds. Payment status appears in Live Classes reports; the original manual Orders ledger remains intact.

No merchant keys were supplied, so real Razorpay order creation, checkout, UPI/card flow, settlement and refunds have **not** been exercised against Razorpay. Provider adapter tests use controlled responses, including bad HMAC, pending capture and mismatched amount cases.

## LiveKit admission and lifecycle

Public signaling must pass through `infra/livekit/signaling-gateway.mjs`. The API validates enrollment, live status, current room epoch, removal and ticket revocation on every HTTP/WebSocket connection, including refreshed LiveKit JWTs. Keep the SFU HTTP port private; exposing it directly bypasses this check.

Initial JWTs last 30 seconds and are receive-only. Subscription is needed for ICE negotiation; there is no initial camera, microphone, data publishing or metadata-edit grant. A signed `participant_joined` webhook consumes the admission ticket and grants the teacher publishing sources, or the student's currently approved camera/microphone sources. Students start with both disabled. Chat uses authenticated application APIs and renders plain text.

Ending/cancelling a class revokes its tickets, closes attendance and removes the SFU room. Failed cleanup is retried. Unexpected SFU room loss rotates the room epoch and permits fresh explicit admission while leaving the teacher's class Live. Duplicate signed participant events are idempotent. Attendance starts from trusted SFU joins, ends on trusted leaves/end, and uses heartbeat reconciliation to bound stale connections.

The teacher gallery shows their own camera alongside each enrolled or historically attending student, with search, connection status, microphone activity, camera preview and enlargement. Approved student audio is attached once, independently of muted video previews. A browser that blocks autoplay offers an explicit audio activation control. Students see the teacher and their own camera in the same frame. Teacher approval permits publishing; each student must still turn their camera/microphone on locally. Camera and microphone can run simultaneously. Android permission dialogs do not stop capture; actual backgrounding still disables both.

`end-student-session` takes a `studentId` and revokes all of that student's tickets for this class, closes their attendance, removes their SFU connections and prevents rejoining this class. The class stays Live for everyone else. Existing course access, purchases and other classes remain intact. Offline enrolled students can also have their session ended. If the SFU is unavailable, revocation is still committed, new admission is denied, and disconnection cleanup is retried. The admin confirmation explains the scope; the student sees “Session ended” without a reconnect or second purchase offer. The full roster, including email addresses, is returned only to the owning teacher, never in student heartbeats.

The browser uses LiveKit's supported dual peer-connection mode for compatibility. Local ICE requires a reachable LAN/media address; a loopback-only SFU media socket cannot serve a physical phone. Production requires public media reachability and TURN fallback.

## Storage and additive migration

Migration: `apps/api/migrations/live/001_live_classrooms.sql`. Run explicitly with `pnpm --filter @tutor/api db:migrate:live` after setting `LIVE_DATABASE_URL` for the intended database. It creates only:

- `live_classes`
- `live_payment_orders`
- `live_class_enrollments`
- `live_join_tickets`
- `live_attendance`
- `live_chat_messages`
- `live_session_events`
- `live_notifications`
- `live_webhook_receipts`

Records use typed application payloads in JSONB with indexed generated keys, module foreign keys, unique enrollment/payment/idempotency/SID constraints and restricted deletion. Existing tables are neither altered nor removed. There is no duplicate course or user table: platform identities still come from the existing JSON store and are application-validated. Cross-platform SQL foreign keys require a separately planned migration of that existing store.

Development uses the isolated `apps/api/data/live-classrooms.json` adapter. Production requires PostgreSQL. If it is unconfigured, Live routes return 503 while existing platform routes continue to run. The PostgreSQL adapter uses a transaction advisory lock for correctness across replicas. It currently reads the module state under that lock; network calls and growing history can increase contention. Benchmark and introduce scoped SQL queries/outbox processing as needed before high-volume rollout. The development file adapter is for one API process only.

## API inventory

Base: `/api/v1/live`. Teacher requests use the existing admin session bearer; student requests use the existing student bearer. Admin UI requests pass through its authenticated, origin-checked `/api/live/*` server proxy.

| Method | Route                                             | Purpose                                        |
| ------ | ------------------------------------------------- | ---------------------------------------------- |
| GET    | `/teacher/classes`, `/teacher/classes/:id`        | Teacher list/details                           |
| POST   | `/teacher/classes`                                | Create draft/scheduled class                   |
| PATCH  | `/teacher/classes/:id`                            | Edit eligible class                            |
| POST   | `/teacher/classes/:id/start`, `/end`, `/cancel`   | Lifecycle                                      |
| POST   | `/teacher/classes/:id/join`, `/interact`          | Teacher admission/heartbeat/chat/leave         |
| POST   | `/teacher/classes/:id/moderate`                   | Media grants, end individual session, remove, pause chat, hide message |
| GET    | `/teacher/classes/:id/students`                   | Teacher-only enrolled/historical student roster |
| GET    | `/teacher/reports`, `/teacher/classes/:id/report` | Summary/enrollment/attendance/payments         |
| POST   | `/teacher/orders/:id/refund`                      | Request full refund                            |
| GET    | `/classes`, `/classes/:id`                        | Student discovery/details/access               |
| POST   | `/classes/:id/checkout`                           | Class or course order                          |
| POST   | `/orders/:id/verify`                              | Verify payment callback                        |
| POST   | `/classes/:id/join`, `/interact`                  | Admission/heartbeat/hand/chat/leave            |
| GET    | `/notifications`, `/history`                      | Student notices/attendance/orders              |
| PATCH  | `/notifications/:id`                              | Mark own notice read                           |
| POST   | `/webhooks/razorpay`, `/webhooks/livekit`         | Signed provider events                         |
| GET    | `/admission`                                      | Gateway token validation; 204 on success       |

## Files and minimal integration changes

New implementation:

- `apps/admin/app/live-classes/{page.tsx,live.css,[id]/page.tsx}`
- `apps/admin/app/api/live/[...path]/route.ts`
- `apps/admin/components/live/{live-class-workspace.tsx,teacher-classroom.tsx,teacher-students.tsx,teacher-recording.tsx}`
- `apps/admin/lib/live-client.ts`
- `apps/api/src/live/{types,store,auth,providers,service,recordings}.ts`
- `apps/api/src/routes/live.ts`, `apps/api/scripts/migrate-live.ts`
- `apps/api/migrations/live/001_live_classrooms.sql`
- `apps/api/test/{live.test.ts,live-postgres.test.ts}`
- `apps/mobile/lib/live/{live_api,live_classes_page,student_classroom}.dart`
- `apps/mobile/test/live_classes_test.dart`
- `infra/livekit/{compose.yml,.env.example,livekit.example.yaml,nginx.example.conf,signaling-gateway.mjs}`
- This guide, `docs/live-classroom-plan.md` and `docs/live-classroom-load-test.md`.

Existing files changed only for integration:

- Admin sidebar: one module link. Admin package: official LiveKit client.
- API `app.ts`: register isolated routes and injectable test service. Student route: include verified live-course ownership in existing course authorization without mutating original assignments.
- Shared contracts: new module types. API package/scripts: SDK, PostgreSQL, migration/tests.
- Mobile `student_app.dart`: drawer entry and course-session widget. Manifest: camera/audio permissions and optional camera hardware. Pubspec/lock: official LiveKit and Razorpay plugins.
- Root environment example, lockfile and ignore rules: configuration/dependencies/local data and secrets exclusions.

Android Gradle settings already had device-build changes before module implementation; these were backed up and preserved separately. No unrelated feature was intentionally removed, rebuilt or redesigned.

## Verification on 19 November 2026

| Check                                                                 | Result                                                                                                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing workspace typecheck and login widget before implementation   | Passed                                                                                                                                                                                            |
| Backend service/HTTP/provider security scenarios                      | 30 passed                                                                                                                                                                                         |
| PostgreSQL migration using PGlite's PostgreSQL engine                 | 1 passed; applied twice, existing table preserved, constraints exercised                                                                                                                          |
| Flutter widget tests including original login                         | 9 passed                                                                                                                                                                                          |
| Workspace TypeScript checks                                           | Passed                                                                                                                                                                                            |
| API and admin production builds                                       | Passed                                                                                                                                                                                            |
| Flutter analyzer                                                      | No errors/warnings; 5 informational Material import deprecations under Flutter 3.50                                                                                                               |
| Android arm64 debug APK                                               | Built and installed with `adb install -r`; existing student login retained                                                                                                                        |
| Actual local LiveKit v1.13.11 + browser teacher + Samsung A12 student | Both connected; excellent displayed connection quality; signed webhooks processed                                                                                                                 |
| Actual device/browser interaction                                     | Raise hand appeared in roster; teacher mic grant changed student control; teacher chat arrived on device; leave/rejoin created separate attendance sessions; teacher End disconnected the student |
| Actual admin attendance report                                        | Aggregated 3m42s for the two student sessions, Offline after end                                                                                                                                  |

A subsequent guided demo on the same date verified real teacher camera playback on Samsung A12 and teacher audio, confirmed by the user after unmuting the laptop system microphone. Both chat directions, hand raise, teacher microphone approval, fresh rejoin and teacher ending the session were demonstrated. A USB reconnection had removed the local ADB reverse mappings; restoring ports 4000/7882/7881 restored the student connection. This was USB development tunnel recovery, not an external-network TURN or automatic-reconnect certification. The demo ended with the phone showing Completed and 5m12s aggregate student attendance across two visits. Camera/microphone capture stopped at end, and the laptop system microphone was returned to its prior muted state.

A further physical-device check verified simultaneous teacher and student cameras on the admin's shared gallery and the phone's teacher/self-preview frame, with the phone microphone publishing at the same time. Admin microphone revocation disabled the phone mic while its camera stayed active, and student video enlargement was checked. The new automated cases cover teacher-only roster access, isolation between students/classes, offline session ending, repeat revocation and SFU failure cleanup. After the user allowed the browser microphone prompt and the laptop system microphone was unmuted, both teacher and student microphones were on simultaneously. The admin audio element was playing and unmuted, and the user explicitly confirmed audible playback in both directions. This is a local two-person test; the classroom was left connected for the requested demo.

Evidence is stored outside Git in workspace `.tools`: `live-admin-connected.png`, `live-admin-attendance.png`, `live-admin-dashboard.png`, `live-student-connected.png`, `live-student-chat.png`, `admin-meet-both-mics-on.png`, `student-meet-gallery.png`, and test/build logs. Credentials and local class data are ignored.

Screen-sharing playback, TURN across external networks, Razorpay merchant sandbox transactions, a network PostgreSQL pool/restart, iOS and 10/25/50/100 participant media tests remain unverified. A two-person connection test is not a media-load result or 100-student readiness claim. See the staged runbook.

## Configuration and deployment preparation

Set API secrets in its ignored environment/secret manager, never Flutter or client JavaScript:

| Variable                                 | Meaning                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `LIVE_DATABASE_URL`                      | Separate explicit PostgreSQL connection for additive module tables  |
| `LIVEKIT_URL`                            | Public **gateway** URL, `wss://classroom.example.com` in production |
| `LIVEKIT_INTERNAL_URL`                   | Private SFU HTTP URL for server-to-server room management           |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`  | Matching private SFU credentials                                    |
| `LIVEKIT_WEBHOOK_ENABLED=true`           | Set only after signed webhook delivery is working                   |
| `LIVEKIT_ADMISSION_ENABLED=true`         | Set only after public signaling uses the gateway                    |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Merchant test credentials first; secret stays server-side           |
| `RAZORPAY_WEBHOOK_SECRET`                | Separate webhook signing secret; required for enabling checkout     |
| `API_INTERNAL_URL`                       | Admin's private API base, including `/api/v1`                       |

Keep existing admin/student session secrets consistent with the current platform. Register Razorpay `payment.captured`, `order.paid`, `payment.failed`, `refund.processed` webhooks at the HTTPS API endpoint. LiveKit sends signed participant and room lifecycle events to its HTTPS API endpoint. Verify both before enabling purchases/admission.

Deployment files are templates, **not a deployed service**:

1. Provision a staging host with measured CPU/RAM and public bandwidth; PostgreSQL with backups; public DNS and valid TLS certificates for signaling and TURN. No free-VPS capacity promise is made.
2. Copy `infra/livekit/.env.example` to an ignored `.env`. Keep the official pinned image; set a private `CLASSROOM_API_URL` reachable from the signaling container. Linux `host.docker.internal` mapping is included for a host-run API. Restrict this API path to the private network where practical.
3. Render `livekit.example.yaml` into ignored `livekit.generated.yaml`, replacing credentials, webhook URL and TURN certificates. Mount real certificates under ignored `certs/`. Never commit these files.
4. Configure the Nginx TLS template to proxy public signaling solely to port 7882. Ports 7880 and 7882 are loopback-bound in Compose; do not publish them publicly. JWT-bearing signaling access logs are disabled in the proxy template.
5. Open TCP 443 for signaling, TCP 7881 for ICE/TCP, UDP 50000–50100 for media, UDP 3478 and TCP 5349 for TURN as configured. NAT/firewall rules must match advertised media addresses. Some restricted networks require TURN/TLS on 443 on a separate address/host; validate the chosen topology rather than assuming 5349 is reachable.
6. After explicit deployment approval, use `docker compose --env-file .env -f compose.yml config` to review the rendered configuration and then start the services. Apply the additive SQL migration explicitly to the intended database. Configure the API/admin with the matching private/public URLs.
7. Check API `/health`, gateway `/health`, signed webhook delivery and real teacher/student media. Gateway health checks process liveness only; they do not prove SFU/database/media health. Scrape SFU Prometheus on private/loopback port 6789 and monitor CPU, RAM, bandwidth, room/participant counts, connection failures, packet loss, webhook failures and database lock latency.
8. Rehearse SFU/API restarts and fresh admission, gateway failure (must deny access), refund revocation and database restore. Keep data backups and infrastructure revisions. Application rollback can leave the new tables intact; do not drop/truncate them.
9. Run the full staged media tests and merchant sandbox acceptance tests. Publish a release APK only after replacing the debug loopback API URL with the production HTTPS API and completing device/network tests. Existing Android cleartext development configuration was preserved; release network policy needs its own review.

Reminder/reconciliation jobs run in the API every 15 seconds. In-app reminders require the API to be running; background delivery while the app is closed is not an FCM/APNs push implementation. Set retention/archival and distributed edge rate limits before public high-volume operation. Recording must be enabled explicitly after obtaining participant permission. Configure persistent recording storage and retention before public rollout.

## Local development and recovery

Use `pnpm dev:api` and `pnpm dev:admin`, then open `/live-classes` in the existing admin. The current local test setup uses an ignored generated SFU configuration and the official downloaded LiveKit binary under workspace `.tools/livekit`, plus the Node signaling gateway. A phone reaches API/signaling through ADB reverse during USB development; media must use a LAN/public address reachable from that phone. The installed APK targets the existing local API on port 4000.

Backups/checkpoints: workspace `.tools/checkpoints/live-classroom-before` contains a source archive, prior-change patch and development data snapshot. Module checkpoints are Git commits on `feature/live-classroom`. No production configuration was replaced and no original database records were deleted.


## Classroom improvements: 19 November 2026

- **Mute all students:** revokes student microphone grants while preserving cameras and the teacher. A failed SFU update is reported as pending, committed as a denied grant for new admission, and retried by reconciliation. Student heartbeats switch off local capture. Individual approval is still required to speak again.
- **Gallery:** pin/unpin the teacher or any student, browser fullscreen/exit including Escape, and active-speaker borders. Every enrolled student remains in the searchable roster; pinning does not exclude the others.
- **Waiting room and lock:** optional per-class teacher controls, off by default. New students request entry without receiving any SFU credentials, and the admin can admit or decline. Lock blocks new students and already-issued unused admission tickets; trusted previous attendance permits reconnects. These controls do not grant paid course access. Pending requests appear only to the owner; leaving the waiting screen cancels a pending request.
- **Recovery:** transient teacher heartbeat failures keep the active SDK connection instead of immediately disconnecting. Initial admin details/roster retry after API outages. Both apps attempt fresh admission after an exhausted SDK connection; retries are bounded. Android uses 2/4/8/15/30-second backoff, waits while backgrounded and never retries ended/removed/declined admission. Fresh connections keep camera and microphone off until explicitly enabled again.
- **Record and download:** the admin can record the current gallery and approved audio, stop, keep a local WebM, then save it for enrolled students. Alternatively upload a WebM/MP4. Recording is opt-in, requires the teacher's participant-permission confirmation and shows a student notice. The teacher heartbeat carries the actual recorder state; a stale recording notice expires within 15 seconds. Browser recording uses existing media, not another camera/mic request. Canvas capture is 1280×720 at 10 FPS, with up to 25 rendered gallery videos; filtered-out previews are excluded. The teacher must keep the tab open, stop and save. Browser memory holds the current clip; recording stops at 90 MB, uploads cap at 100 MB. This is browser recording, not resilient unattended server egress.
- **Private files:** `LIVE_RECORDINGS_DIR` defaults to ignored `apps/api/data/live-recordings`; production needs a persistent private volume, backup and retention policy. Random file names are never served statically. Teacher uploads and student downloads require existing authenticated sessions and current enrollment. Downloads use an Authorization header, not query-string tokens. Android saves to Downloads using its native DownloadManager. Uploads stream to disk, validate a WebM/MP4 container header and remove incomplete/oversized files. Replacement uploads retain older files for safe manual retention; no automatic purge was added.

New routes: POST `/classes/:id/request-entry` with optional `cancel`; teacher moderation actions `mute-all`, `waiting-room`, `lock`, `admit-student`, `deny-student`, `recording`; POST `/teacher/classes/:id/recording`; GET `/teacher/classes/:id/recording` and `/classes/:id/recording`. Additional state uses optional JSON payload fields and existing audit events; no SQL table/schema migration is required.

New tests cover concurrent 10/25/50-student roster/control isolation with a mock SFU, partial mute enforcement recovery, waiting-room authorization/decline/cancel, lock races, private recording HTTP access, invalid/oversized file cleanup, notice expiry, and Android waiting/download UI. All original login and payment tests remain included. These mock-control tests are distinct from media diagnostics in the load-test guide.

Physical verification of these improvements used a separate local “Classroom Improvements Demo”: waiting-room request on Samsung A12 appeared in admin, Admit caused automatic entry, and Mute All disabled the phone microphone while its camera stayed on. Fullscreen/pin was exercised in the browser. A non-personal recording (empty canvas and silence; no user camera/audio) was recorded, stopped, saved through the authenticated proxy and downloaded by the enrolled student. Its phone-file SHA-256 matched the server file. The silent-audio clock fix also covers recording when every microphone is muted. No participant media was recorded during these checks.

Gallery regression command: `pnpm --filter @tutor/api test:live:gallery` (React server renderer with the admin's dedicated JSX test config). Service/recording tests: `pnpm --filter @tutor/api exec node --import tsx test/live.test.ts`. Flutter: `flutter test` under `apps/mobile`. Recording uses the standard browser [canvas capture](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) and [Web Audio stream destination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination) APIs.

A forced SFU disconnection (without removing enrollment or ending the student's session) was also exercised. The phone automatically obtained a new admission ticket, rejoined the still-Live class and created a second attendance visit. Camera/mic remained off on fresh admission. Class lock/unlock was checked in the browser; lock-versus-issued-ticket and returning-student policies are covered by backend tests. This does not certify recovery across external network/TURN outages. The final APK was installed with the existing login retained; recording test files remain private and the laptop's prior mute settings were restored after testing.
