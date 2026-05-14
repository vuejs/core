# Generated Code Slope Report

Run: code-slope-2026-05-12T00-09-38-884Z

Build rounds: 3

Counts: 1, 10, 100, 500

## Conclusion

- Vapor generated gzip per component: 1182.5 bytes; VDOM generated gzip per component: 939.9 bytes (25.8% higher).
- Vapor final bundle gzip per component: 37.5 bytes; VDOM final bundle gzip per component: 33.8 bytes (10.9% higher).
- Vapor has lower fixed bundle gzip but higher slope; estimated bundle gzip break-even: 1993 components.

## Per-count Medians

| components | target | generated gzip |   bundle gzip | generated gzip / component | bundle gzip / component | runtime rendered bytes |
| ---------: | ------ | -------------: | ------------: | -------------------------: | ----------------------: | ---------------------: |
|          1 | vdom   |    936.0 bytes | 24674.0 bytes |                936.0 bytes |           24674.0 bytes |         154915.0 bytes |
|          1 | vapor  |   1178.0 bytes | 17304.0 bytes |               1178.0 bytes |           17304.0 bytes |         132735.0 bytes |
|          1 | solid  |    812.0 bytes |  5233.0 bytes |                812.0 bytes |            5233.0 bytes |          27257.0 bytes |
|         10 | vdom   |   9371.0 bytes | 25068.0 bytes |                937.1 bytes |            2506.8 bytes |         154915.0 bytes |
|         10 | vapor  |  11797.0 bytes | 17750.0 bytes |               1179.7 bytes |            1775.0 bytes |         132735.0 bytes |
|         10 | solid  |   8126.0 bytes |  5594.0 bytes |                812.6 bytes |             559.4 bytes |          27257.0 bytes |
|        100 | vdom   |  93899.0 bytes | 28271.0 bytes |                939.0 bytes |             282.7 bytes |         154915.0 bytes |
|        100 | vapor  | 118135.0 bytes | 21620.0 bytes |               1181.4 bytes |             216.2 bytes |         132735.0 bytes |
|        100 | solid  |  81308.0 bytes |  8558.0 bytes |                813.1 bytes |              85.6 bytes |          27257.0 bytes |
|        500 | vdom   | 469956.0 bytes | 41530.0 bytes |                939.9 bytes |              83.1 bytes |         154915.0 bytes |
|        500 | vapor  | 591233.0 bytes | 35997.0 bytes |               1182.5 bytes |              72.0 bytes |         132735.0 bytes |
|        500 | solid  | 407014.0 bytes | 20496.0 bytes |                814.0 bytes |              41.0 bytes |          27257.0 bytes |

## Incremental Slope

| target | generated raw / component | generated gzip / component | generated brotli / component | bundle gzip / component | runtime rendered at max | generated modules / component |
| ------ | ------------------------: | -------------------------: | ---------------------------: | ----------------------: | ----------------------: | ----------------------------: |
| vdom   |              2246.8 bytes |                939.9 bytes |                  818.9 bytes |              33.8 bytes |          154915.0 bytes |                             2 |
| vapor  |              2876.8 bytes |               1182.5 bytes |                 1020.5 bytes |              37.5 bytes |          132735.0 bytes |                             2 |
| solid  |              1922.8 bytes |                814.0 bytes |                  685.1 bytes |              30.6 bytes |           27257.0 bytes |                             1 |
