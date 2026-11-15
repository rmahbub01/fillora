import React from 'react';
import { SmartGuideLine } from '../utils/smartGuides';

interface SmartGuidesOverlayProps {
  guides: SmartGuideLine[];
  width: number;
  height: number;
  color?: string; // default #ec4899 (Photoshop Magenta / Pink)
}

export const SmartGuidesOverlay: React.FC<SmartGuidesOverlayProps> = ({
  guides,
  width,
  height,
  color = '#ec4899',
}) => {
  if (!guides || guides.length === 0 || width <= 0 || height <= 0) {
    return null;
  }

  const verticalGuides = guides.filter((g) => g.type === 'vertical');
  const horizontalGuides = guides.filter((g) => g.type === 'horizontal');

  // Collect any target bounding boxes to highlight them with dashed magenta outlines
  const targetBoxes = guides
    .map((g) => g.targetBox)
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  return (
    <svg
      className="absolute inset-0 pointer-events-none select-none overflow-visible"
      width={width}
      height={height}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 50,
      }}
    >
      {/* 1. Aligned Target Element Highlight Boxes (Modern Photoshop Style) */}
      {targetBoxes.map((box, idx) => (
        <rect
          key={`target-box-${idx}`}
          x={box.left}
          y={box.top}
          width={box.width}
          height={box.height}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.85}
        />
      ))}

      {/* 2. Vertical Alignment Lines (Canvas-Wide Dual-Stroke for 100% Contrast & No Filter Clipping) */}
      {verticalGuides.map((guide) => {
        const x = guide.position;
        const badgeY = Math.min(Math.max(30, height * 0.15), height - 30);
        return (
          <g key={guide.id}>
            {/* White contrast backing line */}
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke="#ffffff"
              strokeWidth={3}
              strokeOpacity={0.9}
            />
            {/* Core vibrant magenta smart guide line */}
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke={color}
              strokeWidth={1.5}
            />

            {/* Photoshop-Style Alignment Badge */}
            {guide.label && (
              <g transform={`translate(${Math.max(36, Math.min(width - 36, x))}, ${badgeY})`}>
                <rect
                  x="-32"
                  y="-10"
                  width="64"
                  height="20"
                  rx="4"
                  fill="#111827"
                  stroke={color}
                  strokeWidth={1}
                  opacity={0.92}
                />
                <circle cx="-22" cy="0" r="2.5" fill={color} />
                <text
                  x="2"
                  y="3.5"
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {guide.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* 3. Horizontal Alignment Lines (Canvas-Wide Dual-Stroke for 100% Contrast & No Filter Clipping) */}
      {horizontalGuides.map((guide) => {
        const y = guide.position;
        const badgeX = Math.min(Math.max(45, width * 0.15), width - 45);
        return (
          <g key={guide.id}>
            {/* White contrast backing line */}
            <line
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke="#ffffff"
              strokeWidth={3}
              strokeOpacity={0.9}
            />
            {/* Core vibrant magenta smart guide line */}
            <line
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={color}
              strokeWidth={1.5}
            />

            {/* Photoshop-Style Alignment Badge */}
            {guide.label && (
              <g transform={`translate(${badgeX}, ${Math.max(16, Math.min(height - 16, y))})`}>
                <rect
                  x="-32"
                  y="-10"
                  width="64"
                  height="20"
                  rx="4"
                  fill="#111827"
                  stroke={color}
                  strokeWidth={1}
                  opacity={0.92}
                />
                <circle cx="-22" cy="0" r="2.5" fill={color} />
                <text
                  x="2"
                  y="3.5"
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {guide.label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};
