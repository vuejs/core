# Component Fanout Report

Scenario: component-fanout

Run: 2026-04-29T04-57-01-058Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 3/3 operations faster than VDOM.
- Vapor vs Solid: 2/3 operations faster than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active child

- Vapor vs VDOM: mainThreadBusyMs 23.9% lower; scriptingMs 64.3% lower.
- Vapor vs Solid: mainThreadBusyMs 0.7% difference, within noise threshold; scriptingMs 119.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   36.73 |      3.5 |        2.44 |              12.41 |               3.55 |             14.84 |               56.7 |        67211 |         25907 |           23552 |
| Vue Vapor |                   27.94 |     2.24 |        1.86 |               4.43 |               3.36 |             14.98 |               23.4 |        47959 |         18128 |           16525 |
| Solid     |                   27.75 |     2.11 |        2.15 |               2.02 |               4.11 |             15.48 |               17.1 |        15768 |          6153 |            5562 |

## Operation: Update shared revision

- Vapor vs VDOM: mainThreadBusyMs 19.6% lower; scriptingMs 78.4% lower.
- Vapor vs Solid: mainThreadBusyMs 14.2% lower; scriptingMs 100.0% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   81.87 |     5.57 |        4.73 |              14.52 |               41.5 |             22.01 |               61.3 |        67211 |         25907 |           23552 |
| Vue Vapor |                   65.79 |     3.66 |        2.79 |               3.14 |               37.5 |             22.28 |               19.6 |        47959 |         18128 |           16525 |
| Solid     |                   76.72 |     2.79 |        2.88 |               1.57 |              45.16 |                26 |               12.2 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 15 mainThreadBusyMs 93.2ms is far from median 81.87ms
- Solid: run 1 mainThreadBusyMs 70.32ms is far from median 76.72ms; run 2 mainThreadBusyMs 82.67ms is far from median 76.72ms

## Operation: Cycle display mode

- Vapor vs VDOM: mainThreadBusyMs 16.0% lower; scriptingMs 70.2% lower.
- Vapor vs Solid: mainThreadBusyMs 5.5% lower; scriptingMs 42.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   95.65 |     4.94 |        4.05 |              12.87 |              45.09 |             29.11 |               64.2 |        67211 |         25907 |           23552 |
| Vue Vapor |                   80.33 |     5.41 |        2.71 |               3.83 |              42.32 |             29.97 |               25.6 |        47959 |         18128 |           16525 |
| Solid     |                   85.05 |     4.85 |        4.52 |               2.69 |              44.14 |             33.16 |               18.6 |        15768 |          6153 |            5562 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 87.24ms is far from median 95.65ms; run 7 mainThreadBusyMs 87.98ms is far from median 95.65ms
- Solid: run 2 mainThreadBusyMs 99.39ms is far from median 85.05ms
