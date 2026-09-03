import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface StudentRadarChartProps {
  stats?: {
    'Logic & Math'?: number;
    'Core Development'?: number;
    'Systems & Architecture'?: number;
    'Soft Skills'?: number;
    'Project Management'?: number;
    [key: string]: number | undefined;
  };
}

export function StudentRadarChart({ stats }: StudentRadarChartProps) {
  const chartData = [
    { domain: 'Logic & Math', score: stats?.['Logic & Math'] ?? 0.0, fullMark: 4.0 },
    { domain: 'Core Development', score: stats?.['Core Development'] ?? 0.0, fullMark: 4.0 },
    { domain: 'Systems & Architecture', score: stats?.['Systems & Architecture'] ?? 0.0, fullMark: 4.0 },
    { domain: 'Soft Skills', score: stats?.['Soft Skills'] ?? 0.0, fullMark: 4.0 },
    { domain: 'Project Management', score: stats?.['Project Management'] ?? 0.0, fullMark: 4.0 },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/90 backdrop-blur-xs text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-700">
          <p className="font-semibold text-indigo-300">{data.domain}</p>
          <p className="text-slate-200 mt-0.5">
            GPA Score: <span className="font-bold text-white font-mono">{Number(data.score).toFixed(2)}</span> / 4.00
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64 sm:h-72 flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
          <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 4.0]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            stroke="#cbd5e1"
          />
          <Tooltip content={<CustomTooltip />} />
          <Radar
            name="Domain Skill"
            dataKey="score"
            stroke="#6366f1"
            fill="#818cf8"
            fillOpacity={0.45}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
