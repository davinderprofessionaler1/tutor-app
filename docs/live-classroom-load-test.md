# Staged classroom acceptance and load tests

Status: two real endpoints connected locally on 19 November 2026. Teacher camera playback on the physical phone and teacher audio (user-confirmed) were demonstrated. Larger stages and sustained media measurements have not been performed. Do not treat this as a 100-student certification.

Use a dedicated staging course, disposable test accounts and Razorpay **test** credentials. Each participant must use normal authenticated app admission, not arbitrary SDK tokens which bypass the enrollment/gateway path. Establish a browser teacher and real Android clients before adding synthetic clients with equivalent subscriptions. Do not run these workloads against production without approval.

| Stage                  | Workload                                                                 | Current result                                                |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 2 endpoints            | One teacher and one student; join, hand, grants, chat, leave/rejoin, end | Connection/control flow and teacher camera/audio passed locally; sustained load not measured. |
| 10 students + teacher  | Teacher mic/camera + screen share; students subscribe to teacher         | Not run                                                       |
| 25 students + teacher  | Above plus chat bursts and individual approved speaking                  | Not run                                                       |
| 50 students + teacher  | Above plus mobile backgrounding, reconnects and two concurrent rooms     | Not run                                                       |
| 100 students + teacher | Above, at capacity, plus denied extra admission                          | Not run                                                       |

For each stage:

1. Confirm signed join events and attendance counts, source-specific SFU grants, no publishing from unapproved students and no access with copied/expired/revoked tokens. Keep teacher camera and microphone off until the person testing explicitly enables capture.
2. Run at least 20 minutes of camera/audio and 10 minutes of screen sharing, including text/slide readability on a physical phone. Test teacher audio alongside screen share. Students should subscribe to teacher tracks; do not turn on every student camera.
3. Record host CPU/RAM with `docker stats`, private SFU Prometheus metrics, NIC bandwidth, API p50/p95/p99 latency, database advisory-lock wait/timeouts, webhook retry/error counts, client RTT/jitter/packet loss and connection quality. Collect aggregate measurements without recording JWTs, secrets or participant media.
4. Measure time to initial picture/audio, media interruption duration, reconnection success/time and teacher controls under load. Test Wi-Fi and mobile data, UDP blocked, ICE/TCP and TURN/TLS fallback. Record device/browser/server versions, CPU/RAM/network capacity, video codecs/resolutions/bitrates, room count and test duration.
5. Reconnect 10% of clients, pause/resume Android, restart the SFU and API separately, interrupt the gateway and test a removed participant with an older refreshed token. Verify fail-closed signaling and fresh explicit admission after an SFU room loss. End the class and prove all clients stop and further admission is denied.
6. Check last-seat concurrency for class and course purchases, late payment capture after the 30-minute reservation window, duplicate callback/webhook delivery, failed-then-captured payment, callback success with delayed webhook, partial/full refunds and cancellation. A provider test payment must match the exact stored order/amount/currency.
7. Verify attendance durations across reconnects, report totals, original course/video/login flows and original platform availability while the Live module is unavailable.

Agree acceptance thresholds before starting. A useful initial review target is zero unauthorized joins/publications, zero duplicate entitlements, no API/database timeouts, sustained host CPU below 70%, at least 30% measured bandwidth headroom, and at least 95% successful reconnects within 10 seconds. Media-quality/latency targets depend on the chosen video profile and network; these targets are proposed gates, not measured results.

Save one report per stage with measured values and defects. Stop progression when a stage fails; fix the bottleneck and repeat that stage. The current module-wide PostgreSQL lock/state reads and synchronous provider calls require particular attention. Larger data histories and concurrent rooms must be included before deciding whether scoped SQL queries, an outbox, Redis routing or additional SFU nodes are needed.

Recording stays disabled. Promotion requires successful merchant sandbox, external-network AV/TURN, recovery and all requested participant stages, plus an explicit deployment decision.
