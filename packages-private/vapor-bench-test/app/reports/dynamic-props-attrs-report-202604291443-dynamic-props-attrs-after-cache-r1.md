# Dynamic Props / Attrs Fallthrough Report

Scenario: dynamic-props-attrs

Run: 2026-04-29T06-43-08-660Z

CPU throttle: 10x

Runs per target: 15

Warmup runs per target: 5

Sampling: 5 warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

- Vapor vs VDOM: 2/3 operations faster than VDOM, 1/3 operations within noise threshold.
- Vapor vs Solid: 2/3 operations faster than Solid, 1/3 operations within noise threshold.
- Scenario conclusion: Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation.

## Operation: Retarget active attrs

- Vapor vs VDOM: mainThreadBusyMs 3.7% difference, within noise threshold; scriptingMs 14.0% lower.
- Vapor vs Solid: mainThreadBusyMs 37.7% lower; scriptingMs 12.3% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                   37.43 |     4.98 |        4.89 |              11.77 |                3.8 |             17.85 |               28.6 |        68186 |         26260 |           23865 |
| Vue Vapor |                   36.03 |      2.8 |        3.86 |              10.12 |               4.16 |             17.16 |               76.8 |        49037 |         18521 |           16892 |
| Solid     |                   57.83 |     4.88 |        6.75 |               9.01 |              22.67 |             20.91 |               46.4 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 1 mainThreadBusyMs 50.69ms is far from median 37.43ms
- Vue Vapor: run 3 mainThreadBusyMs 27.99ms is far from median 36.03ms; run 7 mainThreadBusyMs 46.41ms is far from median 36.03ms
- Solid: run 4 mainThreadBusyMs 68.88ms is far from median 57.83ms; run 9 mainThreadBusyMs 76.46ms is far from median 57.83ms; run 12 mainThreadBusyMs 66.21ms is far from median 57.83ms

## Operation: Update fallthrough attrs

- Vapor vs VDOM: mainThreadBusyMs 10.4% lower; scriptingMs 34.7% lower.
- Vapor vs Solid: mainThreadBusyMs 10.3% lower; scriptingMs 38.4% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  145.17 |     7.56 |        17.5 |              16.29 |              92.98 |              31.4 |               97.7 |        68186 |         26260 |           23865 |
| Vue Vapor |                  130.07 |    17.35 |       12.79 |              10.63 |               89.8 |             27.46 |               94.7 |        49037 |         18521 |           16892 |
| Solid     |                  145.07 |    11.91 |        8.81 |               7.68 |             101.21 |             35.85 |               54.9 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 6 mainThreadBusyMs 99.5ms is far from median 145.17ms; run 9 mainThreadBusyMs 130.27ms is far from median 145.17ms; run 12 mainThreadBusyMs 183.93ms is far from median 145.17ms; run 13 mainThreadBusyMs 131.07ms is far from median 145.17ms
- Vue Vapor: run 6 mainThreadBusyMs 163.1ms is far from median 130.07ms
- Solid: run 7 mainThreadBusyMs 164ms is far from median 145.07ms

## Operation: Rotate prop bag

- Vapor vs VDOM: mainThreadBusyMs 6.1% lower; scriptingMs 50.2% lower.
- Vapor vs Solid: mainThreadBusyMs 1.3% difference, within noise threshold; scriptingMs 24.8% higher.

| Target    | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | operationMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --------- | ----------------------: | -------: | ----------: | -----------------: | -----------------: | ----------------: | -----------------: | -----------: | ------------: | --------------: |
| Vue VDOM  |                  165.81 |     26.6 |       20.09 |               18.5 |              92.07 |             45.78 |               97.8 |        68186 |         26260 |           23865 |
| Vue Vapor |                  155.69 |    33.43 |       18.68 |               9.22 |              88.67 |              48.6 |              111.4 |        49037 |         18521 |           16892 |
| Solid     |                  157.76 |     18.8 |       15.95 |               7.39 |              92.85 |             52.68 |               52.9 |        18807 |          7294 |            6592 |

### Stability Notes

- Vue VDOM: run 12 mainThreadBusyMs 210.63ms is far from median 165.81ms
- Solid: run 8 mainThreadBusyMs 197.41ms is far from median 157.76ms
