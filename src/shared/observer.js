window.FL = window.FL || {}; var FL = window.FL;

FL.makeObserver = function makeObserver(opts) {
  const { cardSelectors, onSeen } = opts;
  const selectorStr = cardSelectors.join(', ');

  const seen = new WeakSet();
  const timers = new WeakMap();
  const entryTimes = new WeakMap();  // card → ms when it entered viewport
  const positions = new WeakMap();   // card → feed position at registration time
  let feedPosition = 0;
  const positioned = new WeakSet();

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && e.intersectionRatio >= FL.VISIBILITY_RATIO) {
        if (seen.has(e.target)) continue;
        entryTimes.set(e.target, Date.now());
        // Capture now — feedPosition will increment before timeout fires
        const cardPosition = positions.get(e.target) || feedPosition;

        const t = setTimeout(async () => {
          if (seen.has(e.target)) return;
          seen.add(e.target);
          const dwellMs = Date.now() - (entryTimes.get(e.target) || Date.now());
          await onSeen(e.target, cardPosition, dwellMs);
        }, FL.DWELL_MS);
        timers.set(e.target, t);
      } else {
        const t = timers.get(e.target);
        if (t) { clearTimeout(t); timers.delete(e.target); }
        entryTimes.delete(e.target);
      }
    }
  }, { threshold: [FL.VISIBILITY_RATIO] });

  function observeCard(card) {
    if (!positioned.has(card)) {
      positioned.add(card);
      feedPosition++;
      positions.set(card, feedPosition);
    }
    io.observe(card);
  }

  function observeIn(root) {
    const cards = root.querySelectorAll?.(selectorStr) ?? [];
    cards.forEach(observeCard);
  }

  let mo = null;

  function start() {
    observeIn(document.body);
    mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          const isCard = cardSelectors.some(s => n.matches?.(s));
          if (isCard) observeCard(n);
          else observeIn(n);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    console.log('[FeedLens] observer started, selectors:', selectorStr);
  }

  function stop() {
    io.disconnect();
    mo?.disconnect();
  }

  return { start, stop };
};
