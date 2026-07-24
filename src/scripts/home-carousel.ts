const carousels = document.querySelectorAll<HTMLElement>('[data-case-carousel]');

carousels.forEach((carousel) => {
  const stage = carousel.closest<HTMLElement>('.home-hero__cases');
  const cards = Array.from(carousel.querySelectorAll<HTMLElement>('.home-hero__case'));
  const current = stage?.querySelector<HTMLElement>('[data-case-current]');
  const progress = stage?.querySelector<HTMLElement>('[data-case-progress]');
  let activeIndex = -1;
  let settleTimer: number | undefined;

  const setActiveCard = (nextIndex: number) => {
    if (nextIndex === activeIndex || !cards[nextIndex]) return;
    const previousIndex = activeIndex;
    activeIndex = nextIndex;

    cards.forEach((card, index) => {
      card.dataset.active = String(index === activeIndex);
    });

    if (current) current.textContent = String(activeIndex + 1).padStart(2, '0');
    if (progress) {
      progress.style.transform = `scaleX(${(activeIndex + 1) / cards.length})`;
    }
    stage?.style.setProperty(
      '--home-hero-carousel-light-x',
      `${18 + (activeIndex / Math.max(cards.length - 1, 1)) * 64}%`,
    );

    if (
      previousIndex >= 0
      && window.matchMedia('(max-width: 720px)').matches
    ) {
      cards[activeIndex].dispatchEvent(new CustomEvent('case-carousel-activate'));
      [activeIndex + 1, activeIndex + 2].forEach((index) => {
        cards[index]?.dispatchEvent(new CustomEvent('case-carousel-prepare'));
      });
    }
  };

  const updateActiveCard = () => {
    settleTimer = undefined;
    const target = carousel.scrollLeft + carousel.clientWidth * .5;
    const nextIndex = cards.reduce((closestIndex, card, index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const closestCard = cards[closestIndex];
      const closestCenter = closestCard.offsetLeft + closestCard.offsetWidth / 2;
      return Math.abs(cardCenter - target) < Math.abs(closestCenter - target)
        ? index
        : closestIndex;
    }, 0);

    setActiveCard(nextIndex);
  };

  const requestUpdate = () => {
    if (settleTimer !== undefined) window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(updateActiveCard, 120);
  };

  carousel.addEventListener('scroll', requestUpdate, { passive: true });
  carousel.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = Math.min(cards.length - 1, Math.max(0, activeIndex + direction));
    cards[nextIndex]?.dispatchEvent(new CustomEvent('case-carousel-prepare'));
    cards[nextIndex]?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  });
  window.addEventListener('resize', requestUpdate, { passive: true });

  carousel.dataset.carouselReady = '';
  updateActiveCard();
});
