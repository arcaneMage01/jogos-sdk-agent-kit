/**
 * page-shell.js — H5 游戏的浏览器默认行为修复。
 *
 * 官方《技术要求》里要求处理：页面滚动、按键事件、画布外右键菜单、移动端选中。
 * 这三个问题在接入 Jogos 后依然存在，且会直接影响 QA 判定。
 *
 * 用法：在所有脚本之前引入
 *   <script src="../shared/page-shell.js"></script>
 *
 * 注意：不要在这里做游戏逻辑；这里只处理浏览器默认行为。
 */
(function () {
  'use strict';

  // 禁用滚轮滚动页面（很多引擎自己处理缩放）
  window.addEventListener('wheel', function (e) {
    e.preventDefault();
  }, { passive: false });

  // 禁用方向键/空格导致的页面滚动
  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
    }
  }, { passive: false });

  // 禁用画布外右键菜单
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  // 移动端双击缩放 / 长按选择（CSS 之外的双保险）
  document.addEventListener('dblclick', function (e) {
    e.preventDefault();
  }, { passive: false });

  // 阻止 iOS 橡皮筋滚动
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
})();
