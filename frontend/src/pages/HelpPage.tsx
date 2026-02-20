// ============================================================================
// HelpPage — Documentação de uso do sistema Nightscout Modern
// Índice lateral + scrollspy + ilustrações SVG + conteúdo clínico
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, HelpCircle, Activity, Calendar, BarChart2, Clock,
         BarChart, BookOpenCheck, Utensils, FileText, TrendingUp,
         Syringe, Settings, ChevronRight } from 'lucide-react';

// ============================================================================
// TOC — Fonte única de verdade para sidebar e âncoras
// ============================================================================

interface TocChild { id: string; label: string }
interface TocSection { id: string; label: string; icon: React.ReactNode; children: TocChild[] }

const TOC: TocSection[] = [
  {
    id: 's-dashboard', label: 'Dashboard', icon: <Activity className="h-3.5 w-3.5" />,
    children: [
      { id: 's-glicose-atual',  label: 'Glicose Atual' },
      { id: 's-grafico',        label: 'Gráfico de Glicose' },
      { id: 's-tir',            label: 'Time in Range' },
      { id: 's-padrao-diario',  label: 'Padrão Diário' },
      { id: 's-estatisticas',   label: 'Estatísticas' },
      { id: 's-comparacao',     label: 'Comparação de Períodos' },
      { id: 's-iob-cob',        label: 'IOB & COB' },
      { id: 's-alertas',        label: 'Alertas de Padrões' },
    ],
  },
  { id: 's-calendario',   label: 'Calendário Mensal',    icon: <Calendar className="h-3.5 w-3.5" />,    children: [] },
  { id: 's-semanal',      label: 'Resumo Semanal',       icon: <BarChart2 className="h-3.5 w-3.5" />,   children: [] },
  { id: 's-horarias',     label: 'Stats Horárias',       icon: <Clock className="h-3.5 w-3.5" />,       children: [] },
  { id: 's-distribuicao', label: 'Distribuição',         icon: <BarChart className="h-3.5 w-3.5" />,    children: [] },
  { id: 's-log-diario',   label: 'Log Diário',           icon: <BookOpenCheck className="h-3.5 w-3.5" />, children: [] },
  { id: 's-refeicoes',    label: 'Padrões de Refeição',  icon: <Utensils className="h-3.5 w-3.5" />,    children: [] },
  { id: 's-agp',          label: 'Relatório AGP',        icon: <FileText className="h-3.5 w-3.5" />,    children: [] },
  { id: 's-spaghetti',    label: 'Spaghetti Semanal',    icon: <TrendingUp className="h-3.5 w-3.5" />,  children: [] },
  { id: 's-careportal',   label: 'Careportal',           icon: <Syringe className="h-3.5 w-3.5" />,     children: [] },
  { id: 's-configuracoes', label: 'Configurações',       icon: <Settings className="h-3.5 w-3.5" />,    children: [] },
  { id: 's-glossario',    label: 'Glossário Clínico',    icon: <BookOpen className="h-3.5 w-3.5" />,    children: [] },
];

const ALL_IDS = TOC.flatMap(s => [s.id, ...s.children.map(c => c.id)]);

// ============================================================================
// SVG Illustrations
// ============================================================================

function IllustrationWrap({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="my-5 rounded-xl border border-border bg-muted/20 overflow-hidden">
      <div className="p-3">{children}</div>
      {label && <p className="text-center text-xs text-muted-foreground pb-2">{label}</p>}
    </div>
  );
}

// Gráfico de glicose — área com curva e zonas coloridas
function GlucoseAreaSVG() {
  const W = 500, H = 130;
  // Y mapping: mgdl → svgY. Range 40–350 → H-5 → 5
  const toY = (mg: number) => H - 5 - ((mg - 40) / 310) * (H - 10);
  const low = toY(70), high = toY(180), vhigh = toY(250), vlow = toY(54);
  // Simulated glucose: starts 118, dips 95, meal spike 220, back to 145, 115
  const pts = [
    [0, 118], [50, 110], [90, 95], [130, 100], [175, 118], [210, 145],
    [240, 190], [265, 225], [280, 222], [300, 205], [330, 182],
    [360, 165], [400, 150], [440, 138], [500, 125],
  ].map(([x, mg]) => [x, toY(mg)]);
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const fullAreaPath = `M0,${H} L${pts[0][0]},${pts[0][1]} ${pts.map(([x, y], i) => i === 0 ? '' : `L${x},${y}`).join(' ')} L${W},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
      {/* Zone backgrounds */}
      <rect x="0" y="0" width={W} height={vhigh} fill="#ef4444" fillOpacity="0.10" />
      <rect x="0" y={vhigh} width={W} height={high - vhigh} fill="#f59e0b" fillOpacity="0.12" />
      <rect x="0" y={high} width={W} height={low - high} fill="#22c55e" fillOpacity="0.12" />
      <rect x="0" y={low} width={W} height={vlow - low} fill="#f97316" fillOpacity="0.15" />
      <rect x="0" y={vlow} width={W} height={H - vlow} fill="#ef4444" fillOpacity="0.18" />
      {/* Threshold lines */}
      <line x1="0" y1={high} x2={W} y2={high} stroke="#16a34a" strokeDasharray="5 3" strokeWidth="1" />
      <line x1="0" y1={low}  x2={W} y2={low}  stroke="#f97316" strokeDasharray="5 3" strokeWidth="1" />
      {/* Area fill */}
      <path d={fullAreaPath} fill="#3b82f6" fillOpacity="0.12" />
      {/* Glucose line */}
      <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" />
      {/* AR2 prediction (dashed) */}
      <path d={`M${pts[pts.length-1][0]},${pts[pts.length-1][1]} C520,${pts[pts.length-1][1]-5} 540,${pts[pts.length-1][1]-10} 560,${pts[pts.length-1][1]-8}`}
        fill="none" stroke="#94a3b8" strokeDasharray="4 3" strokeWidth="1.5" />
      {/* Treatment marker */}
      <circle cx="220" cy={toY(118)} r="4" fill="#6366f1" opacity="0.9" />
      <line x1="220" y1={toY(118)} x2="220" y2={H} stroke="#6366f1" strokeDasharray="2 2" strokeWidth="1" opacity="0.5" />
      {/* Labels */}
      <text x="8" y={high - 3} fontSize="9" fill="#16a34a">180</text>
      <text x="8" y={low + 9} fontSize="9" fill="#f97316">70</text>
      <text x="490" y={toY(135)} fontSize="9" fill="#64748b" textAnchor="end">Previsão AR2</text>
    </svg>
  );
}

// Barra TIR horizontal
function TIRBarSVG() {
  const zones = [
    { pct: 2,  color: '#ef4444', label: 'Muito\nBaixo', sub: '<1%' },
    { pct: 4,  color: '#f97316', label: 'Baixo',        sub: '<4%' },
    { pct: 72, color: '#22c55e', label: 'No Alvo',      sub: '>70%' },
    { pct: 18, color: '#f59e0b', label: 'Alto',         sub: '<25%' },
    { pct: 4,  color: '#ef4444', label: 'M. Alto',      sub: '<5%' },
  ];
  const W = 500, BAR_H = 36, Y_BAR = 16;
  let x = 0;
  return (
    <svg viewBox={`0 0 ${W} 80`} className="w-full" style={{ height: 80 }}>
      {zones.map((z, i) => {
        const w = (z.pct / 100) * W;
        const rect = <g key={i}>
          <rect x={x} y={Y_BAR} width={w} height={BAR_H} fill={z.color} rx={i === 0 ? 4 : i === zones.length - 1 ? 4 : 0} />
          {w > 30 && <text x={x + w / 2} y={Y_BAR + BAR_H / 2 + 4} textAnchor="middle" fontSize="10" fill="white" fontWeight="600">{z.pct}%</text>}
        </g>;
        x += w;
        return rect;
      })}
      {/* Legend */}
      {zones.map((z, i) => {
        const cx = (zones.slice(0, i).reduce((s, zz) => s + zz.pct, 0) + z.pct / 2) / 100 * W;
        return <text key={i} x={cx} y={68} textAnchor="middle" fontSize="8.5" fill={z.color} fontWeight="600">{z.sub}</text>;
      })}
      {zones.map((z, i) => {
        const cx = (zones.slice(0, i).reduce((s, z) => s + z.pct, 0) + z.pct / 2) / 100 * W;
        const label = z.label.split('\n');
        return <text key={i} x={cx} y={Y_BAR - 4} textAnchor="middle" fontSize="8" fill="#64748b">{label[0]}</text>;
      })}
    </svg>
  );
}

// Calendário heatmap
function CalendarHeatmapSVG() {
  const W = 500, CELL = 62, GAP = 4;
  const values = [
    null,null,null,null,null,  7,   6,
    5,   6,   7,   8,   9,   10,  11,
    12,  13,  14,  15,  16,  17,  18,
    19,  20,  21,  22,  23,  24,  25,
    26,  27,  28,
  ];
  const glucoses = [134,145,120,162,190,155,138,175,210,128,145,132,119,
                    168,145,182,135,115,148,201,162,138,145,120,175,155,140,168];
  const zone = (mg: number) =>
    mg < 70 ? '#f97316' : mg <= 180 ? '#22c55e' : mg <= 250 ? '#f59e0b' : '#ef4444';
  const days = ['D','S','T','Q','Q','S','S'];
  return (
    <svg viewBox={`0 0 ${W} 200`} className="w-full" style={{ height: 200 }}>
      {days.map((d, i) => (
        <text key={i} x={i * (CELL + GAP) + CELL / 2} y={14} textAnchor="middle" fontSize="11" fill="#94a3b8" fontWeight="600">{d}</text>
      ))}
      {values.map((v, i) => {
        const row = Math.floor(i / 7), col = i % 7;
        const x = col * (CELL + GAP), y = row * (CELL + GAP) + 20;
        const gi = i - (values.indexOf(values.find(v => v !== null)!));
        const mg = glucoses[gi < 0 ? 0 : gi >= glucoses.length ? glucoses.length - 1 : gi] ?? 145;
        if (v === null) return <rect key={i} x={x} y={y} width={CELL} height={CELL} rx="6" fill="transparent" />;
        const c = zone(mg);
        return (
          <g key={i}>
            <rect x={x} y={y} width={CELL} height={CELL} rx="6" fill={c} fillOpacity="0.18" stroke={c} strokeOpacity="0.35" strokeWidth="1" />
            <text x={x + 8} y={y + 16} fontSize="11" fill="#64748b" fontWeight="600">{v}</text>
            <text x={x + CELL / 2} y={y + CELL / 2 + 6} textAnchor="middle" fontSize="11" fill={c} fontWeight="700">{mg}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Box plot horário
function BoxPlotSVG() {
  const W = 500, H = 130, PAD_L = 30, PAD_B = 20;
  const iW = W - PAD_L - 10, iH = H - PAD_B - 5;
  const toY = (mg: number) => iH - ((mg - 40) / 310) * iH + 5;
  const low70 = toY(70), high180 = toY(180);
  const hours = [
    { h: '00h', p10: 85,  p25: 100, med: 118, p75: 138, p90: 158 },
    { h: '03h', p10: 70,  p25: 85,  med: 100, p75: 125, p90: 148 },
    { h: '06h', p10: 90,  p25: 108, med: 130, p75: 158, p90: 185 },
    { h: '09h', p10: 115, p25: 138, med: 162, p75: 195, p90: 225 },
    { h: '12h', p10: 95,  p25: 118, med: 145, p75: 178, p90: 210 },
    { h: '15h', p10: 88,  p25: 110, med: 135, p75: 162, p90: 190 },
    { h: '18h', p10: 110, p25: 135, med: 168, p75: 205, p90: 238 },
    { h: '21h', p10: 100, p25: 122, med: 145, p75: 175, p90: 200 },
  ];
  const step = iW / hours.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
      {/* Zones */}
      <rect x={PAD_L} y={5} width={iW} height={high180 - 5} fill="#f59e0b" fillOpacity="0.08" />
      <rect x={PAD_L} y={high180} width={iW} height={low70 - high180} fill="#22c55e" fillOpacity="0.08" />
      <rect x={PAD_L} y={low70} width={iW} height={iH - low70 + 5} fill="#f97316" fillOpacity="0.10" />
      {/* Thresholds */}
      <line x1={PAD_L} y1={high180} x2={W - 10} y2={high180} stroke="#16a34a" strokeDasharray="4 2" strokeWidth="1" />
      <line x1={PAD_L} y1={low70}  x2={W - 10} y2={low70}  stroke="#f97316" strokeDasharray="4 2" strokeWidth="1" />
      <text x={PAD_L - 4} y={high180 + 4} fontSize="8" fill="#16a34a" textAnchor="end">180</text>
      <text x={PAD_L - 4} y={low70 + 4}   fontSize="8" fill="#f97316" textAnchor="end">70</text>
      {/* Box plots */}
      {hours.map((hp, i) => {
        const cx = PAD_L + i * step + step / 2;
        const bw = step * 0.45;
        const yp10 = toY(hp.p10), yp25 = toY(hp.p25), ymed = toY(hp.med), yp75 = toY(hp.p75), yp90 = toY(hp.p90);
        const col = hp.med < 70 ? '#f97316' : hp.med > 180 ? '#f59e0b' : '#22c55e';
        return (
          <g key={i}>
            <line x1={cx} y1={yp10} x2={cx} y2={yp90} stroke={col} strokeWidth="1.5" opacity="0.6" />
            <line x1={cx - bw / 3} y1={yp10} x2={cx + bw / 3} y2={yp10} stroke={col} strokeWidth="1.5" />
            <line x1={cx - bw / 3} y1={yp90} x2={cx + bw / 3} y2={yp90} stroke={col} strokeWidth="1.5" />
            <rect x={cx - bw / 2} y={yp25} width={bw} height={yp75 - yp25} fill={col} fillOpacity="0.15" stroke={col} strokeWidth="1.5" rx="2" />
            <line x1={cx - bw / 2} y1={ymed} x2={cx + bw / 2} y2={ymed} stroke={col} strokeWidth="2.5" />
            <text x={cx} y={iH + 18} textAnchor="middle" fontSize="9" fill="#94a3b8">{hp.h}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Histograma de distribuição
function HistogramSVG() {
  const W = 500, H = 120, PAD_L = 8, PAD_B = 22;
  const bins = [
    { r: '40–70',   pct: 3,  color: '#f97316' },
    { r: '70–100',  pct: 14, color: '#22c55e' },
    { r: '100–130', pct: 28, color: '#22c55e' },
    { r: '130–160', pct: 22, color: '#22c55e' },
    { r: '160–180', pct: 12, color: '#22c55e' },
    { r: '180–210', pct: 11, color: '#f59e0b' },
    { r: '210–250', pct: 7,  color: '#f59e0b' },
    { r: '250+',    pct: 3,  color: '#ef4444' },
  ];
  const maxPct = 30;
  const step = (W - PAD_L) / bins.length;
  const iH = H - PAD_B;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      {bins.map((b, i) => {
        const x = PAD_L + i * step + 2;
        const bh = (b.pct / maxPct) * iH;
        const y = iH - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={step - 4} height={bh} fill={b.color} fillOpacity="0.6" rx="2" />
            <text x={x + (step - 4) / 2} y={y - 2} textAnchor="middle" fontSize="9" fill={b.color} fontWeight="600">{b.pct}%</text>
            <text x={x + (step - 4) / 2} y={H - 5} textAnchor="middle" fontSize="8" fill="#94a3b8" transform={`rotate(-25, ${x + (step - 4) / 2}, ${H - 5})`}>{b.r}</text>
          </g>
        );
      })}
      {/* Baseline */}
      <line x1={PAD_L} y1={iH} x2={W} y2={iH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

// Correlação de refeições: pré → +1h → +2h por período do dia
function MealCorrelationSVG() {
  const W = 500, H = 140;
  const xPoints = [60, 210, 440]; // pré, +1h, +2h
  const series = [
    { label: 'Café da Manhã', color: '#f59e0b', vals: [115, 185, 152] },
    { label: 'Almoço',        color: '#3b82f6', vals: [128, 210, 165] },
    { label: 'Lanche',        color: '#10b981', vals: [105, 168, 138] },
    { label: 'Jantar',        color: '#8b5cf6', vals: [122, 198, 175] },
  ];
  const toY = (mg: number) => H - 20 - ((mg - 60) / 200) * (H - 40);
  const high = toY(180);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
      {/* Grid */}
      <line x1={50} y1={high} x2={W - 10} y2={high} stroke="#16a34a" strokeDasharray="4 2" strokeWidth="1" />
      <text x={52} y={high - 3} fontSize="9" fill="#16a34a">180 mg/dL</text>
      {/* X axis labels */}
      {['Pré', '+1 hora', '+2 horas'].map((l, i) => (
        <text key={i} x={xPoints[i]} y={H - 4} textAnchor="middle" fontSize="10" fill="#64748b">{l}</text>
      ))}
      {/* Lines */}
      {series.map((s, si) => {
        const pts = xPoints.map((x, i) => [x, toY(s.vals[i])]);
        const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
        return (
          <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2" />
            {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={s.color} />)}
          </g>
        );
      })}
      {/* Legend */}
      {series.map((s, i) => (
        <g key={i}>
          <circle cx={10 + i * 120} cy={12} r="4" fill={s.color} />
          <text x={18 + i * 120} y={16} fontSize="9" fill="#64748b">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

// AGP — bandas de percentis
function AGPBandsSVG() {
  const W = 500, H = 140;
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const toX = (h: number) => 30 + (h / 24) * (W - 40);
  const toY = (mg: number) => H - 20 - ((mg - 40) / 310) * (H - 40);
  // Simulated percentiles per hour
  const data = hours.map(h => {
    const base = 135 + Math.sin((h - 3) * Math.PI / 12) * 25 + (h >= 5 && h <= 8 ? 20 : 0);
    return {
      p5:  Math.max(60,  base - 55),
      p25: Math.max(75,  base - 32),
      p50: base,
      p75: Math.min(260, base + 32),
      p95: Math.min(290, base + 55),
    };
  });
  const low70 = toY(70), high180 = toY(180);
  const buildPath = (vals: number[], reverse = false) => {
    const pts = hours.map((h, i) => [toX(h), toY(vals[i])]);
    if (reverse) pts.reverse();
    return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  };
  const p5Path  = buildPath(data.map(d => d.p5));
  const p25Path = buildPath(data.map(d => d.p25));
  const p50Path = buildPath(data.map(d => d.p50));
  const outerArea = `${p5Path} ${buildPath(data.map(d => d.p95), true)} Z`;
  const iqrArea   = `${p25Path} ${buildPath(data.map(d => d.p75), true)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
      <line x1={30} y1={high180} x2={W - 10} y2={high180} stroke="#16a34a" strokeDasharray="4 2" strokeWidth="1" />
      <line x1={30} y1={low70}  x2={W - 10} y2={low70}   stroke="#f97316" strokeDasharray="4 2" strokeWidth="1" />
      <text x={32} y={high180 - 3} fontSize="9" fill="#16a34a">180</text>
      <text x={32} y={low70  + 10} fontSize="9" fill="#f97316">70</text>
      <path d={outerArea} fill="#3b82f6" fillOpacity="0.10" />
      <path d={iqrArea}   fill="#3b82f6" fillOpacity="0.20" />
      <path d={p50Path}   fill="none"    stroke="#3b82f6" strokeWidth="2.5" />
      {[0, 6, 12, 18, 24].map(h => (
        <text key={h} x={toX(h)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">{`${String(h).padStart(2,'0')}h`}</text>
      ))}
      {/* Legend */}
      <rect x={W - 130} y={8} width={10} height={10} fill="#3b82f6" fillOpacity="0.10" stroke="#3b82f6" strokeWidth="1" />
      <text x={W - 117} y={17} fontSize="9" fill="#64748b">P5–P95</text>
      <rect x={W - 80} y={8} width={10} height={10} fill="#3b82f6" fillOpacity="0.25" stroke="#3b82f6" strokeWidth="1" />
      <text x={W - 67} y={17} fontSize="9" fill="#64748b">P25–P75</text>
    </svg>
  );
}

// Spaghetti — traçados sobrepostos
function SpaghettiSVG() {
  const W = 500, H = 130;
  const toX = (min: number) => 20 + (min / 1440) * (W - 30);
  const toY = (mg: number) => H - 15 - ((mg - 40) / 310) * (H - 25);
  const low70 = toY(70), high180 = toY(180);
  const colors = ['#3b82f6','#22c55e','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#f97316'];
  const offsets = [0, 12, -8, 18, -5, 10, -15];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
      <line x1={20} y1={high180} x2={W - 10} y2={high180} stroke="#16a34a" strokeDasharray="4 2" strokeWidth="1" />
      <line x1={20} y1={low70}   x2={W - 10} y2={low70}   stroke="#f97316" strokeDasharray="4 2" strokeWidth="1" />
      {colors.map((col, si) => {
        const off = offsets[si];
        const pts = [0,60,120,200,280,360,450,540,660,780,900,1020,1140,1260,1380,1440].map(min => {
          const base = 135 + Math.sin((min / 1440) * 2 * Math.PI - 1) * 30 + off;
          const spike = min > 700 && min < 900 ? 55 + off * 0.5 : 0;
          return [min, base + spike];
        });
        const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${toX(x)},${toY(y)}`).join(' ');
        return <path key={si} d={path} fill="none" stroke={col} strokeWidth="1.5" opacity="0.8" />;
      })}
      {[0,6,12,18,24].map(h => (
        <text key={h} x={toX(h * 60)} y={H - 2} textAnchor="middle" fontSize="9" fill="#94a3b8">{`${String(h).padStart(2,'0')}h`}</text>
      ))}
    </svg>
  );
}

// Resumo semanal — sparklines
function WeeklySVG() {
  const W = 500, H = 100;
  const days = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const avgs  = [138, 155, 120, 168, 145, 182, 130];
  const zone = (v: number) => v < 70 ? '#f97316' : v <= 180 ? '#22c55e' : '#f59e0b';
  const sw = W / 7;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      {days.map((d, i) => {
        const x = i * sw;
        const col = zone(avgs[i]);
        // mini sparkline (simplified sine)
        const pts = Array.from({ length: 8 }, (_, j) => {
          const mg = avgs[i] + Math.sin(j * 0.8 + i) * 20;
          const px = x + 4 + (j / 7) * (sw - 8);
          const py = H - 30 - ((mg - 60) / 200) * (H - 50);
          return [px, py];
        });
        const path = pts.map(([px, py], j) => `${j === 0 ? 'M' : 'L'}${px},${py}`).join(' ');
        return (
          <g key={i}>
            <rect x={x + 2} y={0} width={sw - 4} height={H - 20} rx="4" fill={col} fillOpacity="0.06" stroke={col} strokeOpacity="0.2" strokeWidth="1" />
            <path d={path} fill="none" stroke={col} strokeWidth="1.5" />
            <text x={x + sw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b">{d}</text>
            <text x={x + sw / 2} y={H - 17} textAnchor="middle" fontSize="10" fill={col} fontWeight="700">{avgs[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================================
// Auxiliares de layout
// ============================================================================

function ClinicalNote({ type = 'info', title, children }: {
  type?: 'info' | 'tip' | 'warning';
  title: string;
  children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    info:    'border-blue-400  bg-blue-50  dark:bg-blue-950/30  text-blue-700  dark:text-blue-300',
    tip:     'border-green-400 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300',
    warning: 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
  };
  return (
    <div className={`my-4 border-l-4 rounded-r-lg p-3 text-sm ${colors[type]}`}>
      <p className="font-semibold mb-1">{title}</p>
      <div className="opacity-90">{children}</div>
    </div>
  );
}

function SectionH2({ id, label, icon }: { id: string; label: string; icon?: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-xl font-bold text-foreground pt-2 mb-3 border-b border-border pb-2 scroll-mt-20">
      {icon && <span className="text-primary">{icon}</span>}
      {label}
    </h2>
  );
}

function SectionH3({ id, label }: { id: string; label: string }) {
  return (
    <h3 id={id} className="text-base font-semibold text-foreground mt-6 mb-2 scroll-mt-20">
      {label}
    </h3>
  );
}

function MetaTable({ rows }: { rows: { indicator: string; target: string; note?: string }[] }) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left py-1.5 pr-4">Indicador</th>
            <th className="text-left pr-4">Meta</th>
            <th className="text-left">Observação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/40 hover:bg-muted/20 text-sm">
              <td className="py-1.5 pr-4 font-medium">{r.indicator}</td>
              <td className="pr-4 text-green-600 dark:text-green-400 font-semibold">{r.target}</td>
              <td className="text-muted-foreground text-xs">{r.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono rounded border border-border bg-muted">{children}</kbd>;
}

// ============================================================================
// Sidebar
// ============================================================================

function HelpSidebar({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  return (
    <nav className="text-sm">
      <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">Conteúdo</p>
      <ul className="space-y-0.5">
        {TOC.map(section => {
          const isActive  = activeId === section.id || section.children.some(c => c.id === activeId);
          const isChildActive = section.children.some(c => c.id === activeId);
          return (
            <li key={section.id}>
              <button
                onClick={() => onSelect(section.id)}
                className={`w-full flex items-center gap-1.5 py-1 px-2 rounded text-left transition-colors text-sm ${
                  activeId === section.id
                    ? 'text-primary font-semibold bg-primary/8'
                    : isActive
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <span className="flex-shrink-0 opacity-70">{section.icon}</span>
                {section.label}
              </button>
              {(isActive || isChildActive) && section.children.length > 0 && (
                <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
                  {section.children.map(child => (
                    <li key={child.id}>
                      <button
                        onClick={() => onSelect(child.id)}
                        className={`w-full text-left py-0.5 text-xs transition-colors ${
                          activeId === child.id
                            ? 'text-primary font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {child.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ============================================================================
// Content Sections
// ============================================================================

function SectionDashboard() {
  return (
    <section>
      <SectionH2 id="s-dashboard" label="Dashboard Principal" icon={<Activity className="h-5 w-5" />} />
      <p className="text-muted-foreground text-sm mb-4">
        O dashboard é a tela principal do sistema — acessada pela rota <code className="text-xs bg-muted px-1 rounded">/</code>. Reúne todas as informações essenciais para o monitoramento contínuo de glicose em tempo real, atualizando automaticamente no intervalo configurado.
      </p>

      <SectionH3 id="s-glicose-atual" label="Cartão de Glicose Atual" />
      <p className="text-sm text-muted-foreground mb-2">Exibe o valor mais recente do CGM, a seta de tendência e o delta dos últimos 5 minutos.</p>
      <div className="grid grid-cols-2 gap-3 my-3">
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1">Setas de tendência</p>
          <ul className="space-y-0.5 text-xs">
            <li>↑↑ (DoubleUp) — subindo &gt;3 mg/dL/min</li>
            <li>↑ (SingleUp) — subindo 2–3 mg/dL/min</li>
            <li>↗ (FortyFiveUp) — subindo 1–2 mg/dL/min</li>
            <li>→ (Flat) — estável &lt;1 mg/dL/min</li>
            <li>↘ (FortyFiveDown) — caindo 1–2 mg/dL/min</li>
            <li>↓ (SingleDown) — caindo 2–3 mg/dL/min</li>
            <li>↓↓ (DoubleDown) — caindo &gt;3 mg/dL/min</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1">Cores por zona</p>
          <ul className="space-y-0.5 text-xs">
            <li><span className="text-red-500 font-bold">Vermelho escuro</span> — muito baixo (&lt;54)</li>
            <li><span className="text-orange-500 font-bold">Laranja</span> — baixo (54–70)</li>
            <li><span className="text-green-600 font-bold">Verde</span> — no alvo (70–180)</li>
            <li><span className="text-amber-500 font-bold">Âmbar</span> — alto (180–250)</li>
            <li><span className="text-red-500 font-bold">Vermelho</span> — muito alto (&gt;250)</li>
          </ul>
        </div>
      </div>
      <ClinicalNote type="tip" title="Interpretação clínica da tendência">
        Uma seta ↓↓ com glicemia de 80 mg/dL é uma emergência iminente — a glicemia pode chegar a 60 mg/dL em menos de 10 minutos. Combine sempre o valor com a tendência para tomada de decisão.
      </ClinicalNote>

      <SectionH3 id="s-grafico" label="Gráfico de Glicose" />
      <p className="text-sm text-muted-foreground mb-1">
        Gráfico de área interativo com gradiente dinâmico por zona TIR. A área de preenchimento e a linha de traçado são calculadas independentemente, garantindo alinhamento perfeito com os thresholds configurados.
      </p>
      <IllustrationWrap label="Gráfico de glicose com zonas coloridas e previsão AR2">
        <GlucoseAreaSVG />
      </IllustrationWrap>
      <ul className="text-sm text-muted-foreground space-y-1 my-2 list-disc list-inside">
        <li>Selecione o período com os botões: <Kbd>1h</Kbd> <Kbd>3h</Kbd> <Kbd>6h</Kbd> <Kbd>12h</Kbd> <Kbd>24h</Kbd> <Kbd>7d</Kbd> <Kbd>14d</Kbd> <Kbd>30d</Kbd></li>
        <li>Zoom: arraste horizontalmente no gráfico — duplo clique para restaurar</li>
        <li>Linha tracejada cinza = previsão AR2 (~60 min à frente)</li>
        <li>Ícones sobre o gráfico = marcadores de tratamentos (passe o mouse para detalhes)</li>
      </ul>
      <ClinicalNote type="info" title="Previsão AR2">
        O algoritmo AR2 (Autoregressivo de ordem 2) é idêntico ao do Nightscout original: opera em espaço logarítmico com coeficientes [-0.723, 1.716] e intervalos de 5 minutos. É útil para antecipar tendências de curto prazo, mas não substitui o julgamento clínico — ruídos do sensor ou refeições recentes podem reduzir a precisão.
      </ClinicalNote>

      <SectionH3 id="s-tir" label="Time in Range (TIR)" />
      <p className="text-sm text-muted-foreground mb-2">
        Barra empilhada com as 5 zonas glicêmicas + tabela com metas internacionais e tempo/dia real em cada zona.
      </p>
      <IllustrationWrap label="Barra TIR com metas ADA/ATTD 2023">
        <TIRBarSVG />
      </IllustrationWrap>
      <MetaTable rows={[
        { indicator: 'TIR (70–180 mg/dL)',  target: '≥ 70%',   note: 'Meta principal para DM1 e DM2' },
        { indicator: 'TAR1 (180–250 mg/dL)', target: '< 25%',   note: 'Tempo em hiperglicemia moderada' },
        { indicator: 'TAR2 (> 250 mg/dL)',   target: '< 5%',    note: 'Tempo em hiperglicemia grave' },
        { indicator: 'TBR1 (54–70 mg/dL)',   target: '< 4%',    note: 'Hipoglicemia nível 1' },
        { indicator: 'TBR2 (< 54 mg/dL)',    target: '< 1%',    note: 'Hipoglicemia nível 2 — urgente' },
      ]} />
      <ClinicalNote type="tip" title="Por que TIR supera HbA1c?">
        O TIR detecta hipoglicemias que a HbA1c mascara (HbA1c "boa" com muitas hipos). Um aumento de 10% no TIR equivale a uma redução de ~0,5% na HbA1c — mas o TIR também captura a qualidade do controle, não apenas a média.
      </ClinicalNote>

      <SectionH3 id="s-padrao-diario" label="Padrão Diário (AGP no Dashboard)" />
      <p className="text-sm text-muted-foreground mb-2">
        Gráfico com eixo fixo 00h–23h mostrando como a glicemia se comporta <em>tipicamente</em> em cada hora do dia, com base no período selecionado. Exibe bandas de percentis P5/P25/P75/P95 e a mediana (P50).
      </p>
      <IllustrationWrap label="Padrão diário agregado — AGP clínico">
        <AGPBandsSVG />
      </IllustrationWrap>
      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
        <li><strong>Banda exterior (P5–P95)</strong>: representa 90% das leituras naquele horário</li>
        <li><strong>Banda interna (P25–P75)</strong>: os 50% centrais — quanto menor, mais consistente</li>
        <li><strong>Linha central (P50)</strong>: a mediana — o perfil "típico" do paciente</li>
        <li>Banda larga em determinada hora = alta variabilidade naquele horário = oportunidade de ajuste</li>
      </ul>

      <SectionH3 id="s-estatisticas" label="Grade de Estatísticas" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
        {[
          { name: 'Média Glicêmica', desc: 'Média aritmética de todas as leituras do período selecionado.' },
          { name: 'GMI', desc: 'Glucose Management Indicator. Estima HbA1c via: GMI(%) = 3,31 + 0,02392 × média(mg/dL).' },
          { name: 'A1c Estimada', desc: 'Calculada pela fórmula ADAG (Diabetes Care 2008). Aproximação — não substitui exame laboratorial.' },
          { name: 'CV%', desc: 'Coeficiente de Variação (Desvio Padrão / Média). Meta ≤ 36% para minimizar risco de hipoglicemia assintomática.' },
        ].map((s) => (
          <div key={s.name} className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs">
            <p className="font-semibold text-foreground mb-1">{s.name}</p>
            <p className="text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
      <ClinicalNote type="warning" title="CV% elevado com HbA1c normal">
        Um paciente pode ter HbA1c 7,0% com CV% de 45% — indicando muitas hipoglicemias compensadas por hiperglicemias. O CV% alto é fator de risco independente para hipoglicemia assintomática e eventos cardiovasculares.
      </ClinicalNote>

      <SectionH3 id="s-comparacao" label="Comparação de Períodos" />
      <p className="text-sm text-muted-foreground">
        Sobrepõe a média horária do período atual (verde sólido) com o período anterior equivalente (cinza tracejado). Disponível para 24h, 7d, 14d e 30d. Útil para monitorar o impacto de mudanças na terapia ao longo do tempo.
      </p>

      <SectionH3 id="s-iob-cob" label="IOB & COB" />
      <div className="grid sm:grid-cols-2 gap-3 my-3">
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <p className="font-semibold mb-1">IOB — Insulina Ativa</p>
          <p className="text-xs text-muted-foreground">Calculado integrando a curva biexponencial de ação da insulina desde os últimos bolus. Parâmetro chave: <strong>DIA</strong> (Duração de Ação da Insulina) — configurável em Configurações. Evita empilhamento de doses.</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <p className="font-semibold mb-1">COB — Carboidratos Ativos</p>
          <p className="text-xs text-muted-foreground">Carboidratos ingeridos menos os já absorvidos, usando taxa de absorção configurável (padrão: 30 g/h). Diminui linearmente até zerar. Contribui para a previsão da glicemia futura.</p>
        </div>
      </div>

      <SectionH3 id="s-alertas" label="Alertas de Padrões" />
      <p className="text-sm text-muted-foreground mb-2">Detectados automaticamente pelo analytics engine sobre o período selecionado:</p>
      <div className="space-y-2">
        {[
          { name: 'Fenômeno do Alvorecer', desc: 'Elevação glicêmica entre 4h–8h sem refeição, causada por liberação de GH e cortisol. Sugere ajuste da basal noturna ou pré-bolus de acordo.' },
          { name: 'Hipoglicemia Noturna', desc: 'Glicemia abaixo do threshold entre 22h–6h. Risco aumentado de hipoglicemia assintomática durante o sono. Requer ação clínica.' },
          { name: 'Alta Variabilidade', desc: 'CV% > 36% no período. Indica instabilidade glicêmica — investigar causas: timing de bolus, composição da refeição, atividade física.' },
          { name: 'Pico Pós-Prandial', desc: 'Elevação > 60 mg/dL acima do nível pré-refeição dentro de 2h. Sugere timing de bolus inadequado ou ICR subestimado.' },
        ].map(a => (
          <div key={a.name} className="flex gap-2 rounded-lg border border-border bg-muted/10 p-2.5 text-xs">
            <ChevronRight className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
            <div><span className="font-semibold text-foreground">{a.name}:</span> <span className="text-muted-foreground">{a.desc}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionCalendario() {
  return (
    <section>
      <SectionH2 id="s-calendario" label="Calendário Mensal" icon={<Calendar className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        Visão mês a mês da glicemia média diária, colorida por zona TIR. Permite identificar padrões semanais, meses de melhor controle e dias com hipoglicemia recorrente.
      </p>
      <IllustrationWrap label="Heatmap mensal — cada célula representa um dia">
        <CalendarHeatmapSVG />
      </IllustrationWrap>
      <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
        <li>Cor da célula = zona da <strong>média glicêmica do dia</strong> (verde = no alvo, âmbar = alto, laranja = baixo, vermelho = muito alto/baixo)</li>
        <li>Badge <strong>⚠</strong> = dia com ao menos uma leitura abaixo do threshold de hipoglicemia</li>
        <li>Clique em qualquer dia para ver detalhes: média, mín, máx, leituras, contagem de hipos e mini-gráfico</li>
        <li>Navegue entre meses com os botões ‹ ›. O botão › é desabilitado no mês atual</li>
      </ul>
      <ClinicalNote type="tip" title="Utilidade clínica">
        O calendário permite identificar rapidamente <strong>padrões semanais consistentes</strong> — por exemplo, fins de semana com pior controle (alimentação irregular, atividade física diferente) ou semanas de férias com melhor TIR. É excelente ponto de partida para a conversa com o endocrinologista.
      </ClinicalNote>
    </section>
  );
}

function SectionSemanal() {
  return (
    <section>
      <SectionH2 id="s-semanal" label="Resumo Semanal" icon={<BarChart2 className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        Organiza os dados por semana, com sparklines diários de glicemia e totais de insulina e carboidratos. Facilita a comparação semana a semana e a correlação dose × resultado.
      </p>
      <IllustrationWrap label="Sparklines diários com totais semanais">
        <WeeklySVG />
      </IllustrationWrap>
      <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
        <li>Cada sparkline colorido representa um dia da semana — cor = zona predominante da glicemia</li>
        <li>Colunas abaixo: total de insulina rápida, insulina lenta e carboidratos registrados na semana</li>
        <li>Navegue para semanas anteriores com os botões de período</li>
        <li>Badge de hipos por semana: número de eventos abaixo do threshold</li>
      </ul>
      <ClinicalNote type="info" title="Correlação dose × glicemia">
        Semanas com TIR alto e insulina total menor podem indicar melhor timing e ajuste de doses. Compare semanas antes e depois de mudanças terapêuticas para avaliar impacto.
      </ClinicalNote>
    </section>
  );
}

function SectionHorarias() {
  return (
    <section>
      <SectionH2 id="s-horarias" label="Estatísticas Horárias" icon={<Clock className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        Box plots e heatmap para cada hora do dia (00h–23h), calculados sobre o período selecionado (7, 14 ou 30 dias). Permite identificar janelas horárias problemáticas com precisão.
      </p>
      <IllustrationWrap label="Box plots hora a hora — whiskers P10-P90, caixa P25-P75, linha mediana">
        <BoxPlotSVG />
      </IllustrationWrap>
      <div className="grid sm:grid-cols-2 gap-3 my-3 text-xs">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-semibold mb-1">Leitura do Box Plot</p>
          <ul className="text-muted-foreground space-y-0.5">
            <li>Whisker superior = P90 (90% das leituras abaixo)</li>
            <li>Borda superior da caixa = P75</li>
            <li>Linha interna = mediana (P50)</li>
            <li>Borda inferior da caixa = P25</li>
            <li>Whisker inferior = P10</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-semibold mb-1">O que observar</p>
          <ul className="text-muted-foreground space-y-0.5">
            <li>Whisker inferior abaixo de 70 = risco de hipo naquele horário</li>
            <li>Caixa elevada às 5h–8h = fenômeno do alvorecer</li>
            <li>Caixa alta às 12h–14h = pico pós-prandial do almoço</li>
            <li>Caixa estreita = boa consistência naquele horário</li>
          </ul>
        </div>
      </div>
      <ClinicalNote type="tip" title="Diferenciando fenômeno do alvorecer do efeito Somogyi">
        <strong>Alvorecer:</strong> glicemia sobe gradualmente a partir das 4h sem hipo prévia. <strong>Efeito Somogyi:</strong> hipo às 2h–4h seguida de hiperglicemia de rebote às 6h–8h. Compare as caixas das 02h e 06h — se a caixa das 02h estiver baixa e a das 06h alta, considere Somogyi.
      </ClinicalNote>
    </section>
  );
}

function SectionDistribuicao() {
  return (
    <section>
      <SectionH2 id="s-distribuicao" label="Distribuição Avançada" icon={<BarChart className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        Análise detalhada da distribuição e variabilidade glicêmica com histograma de frequência, índices de variabilidade (GVI, PGS) e roda TIR.
      </p>
      <IllustrationWrap label="Histograma de frequência — bins de 10 mg/dL coloridos por zona">
        <HistogramSVG />
      </IllustrationWrap>
      <div className="space-y-2 text-sm my-3">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-semibold mb-1">GVI — Glucose Variability Index</p>
          <p className="text-xs text-muted-foreground">Razão entre o comprimento real da curva glicêmica e o comprimento de uma linha perfeitamente estável com a mesma média. <strong>GVI &lt; 1,2</strong> = baixa variabilidade · <strong>1,2–1,5</strong> = moderada · <strong>&gt; 1,5</strong> = alta. Um GVI de 1,0 seria fisicamente impossível (a glicemia jamais é perfeitamente estável).</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-semibold mb-1">PGS — Patient Glycemic Status</p>
          <p className="text-xs text-muted-foreground">Métrica composta que combina GVI, média glicêmica e % de tempo fora do alvo. Quanto menor, melhor. Uso exploratório — não há meta consensuada internacionalmente, mas permite comparações longitudinais do mesmo paciente.</p>
        </div>
      </div>
      <ClinicalNote type="info" title="Formato ideal do histograma">
        Uma distribuição gaussiana (em sino) centrada entre 100–140 mg/dL com poucos valores nos extremos indica controle excelente. Distribuição bimodal (dois picos) sugere dois "estados" distintos — por exemplo, fins de semana vs dias de semana.
      </ClinicalNote>
    </section>
  );
}

function SectionLogDiario() {
  return (
    <section>
      <SectionH2 id="s-log-diario" label="Log Diário" icon={<BookOpenCheck className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        Visão detalhada de um único dia: gráfico de área 24h, grade numérica de leituras a cada 5 minutos e marcadores de todos os tratamentos registrados.
      </p>
      <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside mb-3">
        <li>Selecione a data com o calendário ou navegue com ‹ ›</li>
        <li>Passe o mouse sobre o gráfico para ver o valor exato naquele instante</li>
        <li>Marcadores coloridos sobre o gráfico: azul = bolus, verde = carboidratos, roxo = correção, ciano = sensor, laranja = site</li>
        <li>Grade numérica abaixo: valores brutos hora a hora com código de cor</li>
      </ul>
      <ClinicalNote type="tip" title="Utilidade na consulta clínica">
        O Log Diário é ideal para revisão conjunta com o endocrinologista: permite reconstruir um dia problemático conectando a hora do bolus, o tipo de refeição e a resposta glicêmica — tudo numa única tela. Exporte como PDF usando a impressão do browser (Ctrl+P).
      </ClinicalNote>
    </section>
  );
}

function SectionRefeicoes() {
  return (
    <section>
      <SectionH2 id="s-refeicoes" label="Padrões de Refeição" icon={<Utensils className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        Correlaciona cada refeição registrada com a resposta glicêmica: glicemia pré-refeição, +1h, +2h e pico máximo. Os eventos são agrupados por período do dia (café da manhã, almoço, lanche, jantar).
      </p>
      <IllustrationWrap label="Perfil médio de excursão glicêmica por período do dia">
        <MealCorrelationSVG />
      </IllustrationWrap>
      <div className="grid sm:grid-cols-2 gap-3 my-3 text-xs">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-semibold mb-1.5">Métricas por período</p>
          <ul className="text-muted-foreground space-y-0.5">
            <li><strong>Pré-refeição:</strong> glicemia até 30 min antes</li>
            <li><strong>+1h:</strong> leitura mais próxima de 1h após</li>
            <li><strong>+2h:</strong> leitura mais próxima de 2h após</li>
            <li><strong>Pico:</strong> valor máximo nas 3h seguintes</li>
            <li><strong>Δ (delta):</strong> pico − pré-refeição</li>
            <li><strong>Carbos médio / Insulina média</strong></li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-semibold mb-1.5">Classificação dos períodos</p>
          <ul className="text-muted-foreground space-y-0.5">
            <li><span className="text-amber-500">●</span> <strong>Café da manhã</strong> — 5h–10h</li>
            <li><span className="text-blue-500">●</span> <strong>Almoço</strong> — 11h–14h</li>
            <li><span className="text-emerald-500">●</span> <strong>Lanche</strong> — 15h–17h</li>
            <li><span className="text-violet-500">●</span> <strong>Jantar</strong> — 18h–22h</li>
            <li><span className="text-gray-400">●</span> <strong>Outro</strong> — demais horários</li>
          </ul>
        </div>
      </div>
      <ClinicalNote type="tip" title="Interpretação da excursão pós-prandial">
        Uma excursão (delta) acima de 50 mg/dL sugere bolus tardio ou ICR subestimado para aquele período. Se o pico está alto mas a glicemia pré-refeição já estava elevada, o problema pode ser a glicemia de base — não a refeição em si. Compare o contexto antes de ajustar o ICR.
      </ClinicalNote>
      <ClinicalNote type="info" title="Como registrar o tipo de refeição">
        Para o gráfico de Padrões de Refeição ser mais preciso, ao registrar um <strong>Meal Bolus</strong> selecione o tipo (Almoço ou Jantar) e ao registrar um <strong>Snack Bolus</strong> selecione (Café da Manhã ou Lanche). Isso substitui a inferência automática pelo horário.
      </ClinicalNote>
    </section>
  );
}

function SectionAGP() {
  return (
    <section>
      <SectionH2 id="s-agp" label="Relatório AGP" icon={<FileText className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        O <strong>Ambulatory Glucose Profile (AGP)</strong> é o formato padrão internacional para relatórios de CGM, definido pelo consenso ADA/ATTD 2019. Adequado para consultas médicas e revisão clínica estruturada.
      </p>
      <IllustrationWrap label="AGP — bandas de percentis P5/P25/P50/P75/P95 sobre 24 horas">
        <AGPBandsSVG />
      </IllustrationWrap>
      <div className="space-y-2 my-3 text-sm">
        <p className="font-semibold">O que o relatório contém:</p>
        <ul className="text-muted-foreground space-y-1.5 list-disc list-inside text-sm">
          <li><strong>Barra TIR:</strong> visão rápida do tempo em cada zona glicêmica</li>
          <li><strong>KPIs clínicos:</strong> GMI, média glicêmica, CV%, TIR% — com semáforo de metas</li>
          <li><strong>Gráfico AGP:</strong> 24h com bandas P5/P25/P50/P75/P95 e linhas de threshold</li>
          <li><strong>Mini-gráficos diários:</strong> um SVG por dia do período, colorido pela zona predominante, com a média impressa</li>
        </ul>
      </div>
      <ClinicalNote type="tip" title="Impressão / PDF">
        Use <Kbd>Ctrl+P</Kbd> (ou <Kbd>Cmd+P</Kbd> no Mac) para imprimir ou exportar como PDF. O CSS de impressão otimiza o layout para A4 paisagem, ocultando a navegação. Recomendado: 14 dias para consulta trimestral, 30 dias para revisão semestral.
      </ClinicalNote>
      <ClinicalNote type="info" title="GMI vs HbA1c laboratorial">
        O GMI é calculado sobre os dados do CGM do período selecionado — reflete as últimas semanas. A HbA1c laboratorial reflete os últimos 90 dias com ponderação maior para os mais recentes. Divergências entre GMI e HbA1c podem indicar hemoglobinopatias, anemia ou outras condições que afetam a meia-vida das hemácias.
      </ClinicalNote>
    </section>
  );
}

function SectionSpaghetti() {
  return (
    <section>
      <SectionH2 id="s-spaghetti" label="Gráfico Spaghetti" icon={<TrendingUp className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        Sobrepõe os traçados glicêmicos de múltiplos dias sobre um único eixo de 24 horas, permitindo comparação visual direta da consistência do perfil glicêmico.
      </p>
      <IllustrationWrap label="Traçados diários sobrepostos — cada linha = um dia">
        <SpaghettiSVG />
      </IllustrationWrap>
      <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside mb-3">
        <li>Selecione 7 ou 14 dias; use ‹ › para navegar a períodos anteriores</li>
        <li><strong>Linhas agrupadas:</strong> alta consistência diária (bom controle de rotina)</li>
        <li><strong>Linhas dispersas:</strong> alta variabilidade inter-diária (investigar causas)</li>
        <li><strong>Toggle de visibilidade:</strong> clique na legenda ou na bolinha da tabela para ocultar/exibir dias individuais</li>
        <li>Tabela de estatísticas por dia: média, mín, máx, TIR% e hipo% com código de cor</li>
      </ul>
      <ClinicalNote type="tip" title="Comparar dias específicos da semana">
        Oculte todos os dias e reative apenas as segundas-feiras para ver se o padrão da segunda é diferente dos sábados. Útil para identificar o efeito de academia, trabalho, dieta ou atividade de fim de semana.
      </ClinicalNote>
    </section>
  );
}

function SectionCareportal() {
  return (
    <section>
      <SectionH2 id="s-careportal" label="Careportal & Tratamentos" icon={<Syringe className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        Registre todos os eventos do dia a dia — bolus, refeições, trocas de sensor, exercícios e mais. Acesse pelo ícone <strong>+</strong> no cabeçalho. O histórico fica em <strong>Menu → Tratamentos</strong>.
      </p>
      <div className="grid sm:grid-cols-2 gap-2 my-3 text-xs">
        {[
          { type: 'Meal Bolus', desc: 'Bolus de refeição. Campos: insulina, carbos, proteína, gordura, glicose, preBolus, tipo (almoço/jantar), notas.' },
          { type: 'Snack Bolus', desc: 'Bolus de lanche. Campos: insulina, carbos, proteína, gordura, glicose, preBolus, tipo (café/lanche), notas.' },
          { type: 'Correction Bolus', desc: 'Bolus de correção sem refeição. Campos: insulina, glicose, notas.' },
          { type: 'Combo Bolus', desc: 'Bolus imediato + estendido (bomba). Campos: insulina imediata, insulina estendida, duração (min), carbos, preBolus.' },
          { type: 'Carb Correction', desc: 'Carboidratos sem insulina (correção de hipo). Campo: gramas de carboidrato.' },
          { type: 'BG Check', desc: 'Medição capilar (glicosímetro). Campo: glicose em mg/dL.' },
          { type: 'Temp Basal', desc: 'Basal temporária (bomba). Campos: taxa (U/h ou %), modo absoluto/relativo, duração.' },
          { type: 'Exercise', desc: 'Atividade física. Campos: tipo, intensidade (leve/moderada/intensa), duração (min).' },
        ].map(t => (
          <div key={t.type} className="rounded border border-border bg-muted/10 p-2">
            <p className="font-semibold text-foreground">{t.type}</p>
            <p className="text-muted-foreground mt-0.5">{t.desc}</p>
          </div>
        ))}
      </div>
      <ClinicalNote type="info" title="Campo preBolus (Carb Time)">
        Registra o tempo dos carboidratos em relação ao bolus (−60 a +60 min). Valor negativo = comeu <em>antes</em> do bolus; positivo = bolus foi dado antes de comer. Este campo é compatível com o Nightscout original e é utilizado nos Padrões de Refeição para análise de timing.
      </ClinicalNote>
      <p className="text-sm text-muted-foreground mt-2">
        Na página <strong>Tratamentos</strong> (Menu → Tratamentos) você pode filtrar por tipo e período, visualizar todos os registros em tabela e excluir entradas incorretas.
      </p>
    </section>
  );
}

function SectionCalculadora() {
  return (
    <section>
      <SectionH2 id="s-calculadora" label="Calculadora de Bolus" icon={<HelpCircle className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        Implementação do algoritmo <strong>BWP (Bolus Wizard Preview)</strong> do Nightscout. Acesse pelo ícone da calculadora (🧮) no cabeçalho.
      </p>
      <div className="rounded-lg border border-border bg-muted/20 p-4 my-3 font-mono text-xs space-y-1.5">
        <p>Glicemia projetada = BG_atual − IOB × ISF</p>
        <p>Correção = (Projetada − Alvo_máx) / ISF  <span className="text-muted-foreground">// se acima do alvo</span></p>
        <p>Correção = (Projetada − Alvo_mín) / ISF  <span className="text-muted-foreground">// se abaixo do alvo</span></p>
        <p>Carbos   = gramas_planejados / ICR</p>
        <p>Sugerido = Correção + Carbos</p>
        <p>Dose     = arredondar(max(0, Sugerido), passo_caneta)</p>
      </div>
      <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
        <li><strong>Glicemia projetada:</strong> remove o efeito do IOB atual antes de calcular a correção — evita hipoglicemia por empilhamento</li>
        <li><strong>Resultado negativo:</strong> exibe equivalente em gramas de carboidrato a consumir e sugestão de basal temporária reduzida</li>
        <li>Após confirmar, o resultado pode ser registrado diretamente no Careportal</li>
        <li>Configure ISF, ICR, DIA e faixa-alvo em <strong>Configurações</strong></li>
      </ul>
      <ClinicalNote type="warning" title="A calculadora é um auxílio, não substitui julgamento clínico">
        O resultado é baseado nos parâmetros configurados (ISF, ICR, DIA) e no IOB calculado. Fatores como atividade física recente, doença intercorrente, localização do sensor e gordura na refeição podem alterar significativamente a resposta real.
      </ClinicalNote>
    </section>
  );
}

function SectionConfiguracoes() {
  return (
    <section>
      <SectionH2 id="s-configuracoes" label="Configurações" icon={<Settings className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-3">
        Acesse em <strong>Menu → Configurações</strong>. Todas as configurações são salvas no servidor MongoDB e compartilhadas entre todos os dispositivos que acessam o dashboard.
      </p>
      <div className="overflow-x-auto my-3">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-3 font-medium">Parâmetro</th>
              <th className="text-left pr-3 font-medium">Descrição</th>
              <th className="text-left font-medium">Impacto</th>
            </tr>
          </thead>
          <tbody>
            {[
              { p: 'Unidade', d: 'mg/dL ou mmol/L', i: 'Toda a interface — gráficos, tooltips, thresholds' },
              { p: 'Auto-refresh', d: '1–30 minutos', i: 'Frequência de atualização do dashboard' },
              { p: 'Faixas limites', d: 'Muito Baixo / Baixo / Alto / Muito Alto (mg/dL)', i: 'Cores, TIR, alertas, calendário, todas as páginas' },
              { p: 'DIA', d: 'Duração de Ação da Insulina (horas)', i: 'Cálculo do IOB — parâmetro mais crítico' },
              { p: 'Taxa de absorção', d: 'Gramas de carbo por hora (padrão: 30 g/h)', i: 'Cálculo do COB' },
              { p: 'Taxa basal', d: 'U/h da bomba (0 para MDI)', i: 'Referência para cálculo de basal temporária' },
              { p: 'ISF', d: 'mg/dL por unidade de insulina', i: 'Calculadora de Bolus (dose de correção)' },
              { p: 'ICR', d: 'Gramas de carbo por unidade', i: 'Calculadora de Bolus (dose de refeição)' },
              { p: 'Faixa-alvo', d: 'Mín e Máx para calculadora (mg/dL)', i: 'Referência para cálculo de correção' },
              { p: 'Passo da caneta', d: '1 U ou 0,5 U', i: 'Arredondamento da dose sugerida' },
              { p: 'Idades de dispositivos', d: 'Thresholds por SAGE/CAGE/IAGE', i: 'Badge de alerta no cartão de glicose' },
            ].map(r => (
              <tr key={r.p} className="border-b border-border/40 hover:bg-muted/20">
                <td className="py-1.5 pr-3 font-semibold">{r.p}</td>
                <td className="pr-3 text-muted-foreground">{r.d}</td>
                <td className="text-muted-foreground">{r.i}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ClinicalNote type="warning" title="DIA incorreto = IOB incorreto = decisões erradas">
        O DIA é o parâmetro mais crítico. Um DIA subestimado (ex: 2h para uma insulina com ação de 4h) fará o sistema reportar IOB zero quando ainda há insulina ativa — levando ao empilhamento de bolus e hipoglicemia. Consulte a bula do análogo utilizado ou o endocrinologista.
      </ClinicalNote>
    </section>
  );
}

function SectionGlossario() {
  const terms = [
    { term: 'AGP', def: 'Ambulatory Glucose Profile — formato padronizado para relatórios de CGM definido pelo consenso ADA/ATTD 2019.' },
    { term: 'AR2', def: 'Modelo Autoregressivo de ordem 2 para previsão glicêmica de curto prazo (~60 min). Usa coeficientes [-0,723; 1,716] em espaço logarítmico — idêntico ao NS original.' },
    { term: 'CGM', def: 'Continuous Glucose Monitor — sensor de glicose intersticial com leituras a cada 1–5 minutos (ex: Dexcom, Libre, Eversense).' },
    { term: 'COB', def: 'Carbs on Board — carboidratos ativos: gramas ingeridas menos as já absorvidas, calculadas pela taxa de absorção configurada.' },
    { term: 'CV%', def: 'Coeficiente de Variação = (Desvio Padrão / Média) × 100. Meta ≤ 36%. Acima disso, risco aumentado de hipoglicemia assintomática independente do TIR.' },
    { term: 'DIA', def: 'Duration of Insulin Action — tempo total de ação da insulina. Fiasp/Lispro: ~3h; Aspart/Lispro regular: ~4h; Glargina: >20h.' },
    { term: 'Fenômeno do Alvorecer', def: 'Elevação da glicemia entre 4h–9h causada por pico de GH e cortisol. Resulta em resistência transitória à insulina. Identificável no gráfico de Stats Horárias.' },
    { term: 'GMI', def: 'Glucose Management Indicator — estimativa de HbA1c baseada na glicemia média do CGM. Fórmula: GMI(%) = 3,31 + 0,02392 × média(mg/dL). Reflete apenas o período selecionado.' },
    { term: 'GVI', def: 'Glycemic Variability Index — razão entre comprimento real da curva e comprimento de uma linha perfeitamente estável. < 1,2 = baixo; 1,2–1,5 = moderado; > 1,5 = alto.' },
    { term: 'ICR', def: 'Insulin-to-Carb Ratio — razão insulina:carboidrato. Indica quantos gramas de carbo 1 unidade de insulina cobre. Varia por período do dia.' },
    { term: 'IOB', def: 'Insulin on Board — insulina ativa: quantidade de insulina ainda com efeito hipoglicemiante, calculada via modelo biexponencial desde os últimos bolus.' },
    { term: 'ISF', def: 'Insulin Sensitivity Factor — quanto 1 unidade de insulina reduz a glicemia (mg/dL por U). Usado no cálculo da dose de correção.' },
    { term: 'PGS', def: 'Patient Glycemic Status — métrica composta de variabilidade, média e tempo fora do alvo. Uso exploratório para acompanhamento longitudinal.' },
    { term: 'TBR', def: 'Time Below Range — TBR1: tempo < 70 mg/dL (meta < 4%); TBR2: tempo < 54 mg/dL (meta < 1%).' },
    { term: 'TIR', def: 'Time in Range — percentagem de tempo entre 70–180 mg/dL. Meta ≥ 70% para a maioria dos adultos com DM1 e DM2.' },
    { term: 'TAR', def: 'Time Above Range — TAR1: tempo 180–250 mg/dL (meta < 25%); TAR2: tempo > 250 mg/dL (meta < 5%).' },
  ];
  return (
    <section>
      <SectionH2 id="s-glossario" label="Glossário Clínico" icon={<BookOpen className="h-5 w-5" />} />
      <p className="text-sm text-muted-foreground mb-4">Termos utilizados no sistema e seus significados clínicos.</p>
      <div className="space-y-2">
        {terms.map(t => (
          <div key={t.term} className="flex gap-3 rounded-lg border border-border bg-muted/10 px-3 py-2 text-sm">
            <span className="font-bold text-primary flex-shrink-0 w-28">{t.term}</span>
            <span className="text-muted-foreground">{t.def}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Main HelpPage
// ============================================================================

export function HelpPage() {
  const [activeId, setActiveId] = useState('s-dashboard');

  const handleScroll = useCallback(() => {
    const OFFSET = 90; // header height + buffer
    let current = ALL_IDS[0];
    for (const id of ALL_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= OFFSET) current = id;
    }
    setActiveId(current);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <main className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Page header */}
      <div className="mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Documentação</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Guia completo de uso do Nightscout Modern — funcionalidades, interpretação clínica e boas práticas.
        </p>
      </div>

      <div className="flex gap-8 relative">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto pr-1 pb-8">
            <HelpSidebar activeId={activeId} onSelect={scrollTo} />
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-14">
          <SectionDashboard />
          <SectionCalendario />
          <SectionSemanal />
          <SectionHorarias />
          <SectionDistribuicao />
          <SectionLogDiario />
          <SectionRefeicoes />
          <SectionAGP />
          <SectionSpaghetti />
          <SectionCareportal />
          <SectionCalculadora />
          <SectionConfiguracoes />
          <SectionGlossario />
        </div>
      </div>
    </main>
  );
}
