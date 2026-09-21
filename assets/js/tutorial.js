(function () {
  const dialog = document.getElementById('tutorial');
  const next = document.getElementById('tutorial-next');
  const back = document.getElementById('tutorial-back');
  const demo = document.getElementById('tutorial-demo');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'nas-tutorial-seen-v2';
  const steps = [
    { title: '나스 사용자 매뉴얼', description: '사진과 영상을 보며 하나씩 따라 해보세요.\n시작하기 전에, 매뉴얼 보는 방법을 함께 알아볼게요.', mode: 'overview', label: '실제 매뉴얼 화면' },
    { title: '사진은 클릭해서 크게', description: '마우스를 올리면 사진이 살짝 커집니다.\n클릭하면 부드럽게 확대됩니다.\n사진을 한 번 더 누르면 닫힙니다.', mode: 'photo', label: '클릭 → 확대 → 다시 클릭해서 닫기' },
    { title: '삼각형을 누르면 재생', description: '영상 가운데의 재생 버튼을 눌러보세요.\n실제 작업 순서를 영상으로 볼 수 있어요.\n한 번 더 누르면 잠시 멈춥니다.', mode: 'video', label: '재생 → 따라 하기 → 일시정지' },
    { title: '천천히, 내 속도에 맞게', description: '영상 아래 ‘천천히’와 ‘빠르게’를 눌러\n따라 하기 편한 속도로 바꿔보세요.\n진행 막대로 원하는 장면도 다시 볼 수 있어요.', mode: 'speed', label: '실제 영상으로 속도 조절 시연' }
  ];
  let step = 0;
  let generation = 0;
  let timers = [];
  let pointerFrame = 0;
  let finishing = false;
  let manual = document;
  let manualRequest;
  const pointer = '<span class="tutorial-cursor"><svg viewBox="0 0 32 40" fill="white" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 23V5a3 3 0 0 1 6 0v12-4a3 3 0 0 1 6 0v4-2a3 3 0 0 1 6 0v9c0 7-4 12-10 12h-2c-4 0-6-3-8-6l-5-7c-2-3 1-6 4-4z"/></svg></span><span class="tutorial-click-ring"></span>';
  function later(action, delay) { timers.push(setTimeout(action, delay)); }
  function clearDemo() {
    generation++;
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(pointerFrame);
    demo.replaceChildren();
  }
  // Measure in the preview's coordinate system; the SVG fingertip is (12, 2).
  function pointAt(target, token, action) {
    if (token !== generation || !target || reducedMotion.matches) return;
    cancelAnimationFrame(pointerFrame);
    const cursor = demo.querySelector('.tutorial-cursor');
    const ring = demo.querySelector('.tutorial-click-ring');
    ring.getAnimations().forEach(animation => animation.cancel());
    const origin = {
      x: parseFloat(cursor.style.left) || demo.clientWidth - 50,
      y: parseFloat(cursor.style.top) || demo.clientHeight - 55
    };
    const start = performance.now();
    let clicked = false;
    function follow(now) {
      if (token !== generation || !dialog.open || !target.isConnected) return;
      const bounds = demo.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - bounds.left - demo.clientLeft + demo.scrollLeft;
      const y = rect.top + rect.height / 2 - bounds.top - demo.clientTop + demo.scrollTop;
      const progress = Math.min(1, (now - start) / 650);
      const ease = 1 - Math.pow(1 - progress, 3);
      cursor.style.opacity = '1';
      cursor.style.left = (origin.x + (x - origin.x) * ease) + 'px';
      cursor.style.top = (origin.y + (y - origin.y) * ease) + 'px';
      ring.style.left = x + 'px';
      ring.style.top = y + 'px';
      if (progress === 1 && !clicked) {
        clicked = true;
        ring.animate([
          { opacity: 1, transform: 'scale(.6)' },
          { opacity: 0, transform: 'scale(1.5)' }
        ], { duration: 450 });
        action();
      }
      pointerFrame = requestAnimationFrame(follow);
    }
    pointerFrame = requestAnimationFrame(follow);
  }
  function runPhoto(scene, token) {
    if (token !== generation || reducedMotion.matches) return;
    const photo = scene.querySelector('.zoom-button');
    pointAt(photo, token, () => {
      photo.animate([
        { transform: 'scale(1)', boxShadow: '0 0 0 120px #0f2f5400' },
        { transform: 'scale(1.035)', offset: .12 },
        { transform: 'translateY(-24px) scale(1.15)', boxShadow: '0 0 0 120px #0f2f54b8', offset: .3 },
        { transform: 'translateY(-24px) scale(1.15)', boxShadow: '0 0 0 120px #0f2f54b8', offset: .8 },
        { transform: 'scale(1)', boxShadow: '0 0 0 120px #0f2f5400' }
      ], { duration: 3300, easing: 'ease-in-out' });
      later(() => runPhoto(scene, token), 4200);
    });
  }
  function cleanClone(source) {
    const clone = source.cloneNode(true);
    [clone, ...clone.querySelectorAll('[id]')].forEach(node => node.removeAttribute('id'));
    clone.querySelectorAll('.gif-controls, .gif-hint, .gif-center-play').forEach(node => node.remove());
    clone.querySelectorAll('.gif-player-host').forEach(node => node.classList.remove('gif-player-host'));
    clone.querySelectorAll('img').forEach(img => {
      if (img.dataset.gifSource) img.src = img.dataset.gifSource;
      delete img.dataset.gifSource;
      img.style.visibility = '';
      img.loading = 'eager';
    });
    return clone;
  }
  function runVideo(scene, token, mode, attempts = 0) {
    if (token !== generation || !dialog.open || reducedMotion.matches) return;
    const toggle = scene.querySelector('.gif-toggle');
    if (!toggle || toggle.disabled) {
      if (attempts < 80) later(() => runVideo(scene, token, mode, attempts + 1), 150);
      return;
    }
    const surface = scene.querySelector('.zoom-button');
    pointAt(surface, token, () => {
      toggle.click();
      const pause = () => pointAt(surface, token, () => {
        toggle.click();
        later(() => runVideo(scene, token, mode), 1200);
      });
      if (mode === 'speed') {
        later(() => {
          const slow = scene.querySelector('[data-speed="0.5"]');
          pointAt(slow, token, () => {
            slow.click();
            later(() => {
              const fast = scene.querySelector('[data-speed="1"]');
              pointAt(fast, token, () => {
                fast.click();
                later(pause, 2200);
              });
            }, 2200);
          });
        }, 1000);
      } else later(pause, 4000);
    });
  }
  async function populate(token) {
    if (!manual.querySelector('#main .step-card')) {
      demo.textContent = '매뉴얼 화면을 불러오는 중…';
      try {
        if (!manualRequest) manualRequest = fetch('index.html').then(response => {
          if (!response.ok) throw new Error('manual');
          return response.text();
        }).then(html => new DOMParser().parseFromString(html, 'text/html'));
        manual = await manualRequest;
      } catch (_) {
        if (token === generation) demo.textContent = '매뉴얼을 열면 사진과 영상을 직접 확인할 수 있어요.';
        manualRequest = null;
        return;
      }
    }
    if (token !== generation) return;
    demo.replaceChildren();
    const scene = document.createElement('div');
    scene.className = 'tutorial-scene';
    const mode = steps[step].mode;
    if (mode === 'overview') {
      const overview = document.createElement('div');
      overview.className = 'tutorial-overview';
      const hero = manual.querySelector('#main .hero');
      const contents = manual.querySelector('#main nav');
      if (hero) overview.append(cleanClone(hero));
      if (contents) overview.append(cleanClone(contents));
      scene.append(overview);
    } else {
      const images = [...manual.querySelectorAll('#main .step-card img')];
      const source = images.find(img => /\.gif(?:$|[?#])/i.test(img.dataset.gifSource || img.getAttribute('src')) === (mode !== 'photo'));
      if (!source) return;
      scene.append(cleanClone(source.closest('.step-card')));
    }
    demo.append(scene);
    if (mode !== 'overview') demo.insertAdjacentHTML('beforeend', pointer);
    // Wait until the entrance animation has settled before demonstrating a click.
    if (mode === 'photo') later(() => runPhoto(scene, token), 800);
    if (mode === 'video' || mode === 'speed') later(() => runVideo(scene, token, mode), 800);
  }
  function render() {
    clearDemo();
    document.getElementById('tutorial-title').textContent = steps[step].title;
    document.getElementById('tutorial-description').textContent = steps[step].description;
    document.getElementById('tutorial-demo-label').textContent = steps[step].label;
    demo.dataset.mode = steps[step].mode;
    const copy = dialog.querySelector('.tutorial-copy');
    if (!reducedMotion.matches && copy.animate) copy.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 450 });
    document.getElementById('tutorial-step').textContent = String(step + 1).padStart(2, '0') + ' / 04';
    document.getElementById('tutorial-progress').innerHTML = steps.map((_, index) => '<span class="' + (index === step ? 'active' : '') + '"></span>').join('');
    back.hidden = step === 0;
    next.textContent = step === steps.length - 1 ? '시작하기 →' : '다음 →';
    populate(generation);
  }
  async function finish(animate = false) {
    if (finishing) return;
    finishing = true;
    next.disabled = true;
    back.disabled = true;
    try { sessionStorage.setItem(storageKey, '1'); } catch (_) {}
    const content = dialog.querySelector('.tutorial-content');
    if (animate && !reducedMotion.matches && content.animate) {
      const exit = content.animate([
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(-18px) scale(.98)' }
      ], { duration: 300, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
      await exit.finished.catch(() => {});
      dialog.close();
      exit.cancel();
    } else {
      dialog.close();
    }
    clearDemo();
    document.documentElement.classList.remove('tutorial-open');
    if (animate && !reducedMotion.matches) {
      document.querySelectorAll('body > .topbar, body > .layout').forEach((element, index) => {
        if (!element.animate) return;
        element.animate([
          { opacity: 0, transform: 'translateY(' + (index ? 24 : 8) + 'px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 550, delay: index * 70, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      });
    }
    document.getElementById('main').setAttribute('tabindex', '-1');
    document.getElementById('main').focus({ preventScroll: true });
    next.disabled = false;
    back.disabled = false;
    finishing = false;
  }
  function open() {
    step = 0;
    document.documentElement.classList.add('tutorial-open');
    dialog.showModal();
    render();
    dialog.scrollTop = 0;
    next.focus({ preventScroll: true });
  }
  next.addEventListener('click', () => {
    if (step === steps.length - 1) return finish(true);
    step++;
    render();
    next.focus({ preventScroll: true });
  });
  back.addEventListener('click', () => { step--; render(); next.focus({ preventScroll: true }); });
  document.getElementById('tutorial-reopen').addEventListener('click', open);
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
  let seen = false;
  try { seen = sessionStorage.getItem(storageKey) === '1'; } catch (_) {}
  if (!seen) open();
}());
