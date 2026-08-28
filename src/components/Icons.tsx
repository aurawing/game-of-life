import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function wrap(d: string) {
  return function Icon({ size = 22, ...rest }: P) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
        <path d={d} />
      </svg>
    );
  };
}

export const IconMenu = wrap('M4 6h16M4 12h16M4 18h16');
export const IconPlus = wrap('M12 5v14M5 12h14');
export const IconSend = wrap('M5 12h14M13 6l6 6-6 6');
export const IconMic = wrap('M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM19 11a7 7 0 0 1-14 0M12 18v3');
export const IconStop = wrap('M6 6h12v12H6z');
export const IconPaperclip = wrap('M21.44 11.05l-9.19 9.19a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.82-2.82l8.49-8.48');
export const IconSettings = wrap('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 12h2M19 12h2M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19');
export const IconArchive = wrap('M3 6h18M5 6v14h14V6M10 10h4');
export const IconTrash = wrap('M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12');
export const IconClose = wrap('M6 6l12 12M18 6L6 18');
export const IconChevron = wrap('M6 9l6 6 6-6');
export const IconSearch = wrap('M11 5a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM20 20l-3.5-3.5');
export const IconCamera = wrap('M4 8h4l2-2h4l2 2h4v12H4zM12 11a4 4 0 1 0 0 8 4 4 0 0 0 0-8z');
export const IconImage = wrap('M4 5h16v14H4zM8 13l3 3 4-5 5 7');
export const IconFile = wrap('M7 3h8l5 5v13H7zM15 3v5h5');
export const IconSpark = wrap('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z');
export const IconPlug = wrap('M9 7V3M15 7V3M8 7h8v6a4 4 0 0 1-8 0zM12 17v4');
export const IconCheck = wrap('M5 12l5 5L20 7');
export const IconRestore = wrap('M3 12a9 9 0 1 0 3-6.7M3 4v5h5');
