import React from 'react'

export default function Sparkline({ data, color = '#3b82f6', height = 36, width = 160, suffix = '' }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', color: '#9ca3af', fontSize: '12px' }}>
        Pas encore de données
      </div>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const last = data[data.length - 1]
  const lastY = height - ((last - min) / range) * height

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', flexShrink: 0 }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={width} cy={lastY} r="2.5" fill={color} />
      </svg>
      <span style={{ fontSize: '12px', color: '#374151', fontWeight: '600', whiteSpace: 'nowrap' }}>
        {typeof last === 'number' ? last.toFixed(1) : last}{suffix}
      </span>
    </div>
  )
}
