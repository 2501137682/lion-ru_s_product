(() => {
  const viewport = document.getElementById("viewport");
  const stage = document.getElementById("stage");
  const mapImg = document.getElementById("mapImg");

  const MIN_SCALE = 0.35;
  const MAX_SCALE = 2.5;

  let scale = 1;
  let x = 0;
  let y = 0;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pointers = new Map();
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  function apply() {
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function clamp() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const mw = mapImg.offsetWidth * scale;
    const mh = mapImg.offsetHeight * scale;

    const minX = Math.min(0, vw - mw);
    const minY = Math.min(0, vh - mh);
    const maxX = Math.max(0, vw - mw);
    const maxY = Math.max(0, vh - mh);

    // Prefer keeping map covering viewport when larger; allow slight overscroll when smaller
    if (mw >= vw) {
      x = Math.min(0, Math.max(minX, x));
    } else {
      x = (vw - mw) / 2;
    }

    if (mh >= vh) {
      y = Math.min(0, Math.max(minY, y));
    } else {
      y = (vh - mh) / 2;
    }

    // silence unused when map smaller
    void maxX;
    void maxY;
  }

  function fitInitial() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const mw = mapImg.naturalWidth || mapImg.offsetWidth;
    const mh = mapImg.naturalHeight || mapImg.offsetHeight;
    if (!mw || !mh) return;

    // Display width of img is CSS width (1400); scale relative to that
    const displayW = mapImg.offsetWidth || 1400;
    const displayH = mapImg.offsetHeight || (displayW * mh) / mw;

    scale = Math.max(vw / displayW, vh / displayH) * 1.05;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    x = (vw - displayW * scale) / 2;
    y = (vh - displayH * scale) / 2;
    // Bias a bit upward so islands feel centered under UI chrome
    y -= 20;
    clamp();
    apply();
  }

  function zoomAt(clientX, clientY, nextScale) {
    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const prev = scale;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    const ratio = scale / prev;
    x = px - (px - x) * ratio;
    y = py - (py - y) * ratio;
    clamp();
    apply();
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  viewport.addEventListener("pointerdown", (e) => {
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      viewport.classList.add("dragging");
    } else if (pointers.size === 2) {
      dragging = false;
      const pts = [...pointers.values()];
      pinchStartDist = distance(pts[0], pts[1]);
      pinchStartScale = scale;
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const dist = distance(pts[0], pts[1]);
      if (pinchStartDist > 0) {
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        zoomAt(midX, midY, pinchStartScale * (dist / pinchStartDist));
      }
      return;
    }

    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    x += dx;
    y += dy;
    clamp();
    apply();
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      pinchStartDist = 0;
    }
    if (pointers.size === 0) {
      dragging = false;
      viewport.classList.remove("dragging");
    } else if (pointers.size === 1) {
      const only = [...pointers.values()][0];
      dragging = true;
      lastX = only.x;
      lastY = only.y;
    }
  }

  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("pointerleave", (e) => {
    if (pointers.has(e.pointerId)) endPointer(e);
  });

  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoomAt(e.clientX, e.clientY, scale * factor);
    },
    { passive: false }
  );

  if (mapImg.complete) {
    fitInitial();
  } else {
    mapImg.addEventListener("load", fitInitial, { once: true });
  }

  window.addEventListener("resize", fitInitial);

  // Floating ad card close
  const poiCard = document.getElementById("poiCard");
  const poiClose = document.getElementById("poiClose");
  if (poiClose && poiCard) {
    poiClose.addEventListener("click", (e) => {
      e.stopPropagation();
      poiCard.classList.add("hidden");
    });
  }

  // Unlock card: click blank area / collect button to close
  const unlockOverlay = document.getElementById("unlockOverlay");
  const unlockSheet = document.getElementById("unlockSheet");
  const collectBtn = document.getElementById("collectBtn");

  function closeUnlock() {
    if (!unlockOverlay) return;
    unlockOverlay.classList.add("hidden");
  }

  if (unlockOverlay && unlockSheet) {
    unlockOverlay.addEventListener("click", closeUnlock);
    unlockSheet.addEventListener("click", (e) => e.stopPropagation());
  }

  if (collectBtn) {
    collectBtn.addEventListener("click", closeUnlock);
  }

  // —— 我的卡片合集 ——
  const deckFab = document.getElementById("deckFab");
  const deckPanel = document.getElementById("deckPanel");
  const deckClose = document.getElementById("deckClose");
  const deckCats = document.getElementById("deckCats");
  const deckCarousel = document.getElementById("deckCarousel");
  const deckCount = document.getElementById("deckCount");
  const deckNowText = document.getElementById("deckNowText");

  const allCards = window.CARD_DECK || [];
  const categories = window.CARD_CATEGORIES || ["全部"];
  let activeCategory = "全部";

  function filteredCards() {
    if (activeCategory === "全部") return allCards;
    return allCards.filter((c) => c.category === activeCategory);
  }

  function renderCats() {
    if (!deckCats) return;
    deckCats.innerHTML = categories
      .map(
        (cat) =>
          `<button type="button" class="deck-cat${
            cat === activeCategory ? " active" : ""
          }" data-cat="${cat}">${cat}</button>`
      )
      .join("");
  }

  function cardHTML(card) {
    const place = `${card.place} · ${card.spot}`;
    return `
      <article class="collect-card" data-id="${card.id}">
        <div class="collect-card-art">
          <img src="${card.cover}" alt="${card.album}" />
          <div class="collect-card-overlay">
            <div class="ov-album">${card.album}</div>
            <div class="ov-artist">${card.artist}</div>
          </div>
          <div class="place-badge"><i class="pin">◎</i><span>${place}</span></div>
        </div>
        <div class="collect-card-foot">
          <img src="${card.cover}" alt="" />
          <div class="collect-card-meta">
            <strong>${card.track}</strong>
            <span>${card.trackArtist}</span>
          </div>
          <span class="check-dot">✓</span>
        </div>
      </article>
    `;
  }

  function updateActiveCard() {
    if (!deckCarousel) return;
    const cards = [...deckCarousel.querySelectorAll(".collect-card")];
    if (!cards.length) return;

    const mid = deckCarousel.scrollLeft + deckCarousel.clientWidth / 2;
    let best = null;
    let bestDist = Infinity;

    cards.forEach((el) => {
      const center = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    });

    cards.forEach((el) => el.classList.toggle("is-active", el === best));

    if (best && deckNowText) {
      const id = Number(best.dataset.id);
      const data = allCards.find((c) => c.id === id);
      if (data) {
        deckNowText.innerHTML = `<strong>${data.track}</strong><span>${data.trackArtist}</span>`;
      }
    }
  }

  function renderCarousel() {
    if (!deckCarousel) return;
    const list = filteredCards();
    if (deckCount) {
      deckCount.textContent = `${list.length}/${allCards.length}`;
    }

    if (!list.length) {
      deckCarousel.innerHTML = `<div class="deck-empty">该分类暂无卡片</div>`;
      if (deckNowText) {
        deckNowText.innerHTML = `<strong>—</strong><span>—</span>`;
      }
      return;
    }

    deckCarousel.innerHTML = list.map(cardHTML).join("");
    deckCarousel.scrollLeft = 0;
    requestAnimationFrame(() => {
      const first = deckCarousel.querySelector(".collect-card");
      if (first) first.classList.add("is-active");
      updateActiveCard();
    });
  }

  function openDeck() {
    if (!deckPanel) return;
    deckPanel.classList.remove("hidden");
    renderCats();
    renderCarousel();
  }

  function closeDeck() {
    if (!deckPanel) return;
    deckPanel.classList.add("hidden");
  }

  if (deckFab) deckFab.addEventListener("click", openDeck);
  if (deckClose) deckClose.addEventListener("click", closeDeck);

  if (deckCats) {
    deckCats.addEventListener("click", (e) => {
      const btn = e.target.closest(".deck-cat");
      if (!btn) return;
      activeCategory = btn.dataset.cat;
      renderCats();
      renderCarousel();
    });
  }

  if (deckCarousel) {
    deckCarousel.addEventListener("scroll", () => {
      window.requestAnimationFrame(updateActiveCard);
    });

    // 鼠标滚轮横向滚动卡片
    deckCarousel.addEventListener(
      "wheel",
      (e) => {
        if (!deckPanel || deckPanel.classList.contains("hidden")) return;
        e.preventDefault();
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        deckCarousel.scrollLeft += delta;
      },
      { passive: false }
    );
  }
})();
