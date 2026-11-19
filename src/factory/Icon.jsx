import React from 'react'
// Pictogrammes au trait (24×24). Plusieurs tracés séparés par « | ».
const P = {
  home: 'M4 4h7v7H4z|M13 4h7v4h-7z|M13 10h7v10h-7z|M4 13h7v7H4z',
  inbox: 'M3 13l3-8h12l3 8v6H3z|M3 13h5l1 3h6l1-3h5',
  play: 'M7 4l13 8-13 8z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  bot: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z|M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z',
  learn: 'M3 17l5-5 4 4 8-8|M15 8h5v5',
  image: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z|M3 16l5-5 4 4 3-3 6 6|M9 9h.01',
  film: 'M4 4h16v16H4z|M8 4v16|M16 4v16|M4 9h4M4 15h4M16 9h4M16 15h4',
  folder: 'M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1z',
  menu: 'M4 7h16M4 12h16M4 17h10',
  out: 'M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4|M10 8l-4 4 4 4|M6 12h10',
  refresh: 'M20 11a8 8 0 10-2.3 5.7|M20 4v7h-7',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18z|M12 7v5l3 2',
  send: 'M4 12l16-8-6 16-3-7z|M11 13l9-9',
  check: 'M5 12.5l4.5 4.5L19 7',
  arrow: 'M5 12h14|M13 6l6 6-6 6',
  server: 'M4 4h16v6H4z|M4 14h16v6H4z|M8 7h.01M8 17h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6z|M19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L14.5 3h-5l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.4 2.6h5l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z',
}
export default function Icon({ n, s }) {
  return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(P[n] || P.home).split('|').map((d, i) => <path key={i} d={d} />)}</svg>
}
