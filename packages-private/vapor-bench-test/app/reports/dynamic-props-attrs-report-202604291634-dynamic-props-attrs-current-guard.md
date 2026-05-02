# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-29T08-34-31-384Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 3/3 operations faster than Solid.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 1.6% difference, within noise threshold; scriptingMs 10.3% lower.
- Vapor vs Solid: mainThreadBusyMs 37.2% lower; scriptingMs 4.6% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   37.81 |     5.35 |        4.88 |              11.57 |               4.04 |             17.68 |               28.5 |        68186 |         26260 |           23865 |
| Vue Vapor |                   37.19 |     6.78 |        6.33 |              10.38 |                  4 |             17.67 |               79.6 |        49054 |         18523 |           16892 |
| Solid     |                   59.25 |     7.66 |        4.73 |               9.92 |              23.53 |             19.73 |                 47 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 14 mainThreadBusyMs 50.37ms is far from median 37.81ms
- Vue Vapor: mainThreadBusyMs relative stddev is 16.38%; run 14 mainThreadBusyMs 55.59ms is far from median 37.19ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 5.9% lower; scriptingMs 35.4% lower.
- Vapor vs Solid: mainThreadBusyMs 7.0% lower; scriptingMs 14.5% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  142.39 |     14.7 |       17.02 |              16.17 |              91.79 |             29.45 |               98.6 |        68186 |         26260 |           23865 |
| Vue Vapor |                  134.05 |    21.61 |       18.89 |              10.45 |              90.83 |             31.13 |               95.6 |        49054 |         18523 |           16892 |
| Solid     |                  144.07 |    14.03 |        9.64 |               9.13 |              98.42 |              32.6 |               54.4 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 4 mainThreadBusyMs 177.18ms is far from median 142.39ms; run 10 mainThreadBusyMs 187.68ms is far from median 142.39ms
- Vue Vapor: run 8 mainThreadBusyMs 180.2ms is far from median 134.05ms; run 11 mainThreadBusyMs 169.06ms is far from median 134.05ms
- Solid: run 1 mainThreadBusyMs 129.87ms is far from median 144.07ms; run 7 mainThreadBusyMs 129.95ms is far from median 144.07ms; run 10 mainThreadBusyMs 162.07ms is far from median 144.07ms; run 11 mainThreadBusyMs 128.08ms is far from median 144.07ms; run 12 mainThreadBusyMs 131.68ms is far from median 144.07ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 8.0% lower; scriptingMs 47.5% lower.
- Vapor vs Solid: mainThreadBusyMs 6.5% lower; scriptingMs 11.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  162.06 |    13.16 |       10.37 |              18.45 |              91.38 |             44.18 |               97.7 |        68186 |         26260 |           23865 |
| Vue Vapor |                  149.02 |    23.35 |       28.83 |               9.68 |              89.85 |             45.69 |              113.1 |        49054 |         18523 |           16892 |
| Solid     |                  159.36 |    13.63 |       11.95 |                8.7 |              91.96 |             51.12 |               53.8 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 184.75ms is far from median 162.06ms
- Vue Vapor: mainThreadBusyMs relative stddev is 17.98%; run 2 mainThreadBusyMs 196.04ms is far from median 149.02ms; run 8 mainThreadBusyMs 194.78ms is far from median 149.02ms; run 13 mainThreadBusyMs 238.58ms is far from median 149.02ms
- Solid: run 9 mainThreadBusyMs 181.99ms is far from median 159.36ms
