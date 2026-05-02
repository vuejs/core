# Static-heavy First Screen Report

Scenario: static-heavy

Measurement: first-screen

Run: 2026-04-29T05-28-59-994Z

CPU throttle: 4x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

## Conclusion

- mainThreadBusyMs median: fastest and second-fastest differ by 0.9%, below the 5.0% threshold; no first-screen CPU winner is declared.
- Smallest gzip JS: Solid (6.0 KiB).
- Vue Vapor vs Vue VDOM: mainThreadBusyMs 3.2% difference, within noise threshold; gzip JS 30.1% lower; scriptingMs 6.3% lower.
- Vue Vapor vs Solid: mainThreadBusyMs 0.9% difference, within noise threshold; gzip JS 194.8% higher; scriptingMs 21.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  229.78 |     5.91 |        3.62 |              35.63 |             159.34 |             29.79 |          250.3 |        67224 |         25829 |           23336 |
| Vue Vapor |                  222.32 |     7.97 |        5.53 |               33.4 |              159.7 |             29.64 |          244.9 |        48209 |         18044 |           16276 |
| Solid     |                  220.29 |       16 |        8.75 |              27.52 |             158.79 |              29.9 |          241.1 |        16188 |          6120 |            5375 |

## Stability Notes

- Vue Vapor: run 11 mainThreadBusyMs 234.78ms is far from median 222.32ms
