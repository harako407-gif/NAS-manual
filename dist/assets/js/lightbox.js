(function () {
  const box = document.getElementById('lightbox');
  const full = document.getElementById('lightboxImage');
  const close = document.getElementById('closeLightbox');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let opener;
  let closing = false;

  full.tabIndex = 0;
  full.setAttribute('role', 'button');
  full.setAttribute('aria-label', '확대된 사진 닫기');
  full.title = '한 번 더 누르면 닫힙니다';

  document.querySelectorAll('#main .zoom-button').forEach(button => {
    button.addEventListener('click', () => {
      if (box.classList.contains('open')) return;
      const image = button.querySelector('img');
      opener = button;
      full.src = image.dataset.gifSource || image.src;
      full.alt = image.alt;
      box.classList.add('open');
      document.documentElement.classList.add('lightbox-open');
      if (!reducedMotion.matches && full.animate) {
        box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
        full.animate([
          { transform: 'scale(.84)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 }
        ], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
      close.focus({ preventScroll: true });
    });
  });

  async function closeBox() {
    if (!box.classList.contains('open') || closing) return;
    closing = true;
    if (!reducedMotion.matches && full.animate) {
      full.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)' }], {
        duration: 180, easing: 'ease-in', fill: 'forwards'
      });
      const fade = box.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 180, easing: 'ease-in', fill: 'forwards'
      });
      await fade.finished.catch(() => {});
    }
    box.classList.remove('open');
    [box, full].forEach(element => element.getAnimations().forEach(animation => animation.cancel()));
    full.removeAttribute('src');
    document.documentElement.classList.remove('lightbox-open');
    opener?.focus({ preventScroll: true });
    closing = false;
  }

  full.addEventListener('click', closeBox);
  full.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      closeBox();
    }
  });
  close.addEventListener('click', closeBox);
  box.addEventListener('click', event => { if (event.target === box) closeBox(); });
  document.addEventListener('keydown', event => {
    if (!box.classList.contains('open')) return;
    if (event.key === 'Escape') closeBox();
    if (event.key === 'Tab') {
      event.preventDefault();
      (document.activeElement === close ? full : close).focus();
    }
  });
}());
