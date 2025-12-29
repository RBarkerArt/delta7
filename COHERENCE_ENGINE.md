# Delta-7 Coherence Engine Reference

This document outlines the operational states of the Delta-7 coherence system, the score thresholds that trigger them, and their corresponding visual/narrative effects.

## Coherence States & Thresholds

| State | Score Range | Narrative Context | Visual Impacts |
| :--- | :--- | :--- | :--- |
| **FEED_STABLE** | **90% - 100%** | Nominal feed signal. | Crisp text, 100% opacity, minimal jitter. |
| **SYNC_RECOVERING** | **70% - 89%** | Stabilizing after fluctuation. | Subtle text flicker, slight opacity shifts. |
| **COHERENCE_FRAYING** | **45% - 69%** | Material decay detected. | Subtle glitching, 0.5px blur, minor text corruption. |
| **SIGNAL_FRAGMENTED** | **20% - 44%** | Significant neural drift. | Scanlines active, heavy glitching, secondary typing delays. |
| **CRITICAL_INTERFERENCE** | **0% - 19%** | Total system instability. | Heavy blur, frequent text corruption, red alert indicators. |

## Mechanics

### 1. Natural Recovery (Observer Effect)
- **Rate**: +0.1% every 3 seconds.
- **Logic**: The system naturally stabilizes when a conscious observer is present. High attention (presence) maintains the feed.

### 2. Temporal Decay
- **Rate**: -5% every 6 hours.
- **Logic**: Coherence degrades over time when the observer is absent. Extended neglect leads to signal fragmentation.

### 3. Visual Degradation Logic
- **Blur**: `Math.min(0.8, Math.max(0, (100 - score) / 80))` (px)
- **Opacity**: `Math.max(0.7, score / 100)`
- **Glitch Probability**:
    - High (>60): 1%
    - Med (30-60): 5%
    - Low (<30): 15%

## Usage in Components
- **`CoherenceContext.tsx`**: The central source of truth and state calculation.
- **`App.tsx`**: Consumes score/state to apply global screen effects and typing behaviors.
- **`GlitchText.tsx`**: Uses the score to determine character swap frequency.
- **`Fragment.tsx`**: Triggers "ghost" text when log progression or score hits specific milestones.
