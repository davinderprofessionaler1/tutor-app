# Staged classroom acceptance and load tests

Status: two real endpoints connected locally on 19 November 2026. Teacher camera playback on the physical phone and teacher audio (user-confirmed) were demonstrated. Short isolated synthetic media diagnostics were subsequently run as documented below. Larger full acceptance stages and sustained media measurements have not been performed. Do not treat this as a 100-student certification.

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


## Short isolated SFU diagnostics completed on 19 November 2026

Official LiveKit CLI v2.20.1 against a **separate loopback-only LiveKit v1.13.11 instance** at port 7990, with independent keys and no platform records/webhooks. Media was generated by the CLI, never by a user's camera or microphone. This bypasses application enrollment/admission by design and tests only local SFU/media fan-out. Authenticated control isolation is covered separately by 10/25/50-student mock-SFU service tests, and the admin renderer test confirms all 50 roster cards are included.

| Synthetic workload | Duration after connection | Received tracks | Reported packet loss | Reported aggregate bitrate |
| --- | --- | --- | --- | --- |
| 1 audio/video publisher → 10 subscribers | 30 seconds | 20/20 | 0 / 0% | 2.4 Mbps |
| 1 audio/video publisher → 25 subscribers | 30 seconds | 50/50 | 0 / 0% | 5.9 Mbps |
| 1 audio/video publisher → 50 subscribers | 30 seconds | 100/100 | 0 / 0% | 11.1 Mbps |
| 10 audio/video publishers → 1 gallery subscriber | 20 seconds | 20/20 | 0 / 0% | 1.6 Mbps |

All four CLI commands exited successfully with no subscriber errors. Video used the CLI's low-resolution VP8 profile and simulcast, with the gallery subscriber using the 5×5 layout. Same-host tests omit internet/TURN conditions, real mobile decoding/rendering, all-student cameras at 25/50 scale and sustained server resource limits. Zero packet loss here is not a production reliability claim. The 20-minute stage table above remains unverified.

Reproduction: start a separate loopback-only lab SFU using ports 7990/7991/7993 with fresh keys, then export `LIVEKIT_URL=ws://127.0.0.1:7990`, matching `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`, and `LIVEKIT_CLI=/path/to/official/lk`. Run `scripts/live-classroom-smoke.sh`. It refuses other URLs and bounds each workload to 90 seconds including connection time. Logs default to ignored `.qa/classroom-media`; this run's logs are outside Git under workspace `.tools/livekit/load-*.log`. See [official CLI load-test documentation](https://docs.livekit.io/reference/developer-tools/livekit-cli/perf/).
