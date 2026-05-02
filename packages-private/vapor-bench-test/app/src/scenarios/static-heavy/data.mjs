export const STATIC_HEAVY_CONFIG = {
  metricCount: 20,
  sectionCount: 100,
  staticItemsPerSection: 20,
}

export function createStaticHeavyData() {
  return {
    metrics: Array.from(
      { length: STATIC_HEAVY_CONFIG.metricCount },
      (_, index) => ({
        id: `metric-${index + 1}`,
        label: `Metric ${index + 1}`,
        value: 1000 + index * 37,
      }),
    ),
    sections: Array.from(
      { length: STATIC_HEAVY_CONFIG.sectionCount },
      (_, index) => ({
        id: `section-${index + 1}`,
        title: `Static region ${index + 1}`,
      }),
    ),
    staticItems: Array.from(
      { length: STATIC_HEAVY_CONFIG.staticItemsPerSection },
      (_, index) => ({
        id: `static-item-${index + 1}`,
      }),
    ),
  }
}
