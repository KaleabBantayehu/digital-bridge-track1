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

  /**
   * Top-bar language switch (signup, profile, jobs): sets lang on every Digital Bridge widget on the page.
   * ?lang=am in the URL, or the learner's last choice on this device, is applied on load.
   */
  function setupWidgetLanguage() {
    const buttons = document.querySelectorAll('[data-db-lang]');
    if (!buttons.length) return;
    const widgets = () =>
      document.querySelectorAll('db-signup, db-onboarding-wizard, db-career-gateway, db-employer-accommodations');
    const apply = (lang) => {
      widgets().forEach((widget) => widget.setAttribute('lang', lang));
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.dbLang === lang)));
      try {
        localStorage.setItem('db-host-lang', lang);
      } catch (error) {
        // Storage blocked: the choice still applies to this page.
      }
    };
    buttons.forEach((button) => button.addEventListener('click', () => apply(button.dataset.dbLang)));
    let initial = new URLSearchParams(location.search).get('lang');
    if (initial !== 'en' && initial !== 'am') {
      try {
        initial = localStorage.getItem('db-host-lang');
      } catch (error) {
        initial = null;
      }
    }
    if (initial === 'en' || initial === 'am') apply(initial);
  }

  function setupAll() {
    setupHostAccessibility();
    setupWidgetLanguage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAll, { once: true });
  } else {
    setupAll();
  }
})();
