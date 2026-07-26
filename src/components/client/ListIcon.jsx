import React from 'react';

/**
 * Ícone de "lista" — uma folha de caderno com linhas de texto e um
 * coraçãozinho no canto inferior, no lugar de um coração sozinho
 * (as Listas não são mais favoritos, e sim listas de compra salvas).
 */
export default function ListIcon({ className = 'w-5 h-5', filled = false, strokeWidth = 2 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 3.5h9l3 3v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
        fillOpacity={filled ? 0.12 : 0}
      />
      <path d="M15 3.5v3h3" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M8 10h6M8 13h6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path
        d="M15.3 17.2c-.5-.5-1.3-.5-1.8 0l-.2.2-.2-.2c-.5-.5-1.3-.5-1.8 0-.5.5-.5 1.3 0 1.8l2 2 2-2c.5-.5.5-1.3 0-1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}
