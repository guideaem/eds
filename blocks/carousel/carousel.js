/**
 * Carousel Block - Adobe Edge Delivery Services
 * Infinite loop via cloned first/last slides.
 *
 * Expected DOM structure from document:
 * +-------------------+
 * | image | text      |  <- slide 1
 * +-------------------+
 * | image | text      |  <- slide 2
 * +-------------------+
 */

function buildSlide(row, index) {
  const slide = document.createElement('li');
  slide.classList.add('carousel-slide');
  slide.setAttribute('role', 'tabpanel');
  slide.setAttribute('aria-roledescription', 'slide');
  slide.setAttribute('aria-label', `Slide ${index + 1}`);
  slide.dataset.slideIndex = index;

  [...row.children].forEach((cell, i) => {
    const div = document.createElement('div');
    div.classList.add(i === 0 ? 'carousel-slide-image' : 'carousel-slide-content');
    div.append(...cell.childNodes);
    slide.append(div);
  });

  return slide;
}

function buildNav(total, block) {
  const prevBtn = document.createElement('button');
  prevBtn.classList.add('carousel-nav', 'carousel-nav-prev');
  prevBtn.setAttribute('aria-label', 'Previous slide');
  prevBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>`;

  const nextBtn = document.createElement('button');
  nextBtn.classList.add('carousel-nav', 'carousel-nav-next');
  nextBtn.setAttribute('aria-label', 'Next slide');
  nextBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>`;

  const dotsNav = document.createElement('ol');
  dotsNav.classList.add('carousel-indicators');
  dotsNav.setAttribute('role', 'tablist');
  dotsNav.setAttribute('aria-label', 'Slide indicators');

  for (let i = 0; i < total; i += 1) {
    const dot = document.createElement('li');
    dot.classList.add('carousel-indicator');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Slide ${i + 1}`);
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.dataset.targetSlide = i;
    dotsNav.append(dot);
  }

  block.append(prevBtn, nextBtn, dotsNav);
}

/**
 * Move the track to a given track position index.
 * animated=false → instant jump (used for the infinite-loop silent teleport).
 */
function moveTrack(track, trackIndex, animated = true) {
  track.style.transition = animated ? '' : 'none';
  track.style.transform = `translateX(-${trackIndex * 100}%)`;
}

function updateDots(block, realIndex) {
  block.querySelectorAll('.carousel-indicator').forEach((dot, i) => {
    const active = i === realIndex;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-selected', String(active));
  });
}

function updateActiveSlide(track, trackIndex) {
  track.querySelectorAll('.carousel-slide').forEach((slide, i) => {
    const active = i === trackIndex;
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', String(!active));
  });
}

function goTo(block, track, state, targetReal, animated = true) {
  // trackIndex = realIndex + 1 because index 0 is the clone-of-last
  const trackIndex = targetReal + 1;
  state.current = targetReal;
  moveTrack(track, trackIndex, animated);
  updateActiveSlide(track, trackIndex);
  updateDots(block, targetReal);
}

function stopAutoplay(state) {
  if (state.autoplayTimer) {
    clearInterval(state.autoplayTimer);
    state.autoplayTimer = null;
  }
}

function initAutoplay(block, track, state) {
  if (!block.dataset.autoplay) return;
  const delay = parseInt(block.dataset.autoplayDelay, 10) || 5000;
  state.autoplayTimer = setInterval(() => {
    goTo(block, track, state, (state.current + 1) % state.total);
  }, delay);
}

function initTouchSwipe(track, onSwipe) {
  let startX = 0;

  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    const delta = e.changedTouches[0].clientX - startX;
    if (Math.abs(delta) > 50) onSwipe(delta < 0 ? 'next' : 'prev');
  }, { passive: true });
}

export default function decorate(block) {
  // Filter out non-slide rows.
  // EDS can inject rows whose only content is navigation markers (>>, <<, >, <)
  // or completely empty rows — these must not become blank slides.
  const rows = [...block.children].filter((row) => {
    const text = row.textContent.trim();
    if (!text) return false; // empty row
    if (/^[<>\s]+$/.test(text)) return false; // only arrow/whitespace chars
    return true;
  });

  const total = rows.length;
  if (total === 0) return;

  const state = { current: 0, total, autoplayTimer: null };

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');
  block.setAttribute('aria-label', 'Featured content');

  // Build real slides
  const realSlides = rows.map((row, i) => buildSlide(row, i));

  /**
   * Track layout:
   * [ clone-of-LAST | slide-0 | slide-1 | ... | slide-N | clone-of-FIRST ]
   *       idx 0          1        2               N+1          N+2
   *
   * Real slide at realIndex lives at trackIndex = realIndex + 1
   */
  const track = document.createElement('ul');
  track.classList.add('carousel-track');
  track.setAttribute('aria-live', 'polite');

  const cloneFirst = realSlides[0].cloneNode(true);
  const cloneLast = realSlides[total - 1].cloneNode(true);
  cloneFirst.classList.add('carousel-clone');
  cloneLast.classList.add('carousel-clone');
  cloneFirst.setAttribute('aria-hidden', 'true');
  cloneLast.setAttribute('aria-hidden', 'true');

  track.append(cloneLast);
  realSlides.forEach((s) => track.append(s));
  track.append(cloneFirst);

  block.innerHTML = '';
  block.append(track);
  buildNav(total, block);

  // Position at real slide 0 instantly (no animation)
  moveTrack(track, 1, false);
  realSlides[0].classList.add('is-active');
  updateDots(block, 0);

  /**
   * After each CSS transition ends, check if we are on a clone.
   * If so, silently teleport to the real counterpart.
   */
  track.addEventListener('transitionend', () => {
    const allSlides = [...track.querySelectorAll('.carousel-slide')];
    const trackTotal = allSlides.length; // total + 2 clones

    // On clone-of-first (last position) → jump to real first
    if (state.current + 1 >= trackTotal - 1) {
      state.current = 0;
      moveTrack(track, 1, false);
      updateActiveSlide(track, 1);
      updateDots(block, 0);
    }
    // On clone-of-last (position 0) → jump to real last
    else if (state.current + 1 <= 0) {
      state.current = total - 1;
      moveTrack(track, total, false);
      updateActiveSlide(track, total);
      updateDots(block, total - 1);
    }
  });

  const goPrev = () => goTo(block, track, state, (state.current - 1 + total) % total);
  const goNext = () => goTo(block, track, state, (state.current + 1) % total);

  // Button clicks
  block.querySelector('.carousel-nav-prev').addEventListener('click', () => {
    stopAutoplay(state);
    goPrev();
  });
  block.querySelector('.carousel-nav-next').addEventListener('click', () => {
    stopAutoplay(state);
    goNext();
  });

  // Dot clicks
  block.querySelectorAll('.carousel-indicator').forEach((dot) => {
    dot.addEventListener('click', () => {
      stopAutoplay(state);
      goTo(block, track, state, parseInt(dot.dataset.targetSlide, 10));
    });
  });

  // Keyboard
  block.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { stopAutoplay(state); goPrev(); }
    else if (e.key === 'ArrowRight') { stopAutoplay(state); goNext(); }
  });

  // Touch swipe
  initTouchSwipe(track, (dir) => {
    stopAutoplay(state);
    if (dir === 'next') goNext();
    else goPrev();
  });

  // Autoplay
  initAutoplay(block, track, state);
}