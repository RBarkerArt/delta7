import React from 'react';
import {
    GRID_COLS,
    GRID_ROWS,
    GRID_COL_LABELS,
    SECTOR03_CELL,
    formatCell,
} from '../lib/sectorTriangulation';

interface SectorGridOverlayProps {
    /** The observer's own relay cell — marked faintly so they can find their ray origin. */
    relayLabel: string;
    /** Once Sector 03 is named, the target cell gets a small "W." annotation. */
    named: boolean;
}

/**
 * A faint A–J / 1–8 survey grid laid over the facility map, so triangulation
 * rays can be plotted at all. Rendered as an absolutely-positioned SVG that
 * scales with the map image (viewBox 0..GRID_COLS × 0..GRID_ROWS). Low-opacity
 * lines + edge labels; the observer's relay cell is faintly ringed. After the
 * naming, the target cell (Sector 03 / C3) carries a small "W." — the void
 * finally admitting what it was. Purely decorative / aria-hidden.
 */
export const SectorGridOverlay: React.FC<SectorGridOverlayProps> = ({ relayLabel, named }) => {
    // Resolve the relay label back to a cell for the faint ring (best-effort;
    // an unknown label just renders no ring).
    const relayCol = GRID_COL_LABELS.indexOf(relayLabel[0]);
    const relayRow = Number(relayLabel.slice(1)) - 1;
    const hasRelay = relayCol >= 0 && relayRow >= 0 && relayRow < GRID_ROWS;

    return (
        <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${GRID_COLS} ${GRID_ROWS}`}
            preserveAspectRatio="none"
        >
            {/* Vertical grid lines */}
            {Array.from({ length: GRID_COLS + 1 }, (_, c) => (
                <line
                    key={`v${c}`}
                    x1={c} y1={0} x2={c} y2={GRID_ROWS}
                    stroke="rgb(16,185,129)"
                    strokeWidth={0.012}
                    opacity={0.22}
                    vectorEffect="non-scaling-stroke"
                />
            ))}
            {/* Horizontal grid lines */}
            {Array.from({ length: GRID_ROWS + 1 }, (_, r) => (
                <line
                    key={`h${r}`}
                    x1={0} y1={r} x2={GRID_COLS} y2={r}
                    stroke="rgb(16,185,129)"
                    strokeWidth={0.012}
                    opacity={0.22}
                    vectorEffect="non-scaling-stroke"
                />
            ))}

            {/* Column labels A–J along the top */}
            {GRID_COL_LABELS.map((label, c) => (
                <text
                    key={`cl${c}`}
                    x={c + 0.5} y={0.34}
                    textAnchor="middle"
                    fontSize={0.3}
                    fill="rgb(16,185,129)"
                    opacity={0.4}
                    className="font-mono"
                >{label}</text>
            ))}
            {/* Row labels 1–8 down the left */}
            {Array.from({ length: GRID_ROWS }, (_, r) => (
                <text
                    key={`rl${r}`}
                    x={0.22} y={r + 0.62}
                    textAnchor="middle"
                    fontSize={0.3}
                    fill="rgb(16,185,129)"
                    opacity={0.4}
                    className="font-mono"
                >{r + 1}</text>
            ))}

            {/* The observer's relay cell — a faint ring marking where their ray starts. */}
            {hasRelay && (
                <rect
                    x={relayCol + 0.12} y={relayRow + 0.12}
                    width={0.76} height={0.76}
                    fill="none"
                    stroke="rgb(16,185,129)"
                    strokeWidth={0.02}
                    opacity={0.5}
                    vectorEffect="non-scaling-stroke"
                />
            )}

            {/* Post-naming: the target cell (C3) admits itself with a small "W." */}
            {named && (
                <g>
                    <rect
                        x={SECTOR03_CELL.col + 0.1} y={SECTOR03_CELL.row + 0.1}
                        width={0.8} height={0.8}
                        fill="rgba(239,68,68,0.12)"
                        stroke="rgb(239,68,68)"
                        strokeWidth={0.02}
                        opacity={0.7}
                        vectorEffect="non-scaling-stroke"
                    />
                    <text
                        x={SECTOR03_CELL.col + 0.5} y={SECTOR03_CELL.row + 0.66}
                        textAnchor="middle"
                        fontSize={0.42}
                        fill="rgb(248,180,180)"
                        opacity={0.9}
                        className="font-mono"
                    >W.</text>
                    <title>{`Sector 03 — ${formatCell(SECTOR03_CELL)}`}</title>
                </g>
            )}
        </svg>
    );
};
