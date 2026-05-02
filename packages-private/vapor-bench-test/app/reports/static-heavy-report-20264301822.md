# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-04-30T10-23-28-000Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 2.5%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 1.4% difference, within noise threshold; gzip JS 29.7% lower; scriptingMs 13.5% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 2.5% difference, within noise threshold; gzip JS 196.8% higher; scriptingMs 13.5% higher.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vue VDOM | 229.08 | 8.11 | 5.34 | 38.36 | 158.76 | 30.14 | 249.3 | 67224 | 25829 | 23336 |
| Vue Vapor | 225.76 | 3.55 | 6.33 | 33.19 | 158.66 | 30 | 243.7 | 48548 | 18163 | 16399 |
| Solid | 220.15 | 6.48 | 6.27 | 29.24 | 158.45 | 30.29 | 239 | 16188 | 6120 | 5375 |


## Stability Notes

- Vue Vapor: run 6 mainThreadBusyMs 235.81ms is far from median 225.76ms; run 8 mainThreadBusyMs 238.48ms is far from median 225.76ms; run 10 mainThreadBusyMs 212.76ms is far from median 225.76ms; run 11 mainThreadBusyMs 215.72ms is far from median 225.76ms
- Solid: run 8 mainThreadBusyMs 235.21ms is far from median 220.15ms
