(() => {
  'use strict';

  function setupHostAccessibility() {
    const sidebarButton = document.querySelector('.hamburger');
    if (sidebarButton) {
      const updateExpandedState = () => {
        sidebarButton.setAttribute(
          'aria-expanded',
          String(!document.body.classList.contains('sidebar-collapsed')),
        );
      };
      updateExpandedState();
      new MutationObserver(updateExpandedState).observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    const curriculumBar = document.getElementById('student-current-curriculum');
    if (curriculumBar) {
      document.addEventListener('focusin', (event) => {
        if (!(event.target instanceof Element)) return;
        const target = event.target.getBoundingClientRect();
        const bar = curriculumBar.getBoundingClientRect();
        if (target.top < bar.bottom && target.bottom > bar.top) {
          curriculumBar.classList.add('current-curriculum-hidden');
        }
      });
    }

    const modalHost = document.getElementById('static-track-modals');
    const markdownGuide = modalHost?.querySelector('#markdown-guide-modal');
    if (modalHost && markdownGuide) {
      new MutationObserver(() => {
        modalHost.querySelectorAll('#markdown-guide-modal').forEach((modal) => {
          if (modal !== markdownGuide) modal.remove();
        });
        if (!modalHost.contains(markdownGuide)) modalHost.append(markdownGuide);
      }).observe(modalHost, { childList: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHostAccessibility, { once: true });
  } else {
    setupHostAccessibility();
  }
})();
