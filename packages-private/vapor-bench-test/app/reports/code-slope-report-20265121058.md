# Generated Code Slope Report

Run: code-slope-2026-05-12T02-58-44-271Z

Build rounds: 3

Counts: 1, 10, 100, 500

## Conclusion

- Vapor generated gzip per component: 1184.7 bytes; VDOM generated gzip per component: 939.9 bytes (26.0% higher).
- Vapor final rendered generated code per component: 2216.6 bytes; VDOM final rendered generated code per component: 1818.6 bytes (21.9% higher).
- Vapor final bundle gzip per component: 37.8 bytes; VDOM final bundle gzip per component: 33.8 bytes (11.8% higher).
- Vapor vs Solid generated gzip per component: 1184.7 bytes vs 814.0 bytes (45.5% higher).
- Vapor vs Solid final rendered generated code per component: 2216.6 bytes vs 1561.9 bytes (41.9% higher).
- Vapor vs Solid final bundle gzip per component: 37.8 bytes vs 30.6 bytes (23.5% higher).
- Vapor has lower fixed bundle gzip but higher slope; estimated bundle gzip break-even: 1845 components.

## Per-count Medians

| components | target | generated gzip | final rendered generated |   bundle gzip | generated gzip / component | final rendered generated / component | bundle gzip / component | runtime rendered bytes |
| ---------: | ------ | -------------: | -----------------------: | ------------: | -------------------------: | -----------------------------------: | ----------------------: | ---------------------: |
|          1 | vdom   |    936.0 bytes |             1779.0 bytes | 24674.0 bytes |                936.0 bytes |                         1779.0 bytes |           24674.0 bytes |         154915.0 bytes |
|          1 | vapor  |   1180.0 bytes |             2177.0 bytes | 17300.0 bytes |               1180.0 bytes |                         2177.0 bytes |           17300.0 bytes |         132735.0 bytes |
|          1 | solid  |    812.0 bytes |             1545.0 bytes |  5233.0 bytes |                812.0 bytes |                         1545.0 bytes |            5233.0 bytes |          27257.0 bytes |
|         10 | vdom   |   9371.0 bytes |            17970.0 bytes | 25068.0 bytes |                937.1 bytes |                         1797.0 bytes |            2506.8 bytes |         154915.0 bytes |
|         10 | vapor  |  11817.0 bytes |            21950.0 bytes | 17739.0 bytes |               1181.7 bytes |                         2195.0 bytes |            1773.9 bytes |         132735.0 bytes |
|         10 | solid  |   8126.0 bytes |            15522.0 bytes |  5594.0 bytes |                812.6 bytes |                         1552.2 bytes |             559.4 bytes |          27257.0 bytes |
|        100 | vdom   |  93899.0 bytes |           180870.0 bytes | 28271.0 bytes |                939.0 bytes |                         1808.7 bytes |             282.7 bytes |         154915.0 bytes |
|        100 | vapor  | 118351.0 bytes |           220670.0 bytes | 21645.0 bytes |               1183.5 bytes |                         2206.7 bytes |             216.5 bytes |         132735.0 bytes |
|        100 | solid  |  81308.0 bytes |           155742.0 bytes |  8558.0 bytes |                813.1 bytes |                         1557.4 bytes |              85.6 bytes |          27257.0 bytes |
|        500 | vdom   | 469956.0 bytes |           909270.0 bytes | 41530.0 bytes |                939.9 bytes |                         1818.5 bytes |              83.1 bytes |         154915.0 bytes |
|        500 | vapor  | 592324.0 bytes |          1108270.0 bytes | 36145.0 bytes |               1184.6 bytes |                         2216.5 bytes |              72.3 bytes |         132735.0 bytes |
|        500 | solid  | 407014.0 bytes |           780942.0 bytes | 20496.0 bytes |                814.0 bytes |                         1561.9 bytes |              41.0 bytes |          27257.0 bytes |

## Incremental Slope

| target | generated raw / component | generated gzip / component | generated brotli / component | final rendered generated / component | bundle gzip / component | runtime rendered at max | generated modules / component |
| ------ | ------------------------: | -------------------------: | ---------------------------: | -----------------------------------: | ----------------------: | ----------------------: | ----------------------------: |
| vdom   |              2246.8 bytes |                939.9 bytes |                  818.9 bytes |                         1818.6 bytes |              33.8 bytes |          154915.0 bytes |                             2 |
| vapor  |              2770.8 bytes |               1184.7 bytes |                 1021.7 bytes |                         2216.6 bytes |              37.8 bytes |          132735.0 bytes |                             2 |
| solid  |              1922.8 bytes |                814.0 bytes |                  685.1 bytes |                         1561.9 bytes |              30.6 bytes |           27257.0 bytes |                             1 |
