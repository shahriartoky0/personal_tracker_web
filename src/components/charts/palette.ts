/** Semantic chart colours (CSS variables defined in globals.css, with dark-mode variants). */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
]

export const colorAt = (i: number) => CHART_COLORS[i % CHART_COLORS.length]
