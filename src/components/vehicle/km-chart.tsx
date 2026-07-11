/** Gráfico simple (SVG) de evolución del kilometraje del vehículo. */
export function KmChart({ data }: { data: { km: number; label: string }[] }) {
  if (data.length < 2) {
    return (
      <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
        Todavía no hay suficientes inspecciones para graficar el kilometraje.
      </p>
    );
  }

  const w = 640;
  const h = 160;
  const pad = 28;
  const kms = data.map((d) => d.km);
  const min = Math.min(...kms);
  const max = Math.max(...kms);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - 2 * pad);
  const y = (km: number) => h - pad - ((km - min) / range) * (h - 2 * pad);

  const line = data.map((d, i) => `${x(i)},${y(d.km)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10 p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full min-w-[320px] text-blue-500" role="img" aria-label="Evolución del kilometraje">
        <polygon points={area} fill="currentColor" fillOpacity="0.08" />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.km)} r="3" fill="currentColor" />
          </g>
        ))}
        <text x={pad} y={h - 8} fontSize="10" fill="currentColor" fillOpacity="0.5">
          {min.toLocaleString("es-AR")} km
        </text>
        <text x={w - pad} y={16} fontSize="10" textAnchor="end" fill="currentColor" fillOpacity="0.5">
          {max.toLocaleString("es-AR")} km
        </text>
      </svg>
    </div>
  );
}
