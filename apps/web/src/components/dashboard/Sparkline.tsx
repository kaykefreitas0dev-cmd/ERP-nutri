"use client";

/**
 * Lightweight inline SVG sparkline — no Recharts dependency.
 *
 * Renders a small area chart for trend data within a MetricCard.
 * Uses a filled path below the line for visual weight.
 */

interface Props {
  /** Raw data points (already in the desired unit). */
  data: number[];
  /** SVG stroke color — defaults to currentColor. */
  color?: string;
  /** Fill color (semi-transparent) — defaults to color at 15% opacity. */
  fillColor?: string;
  /** Height in px (viewBox height). */
  height?: number;
}

export function Sparkline({
  data,
  color = "var(--color-brand-primary)",
  fillColor,
  height = 36,
}: Props) {
  if (data.length < 2) return null;

  const W = 100; // viewBox width (unitless)
  const H = height;
  const n = data.length;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const PAD = 2; // vertical padding so line isn't clipped

  function toX(i: number) {
    return (i / (n - 1)) * W;
  }
  function toY(v: number) {
    return H - PAD - ((v - min) / range) * (H - PAD * 2);
  }

  // Build polyline points
  const pts = data.map((v, i) => `${toX(i).toFixed(2)},${toY(v).toFixed(2)}`);
  const polylinePoints = pts.join(" ");

  // Build closed path for fill (polyline + bottom right → bottom left)
  const fillPath = `M ${pts[0]} ${pts
    .slice(1)
    .map((p) => `L ${p}`)
    .join(" ")} L ${W},${H} L 0,${H} Z`;

  const resolvedFill = fillColor ?? `${color}22`; // ~13% opacity if CSS var

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-full w-full"
      style={{ overflow: "visible" }}
    >
      {/* Fill area */}
      <path d={fillPath} fill={resolvedFill} stroke="none" />

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Last point dot */}
      <circle
        cx={toX(n - 1).toFixed(2)}
        cy={toY(data[n - 1]).toFixed(2)}
        r="2.5"
        fill={color}
        stroke="var(--color-bg-surface)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
