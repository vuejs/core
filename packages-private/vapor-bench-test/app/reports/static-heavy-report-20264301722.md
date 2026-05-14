# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-04-30T09-24-10-080Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.5%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 1.5% difference, within noise threshold; gzip JS 29.7% lower; scriptingMs 20.9% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 0.5% difference, within noise threshold; gzip JS 196.8% higher; scriptingMs 9.4% lower.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  228.91 |     7.74 |        6.84 |              35.64 |             159.56 |             30.02 |            251 |        67224 |         25829 |           23336 |
| Vue Vapor |                  225.47 |    10.05 |        6.69 |               28.2 |             160.35 |             30.05 |          245.8 |        48548 |         18163 |           16399 |
| Solid     |                  224.37 |     9.16 |        5.95 |              31.12 |             160.09 |             30.15 |          241.4 |        16188 |          6120 |            5375 |

## Stability Notes

- Vue VDOM: run 3 mainThreadBusyMs 209.25ms is far from median 228.91ms
- Solid: run 3 mainThreadBusyMs 212.56ms is far from median 224.37ms; run 10 mainThreadBusyMs 214.26ms is far from median 224.37ms; run 15 mainThreadBusyMs 212.8ms is far from median 224.37ms
