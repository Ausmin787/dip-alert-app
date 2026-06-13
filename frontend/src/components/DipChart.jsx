import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fmtPrice } from '../lib.js'

/* 30-day close trace vs ATH. Lazy-loaded so recharts stays out of the main
   bundle (it's the heaviest dependency and the chart sits below the fold). */
export default function DipChart({ ticker, ath, data }) {
  if (!data.length) return null
  const min = Math.min(...data.map((d) => d.close), ath ?? Infinity)
  const max = Math.max(...data.map((d) => d.close), ath ?? 0)
  const pad = (max - min) * 0.08

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="tag">30-day trace vs ATH</h3>
        <span className="num text-[0.65rem] text-ink-muted">{ticker}</span>
      </div>
      <div className="-mx-2">
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="violetFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6a4cf5" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#6a4cf5" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: '#999999', fontSize: 10 }}
              tickFormatter={(d) => d.slice(5)}
              axisLine={false}
              tickLine={false}
              minTickGap={50}
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tick={{ fill: '#999999', fontSize: 10 }}
              tickFormatter={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              contentStyle={{
                background: '#1c1c1c',
                border: '1px solid #262626',
                borderRadius: 10,
                color: '#ffffff',
                fontSize: 12,
              }}
              formatter={(v) => [fmtPrice(v), 'close']}
            />
            {ath && (
              <ReferenceLine
                y={ath}
                stroke="#ff7a3d"
                strokeDasharray="5 5"
                label={{ value: 'ATH', fill: '#ff7a3d', fontSize: 10, position: 'insideTopRight' }}
              />
            )}
            <Area
              type="monotone"
              dataKey="close"
              stroke="#6a4cf5"
              strokeWidth={2}
              fill="url(#violetFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
