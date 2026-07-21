const scene = document.querySelector<HTMLElement>('[data-scroll-scene]');

if (scene) {
  const stageCards = Array.from(scene.querySelectorAll<HTMLElement>('[data-stage-card]'));
  const stageEdge = scene.querySelector<HTMLElement>('[data-stage-edge]');
  const detailCopies = Array.from(scene.querySelectorAll<HTMLElement>('[data-detail-copy]'));
  const intro = scene.querySelector<HTMLElement>('[data-scene-intro]');
  const scrollCue = scene.querySelector<HTMLElement>('[data-scroll-cue]');
  const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const poses = [
    [
      { x: -72, y: 0, rotate: 25, scale: .9, opacity: 1 },
      { x: -24, y: 0, rotate: 25, scale: .87, opacity: 1 },
      { x: 24, y: 0, rotate: 25, scale: .84, opacity: 1 },
      { x: 72, y: 0, rotate: 25, scale: .81, opacity: 1 },
    ],
    [
      { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
      { x: 8, y: 76, rotate: 25, scale: .66, opacity: .52 },
      { x: 13, y: 145, rotate: 25, scale: .62, opacity: .38 },
      { x: 18, y: 208, rotate: 25, scale: .58, opacity: .24 },
    ],
    [
      { x: -30, y: -250, rotate: -16, scale: .7, opacity: 0 },
      { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
      { x: 8, y: 86, rotate: 25, scale: .64, opacity: .46 },
      { x: 14, y: 164, rotate: 25, scale: .6, opacity: .3 },
    ],
    [
      { x: -36, y: -310, rotate: -18, scale: .66, opacity: 0 },
      { x: -30, y: -250, rotate: -16, scale: .7, opacity: 0 },
      { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
      { x: 8, y: 96, rotate: 25, scale: .62, opacity: .42 },
    ],
    [
      { x: -40, y: -340, rotate: -18, scale: .64, opacity: 0 },
      { x: -36, y: -310, rotate: -18, scale: .66, opacity: 0 },
      { x: -30, y: -250, rotate: -16, scale: .7, opacity: 0 },
      { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
    ],
  ];
  const stageThresholds = [.06, .3, .54, .78];
  const stageTransitionDuration = 520;
  let renderedStage = -1;
  let targetStage = 0;
  let ticking = false;
  let transitionTimer: number | undefined;

  const renderStage = (nextStage: number) => {
    const firstRender = renderedStage === -1;
    renderedStage = nextStage;
    scene.dataset.stage = String(nextStage);
    const activeIndex = nextStage - 1;

    stageCards.forEach((card, cardIndex) => {
      if (firstRender) card.style.transition = 'none';
      const pose = poses[nextStage][cardIndex];
      card.style.transform = `translate3d(${pose.x}%, ${pose.y}px, 0) rotateY(${pose.rotate}deg) scale(${pose.scale})`;
      card.style.opacity = String(pose.opacity);
    });

    if (stageEdge) {
      if (firstRender) stageEdge.style.transition = 'none';
      const pose = poses[nextStage][0];
      stageEdge.style.transform = `translate3d(calc(${pose.x}% - 12px), ${pose.y + 8}px, 0) rotateY(${pose.rotate}deg) scale(${pose.scale})`;
      stageEdge.style.opacity = nextStage === 0 ? '1' : '0';
    }

    if (firstRender) {
      requestAnimationFrame(() => {
        stageCards.forEach((card) => card.style.removeProperty('transition'));
        stageEdge?.style.removeProperty('transition');
      });
    }

    if (intro) {
      intro.style.opacity = nextStage === 0 ? '1' : '0';
      intro.style.transform = nextStage === 0 ? 'translateY(0)' : 'translateY(-24px)';
    }
    if (scrollCue) scrollCue.style.opacity = nextStage === 0 ? '1' : '0';

    detailCopies.forEach((copy, index) => {
      const active = index === activeIndex;
      copy.classList.toggle('is-active', active);
      copy.setAttribute('aria-hidden', String(!active));
    });
  };

  const advanceStage = () => {
    if (renderedStage === targetStage || transitionTimer !== undefined) return;

    const direction = Math.sign(targetStage - renderedStage);
    renderStage(renderedStage + direction);

    transitionTimer = window.setTimeout(() => {
      transitionTimer = undefined;
      advanceStage();
    }, stageTransitionDuration);
  };

  const render = () => {
    ticking = false;
    const travel = Math.max(1, scene.offsetHeight - window.innerHeight);
    const progress = clamp((window.scrollY - scene.offsetTop) / travel);
    targetStage = stageThresholds.reduce(
      (stage, threshold) => progress >= threshold ? stage + 1 : stage,
      0,
    );

    if (renderedStage === -1) {
      renderStage(targetStage);
      return;
    }

    advanceStage();
  };

  const requestRender = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(render);
    }
  };

  const scrollToStage = (stage: number) => {
    const travel = Math.max(1, scene.offsetHeight - window.innerHeight);
    const threshold = stageThresholds[stage - 1];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
      top: scene.offsetTop + (threshold + .01) * travel,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  stageCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      const currentStage = Number(scene.dataset.stage);

      if (currentStage === 0) {
        scrollToStage(index + 1);
      } else if (currentStage === index + 1 && card.dataset.stageHref) {
        window.location.assign(card.dataset.stageHref);
      }
    });
  });

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', requestRender);
  render();
}
