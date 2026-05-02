# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-29T08-01-31-254Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 1/3 operations faster than VDOM, 2/3 operations within noise threshold.
- Vapor vs Solid: 1/3 operations faster than Solid, 2/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 1.3% difference, within noise threshold; scriptingMs 14.3% higher.
- Vapor vs Solid: mainThreadBusyMs 29.6% lower; scriptingMs 80.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   40.96 |     4.33 |        4.65 |              11.75 |               4.01 |             17.71 |               27.9 |        68186 |         26260 |           23865 |
| Vue Vapor |                   40.41 |     4.58 |        4.23 |              13.43 |               4.03 |             18.13 |               81.4 |        49054 |         18523 |           16892 |
| Solid     |                   57.44 |      9.6 |        6.26 |               7.45 |              23.81 |             20.14 |               47.6 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 53.06ms is far from median 40.96ms; run 14 mainThreadBusyMs 32.16ms is far from median 40.96ms
- Vue Vapor: run 9 mainThreadBusyMs 31.01ms is far from median 40.41ms; run 14 mainThreadBusyMs 33.41ms is far from median 40.41ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 6.1% lower; scriptingMs 37.2% lower.
- Vapor vs Solid: mainThreadBusyMs 4.0% difference, within noise threshold; scriptingMs 23.7% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  145.98 |    20.98 |       19.43 |              18.18 |              96.85 |             30.05 |               98.3 |        68186 |         26260 |           23865 |
| Vue Vapor |                  137.06 |    15.25 |       15.06 |              11.42 |               91.6 |                29 |               97.1 |        49054 |         18523 |           16892 |
| Solid     |                  142.83 |     9.69 |       10.42 |               9.23 |              98.87 |             33.76 |               53.9 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 5 mainThreadBusyMs 193.76ms is far from median 145.98ms; run 13 mainThreadBusyMs 190.38ms is far from median 145.98ms; run 15 mainThreadBusyMs 174.92ms is far from median 145.98ms
- Vue Vapor: run 2 mainThreadBusyMs 162.21ms is far from median 137.06ms; run 15 mainThreadBusyMs 171.64ms is far from median 137.06ms
- Solid: run 1 mainThreadBusyMs 164.94ms is far from median 142.83ms; run 2 mainThreadBusyMs 126.87ms is far from median 142.83ms; run 11 mainThreadBusyMs 126.93ms is far from median 142.83ms; run 15 mainThreadBusyMs 159.37ms is far from median 142.83ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 4.7% difference, within noise threshold; scriptingMs 43.4% lower.
- Vapor vs Solid: mainThreadBusyMs 2.5% difference, within noise threshold; scriptingMs 15.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  164.89 |    22.36 |       20.71 |               18.4 |              91.79 |             46.41 |              102.7 |        68186 |         26260 |           23865 |
| Vue Vapor |                  157.12 |    19.21 |       19.25 |              10.41 |              91.86 |             46.81 |              115.1 |        49054 |         18523 |           16892 |
| Solid     |                   153.3 |    16.55 |       17.59 |               9.01 |              90.48 |              47.6 |               54.9 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 8 mainThreadBusyMs 222.57ms is far from median 164.89ms
- Vue Vapor: run 7 mainThreadBusyMs 211.86ms is far from median 157.12ms
- Solid: run 5 mainThreadBusyMs 192.76ms is far from median 153.3ms; run 10 mainThreadBusyMs 200.04ms is far from median 153.3ms
