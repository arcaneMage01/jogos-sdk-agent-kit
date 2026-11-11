/**
 * page-shell.js — fixes default browser behavior for H5 games.
 *
 * The official technical requirements ask you to handle page scrolling, key events,
 * the context menu outside the canvas, and mobile text selection.
 * These issues still exist after Jogos integration and directly affect QA verdicts.
 *
 * Usage: include it before any other script
 *   <script src="../shared/page-shell.js"></script>
 *
 * Note: no game logic here — this file only handles default browser behavior.
 */
(function () {
  'use strict';

  // Disable wheel scrolling (most engines handle zoom themselves)
  window.addEventListener('wheel', function (e) {
    e.preventDefault();
  }, { passive: false });

  // Disable page scrolling caused by arrow keys / space
  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
    }
  }, { passive: false });

  // Disable the context menu outside the canvas
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  // Mobile double-tap zoom / long-press selection (belt and braces on top of CSS)
  document.addEventListener('dblclick', function (e) {
    e.preventDefault();
  }, { passive: false });

  // Prevent iOS rubber-band scrolling
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
})();
