import React from 'react';

export type SignalIconName =
  | 'coffee'
  | 'refrigerator'
  | 'door'
  | 'map'
  | 'clock'
  | 'tv'
  | 'monitor'
  | 'eye'
  | 'archive'
  | 'status'
  | 'drawer'
  | 'prologue'
  | 'relay'
  | 'security'
  | 'tuning'
  | 'radar'
  | 'compass'
  | 'alert'
  | 'route'
  | 'index'
  | 'lock';

interface SignalIconProps extends React.SVGProps<SVGSVGElement> {
  name: SignalIconName;
  size?: number;
  strokeWidth?: number;
  useFilter?: boolean;
}

export const SignalIcon: React.FC<SignalIconProps> = ({
  name,
  size = 16,
  strokeWidth = 1.2,
  useFilter = true,
  className = '',
  ...props
}) => {
  const filterStyle = useFilter ? { filter: 'url(#distressed-signal-icon)' } : undefined;

  const renderPath = () => {
    switch (name) {
      case 'coffee':
        return (
          <>
            {/* Cup Body */}
            <path d="M 5,10 C 5,16 6,18 8,18 L 14,18 C 16,18 17,16 17,10 L 4,10" />
            {/* Cup bottom edge accent */}
            <line x1="8" y1="18" x2="14" y2="18" />
            {/* Cup Handle */}
            <path d="M 17,11.5 C 19.5,11.5 20,13.5 20,14.5 C 20,15.5 19,16.5 17,16.5" />
            {/* Steam signals */}
            <path d="M 7,8 C 7,6 8.5,6 8.5,4" />
            <path d="M 10.5,8 C 10.5,6 12,6 12,4" />
            <path d="M 14,8 C 14,6 15.5,6 15.5,4" />
          </>
        );
      case 'refrigerator':
        return (
          <>
            {/* Outer steel cabinet */}
            <rect x="5" y="2" width="14" height="20" />
            {/* Freezer door divider line */}
            <line x1="5" y1="10" x2="19" y2="10" />
            {/* Upper freezer handle */}
            <line x1="16" y1="5" x2="16" y2="8" />
            {/* Lower fridge handle */}
            <line x1="16" y1="12" x2="16" y2="17" />
          </>
        );
      case 'door':
        return (
          <>
            {/* Concrete doorway frame */}
            <path d="M 4,21 L 4,4 L 14,4 L 14,21" />
            {/* Steel door panel opened outwards */}
            <path d="M 14,4 L 20,6 L 20,21 L 14,21 Z" />
            {/* Warning hatch details on door */}
            <line x1="16" y1="9" x2="18" y2="9" />
            <line x1="16" y1="12" x2="18" y2="12" />
            <circle cx="17" cy="15" r="0.5" />
          </>
        );
      case 'map':
        return (
          <>
            {/* Facility map grid boundaries */}
            <rect x="3" y="3" width="18" height="18" />
            {/* Division grids */}
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="3" y1="16" x2="21" y2="16" />
            {/* Target sensor nodes */}
            <circle cx="9" cy="10" r="1.5" />
            <circle cx="15" cy="16" r="1.5" />
            <circle cx="3" cy="3" r="1" />
            <circle cx="21" cy="3" r="1" />
            <circle cx="21" cy="21" r="1" />
          </>
        );
      case 'clock':
        return (
          <>
            {/* Analog circular enclosure */}
            <circle cx="12" cy="12" r="9" />
            {/* Hours ticks */}
            <line x1="12" y1="3" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="21" />
            <line x1="3" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="21" y2="12" />
            {/* Time pointer hands */}
            <path d="M 12,12 L 15.5,10.5" />
            <path d="M 12,12 L 12,7.5" />
            <circle cx="12" cy="12" r="1" />
          </>
        );
      case 'tv':
        return (
          <>
            {/* Outer cathode tube housing */}
            <rect x="3" y="5" width="18" height="13" />
            {/* Glass screen viewing area */}
            <rect x="5" y="7" width="11" height="9" />
            {/* Rotary dial adjustments */}
            <circle cx="18.5" cy="8" r="1" />
            <circle cx="18.5" cy="12" r="1" />
            {/* Signal input antennas */}
            <path d="M 10,5 L 6,2" />
            <path d="M 14,5 L 18,2" />
          </>
        );
      case 'monitor':
        return (
          <>
            {/* Console frame */}
            <rect x="3" y="4" width="18" height="12" />
            {/* Screen bezel */}
            <rect x="4.5" y="5.5" width="15" height="9" />
            {/* Heavy iron stand */}
            <path d="M 8,16 L 6,20 L 18,20 L 16,16" />
            {/* Scanline signals on console */}
            <line x1="6" y1="9" x2="18" y2="9" />
            <line x1="6" y1="11" x2="18" y2="11" />
          </>
        );
      case 'eye':
        return (
          <>
            {/* Monitored observation port */}
            <path d="M 2,12 C 5,6 19,6 22,12 C 19,18 5,18 2,12 Z" />
            <circle cx="12" cy="12" r="3.8" />
            <circle cx="12" cy="12" r="1.5" />
          </>
        );
      case 'archive':
        return (
          <>
            {/* Heavy file rack frame */}
            <rect x="4" y="3" width="16" height="18" />
            {/* Drawer division lines */}
            <line x1="4" y1="9" x2="20" y2="9" />
            <line x1="4" y1="15" x2="20" y2="15" />
            {/* Pull handles */}
            <line x1="10" y1="6" x2="14" y2="6" />
            <line x1="10" y1="12" x2="14" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </>
        );
      case 'status':
        return (
          <>
            {/* Grid interface axes */}
            <path d="M 4,4 L 4,18 L 20,18" />
            {/* Restored signal trend wave */}
            <path d="M 4,15 C 6,15 8,8 10,12 C 12,16 13.5,6 15,9 C 16.5,12 18.5,14 20,11" />
          </>
        );
      case 'drawer':
        return (
          <>
            {/* Clipboard backing board */}
            <path d="M 6,6 L 6,21 C 6,21.5 6.5,22 7,22 L 17,22 C 17.5,22 18,21.5 18,21 L 18,6" />
            <path d="M 18,6 C 18,5 17,4 16,4 L 14,4 L 14,3 C 14,2.5 13.5,2 13,2 L 11,2 C 10.5,2 10,2.5 10,3 L 10,4 L 8,4 C 7,4 6,5 6,6 Z" />
            {/* Document page lines */}
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="13" y2="17" />
          </>
        );
      case 'prologue':
        return (
          <>
            {/* Open research diary pages */}
            <path d="M 12,19 C 9,19 4,18 3,17 L 3,5 C 4,6 9,7 12,7" />
            <path d="M 12,19 C 15,19 20,18 21,17 L 21,5 C 20,6 15,7 12,7" />
            <line x1="12" y1="7" x2="12" y2="19" />
            {/* Text lines indicator */}
            <line x1="5" y1="10" x2="9" y2="10" />
            <line x1="5" y1="13" x2="9" y2="13" />
            <line x1="15" y1="10" x2="19" y2="10" />
            <line x1="15" y1="13" x2="19" y2="13" />
          </>
        );
      case 'relay':
        return (
          <>
            {/* Electrical schematic switch contactor */}
            <line x1="3" y1="12" x2="7" y2="12" />
            <line x1="17" y1="12" x2="21" y2="12" />
            {/* Contactor arm open */}
            <line x1="7.5" y1="11.5" x2="16.5" y2="7.5" />
            {/* Node junctions */}
            <circle cx="7" cy="12" r="1.2" />
            <circle cx="17" cy="12" r="1.2" />
            {/* Coil actuator wire */}
            <path d="M 9,14 C 9,16 10,17 12,17 C 14,17 15,16 15,14" />
            <line x1="12" y1="17" x2="12" y2="20" />
          </>
        );
      case 'security':
        return (
          <>
            {/* Reinforced heavy shield */}
            <path d="M 12,3 L 4,6 C 4,14 8,18 12,21 C 16,18 20,14 20,6 Z" />
            {/* Inner division line */}
            <line x1="12" y1="3" x2="12" y2="21" />
            <line x1="6" y1="11" x2="18" y2="11" />
          </>
        );
      case 'tuning':
        return (
          <>
            {/* Hardware potentiometer tracks */}
            <line x1="6" y1="4" x2="6" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
            <line x1="18" y1="4" x2="18" y2="20" />
            {/* Sliders knobs */}
            <rect x="4" y="14" width="4" height="2" />
            <rect x="10" y="7" width="4" height="2" />
            <rect x="16" y="11" width="4" height="2" />
          </>
        );
      case 'radar':
        return (
          <>
            {/* Concentric radar feedback circles */}
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.2" />
            {/* Sweeping angle target pointer */}
            <line x1="12" y1="12" x2="18.5" y2="5.5" />
            {/* Targets found */}
            <circle cx="7" cy="9" r="0.8" fill="currentColor" />
            <circle cx="16" cy="15" r="0.6" fill="currentColor" />
          </>
        );
      case 'compass':
        return (
          <>
            {/* Outer bearing ring */}
            <circle cx="12" cy="12" r="9" />
            {/* Core magnetic diamond needle */}
            <path d="M 12,5 L 14.5,12 L 12,19 L 9.5,12 Z" />
            {/* Center pivot */}
            <circle cx="12" cy="12" r="0.8" />
            {/* Major axis markers */}
            <line x1="12" y1="3" x2="12" y2="4.5" />
            <line x1="12" y1="19.5" x2="12" y2="21" />
            <line x1="3" y1="12" x2="4.5" y2="12" />
            <line x1="19.5" y1="12" x2="21" y2="12" />
          </>
        );
      case 'alert':
        return (
          <>
            {/* Warning triangle label */}
            <path d="M 12,3.5 L 2.5,19.5 C 2.2,20 2.5,20.5 3,20.5 L 21,20.5 C 21.5,20.5 21.8,20 21.5,19.5 Z" />
            {/* Exclamation exclamation point */}
            <line x1="12" y1="9" x2="12" y2="14" />
            <circle cx="12" cy="17" r="1" />
          </>
        );
      case 'route':
        return (
          <>
            {/* Waypoints nodes */}
            <circle cx="5" cy="17" r="2.2" />
            <circle cx="12" cy="6" r="2.2" />
            <circle cx="19" cy="13" r="2.2" />
            {/* Dotted vector trace paths */}
            <line x1="6.8" y1="15.2" x2="10.2" y2="7.8" strokeDasharray="2,2" />
            <line x1="13.2" y1="7.2" x2="17.8" y2="11.8" strokeDasharray="2,2" />
          </>
        );
      case 'index':
        return (
          <>
            {/* Schematic directory board */}
            <rect x="5" y="3" width="14" height="18" />
            {/* Check registers */}
            <rect x="7" y="6" width="3" height="3" />
            <line x1="12" y1="7.5" x2="17" y2="7.5" />
            <rect x="7" y="11" width="3" height="3" />
            <line x1="12" y1="12.5" x2="17" y2="12.5" />
            <rect x="7" y="16" width="3" height="3" />
            <line x1="12" y1="17.5" x2="17" y2="17.5" />
          </>
        );
      case 'lock':
        return (
          <>
            {/* Shackle loop */}
            <path d="M 7,11 L 7,6.5 C 7,3.5 9.5,2 12,2 C 14.5,2 17,3.5 17,6.5 L 17,11" />
            {/* Body */}
            <rect x="5" y="11" width="14" height="10" />
            {/* Keyhole */}
            <circle cx="12" cy="15" r="1" />
            <line x1="12" y1="16" x2="12" y2="18.5" />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={filterStyle}
      className={`select-none ${className}`}
      {...props}
    >
      {renderPath()}
    </svg>
  );
};

export const SignalIconFilters: React.FC = () => {
  return (
    <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {/* Distress filter mapping for worn/rough lines */}
        <filter id="distressed-signal-icon">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="3"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
};
