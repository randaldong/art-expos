import {
  artists,
  artworks,
  chapters,
  exhibition,
  imageAssets,
} from "../data/artworks.js";
import { artistProfiles, curatorialNotes } from "../data/curatorial-notes.js";

const state = {
  activeFilter: "all",
  focusId: 1,
  saved: new Set(JSON.parse(localStorage.getItem("renaissance-saved") || "[]")),
  currentPage: "home",
  searchQuery: "",
  overlay: null,
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const number = (id) => String(id).padStart(2, "0");
const pageIds = new Set(["home", "collection"]);
const overlayIds = new Set(["search", "saved"]);
let revealObserver;
let lastOverlayTrigger = null;

const bookmarkIcon = (filled = false) => `
  <svg viewBox="0 0 24 24" aria-hidden="true" ${filled ? 'fill="currentColor"' : ""}>
    <path d="M6.5 4.3h11v15.4l-5.5-3.4-5.5 3.4V4.3Z"></path>
  </svg>
`;

const artistPortraits = {
  "达·芬奇": "leonardo.png",
  "临摹达·芬奇": "leonardo.png",
  梅尔齐: "melzi.jpg",
  米开朗基罗: "michelangelo.jpg",
  拉斐尔: "raphael.jpg",
  "拉斐尔工作室": "raphael.jpg",
  波提切利: "botticelli.jpg",
  "乔瓦尼·贝利尼": "bellini.jpg",
  乔尔乔内: "giorgione.jpg",
  提香: "titian.jpg",
  丁托列托: "tintoretto.jpg",
  卡拉瓦乔: "caravaggio.jpg",
  老帕尔马: "palma.jpg",
  小巴萨诺: "bassano.jpg",
  蓬托尔莫: "pontormo.jpg",
  布隆齐诺: "bronzino.jpg",
  "罗索·菲奥伦蒂诺": "rosso.jpg",
  "皮耶罗·本奇": "pollaiolo.jpg",
  阿洛里: "allori.jpg",
  孔特: "conte.jpg",
  祖基: "zuccari.jpg",
  斯特拉达诺: "stradano.jpeg",
  "多梅尼科·里乔": "bassano.jpg",
  帕尔米贾尼诺: "parmigianino.jpg",
};

const artworkById = (id) => artworks.find((artwork) => artwork.id === Number(id));

function artistAvatar(artistName) {
  const portrait = artistPortraits[artistName] || "raphael.jpg";

  return `
    <span class="artist-avatar" aria-hidden="true">
      <img src="./assets/artists/${portrait}" alt="" loading="lazy" />
    </span>
  `;
}

function pageFromLocation() {
  const page = new URLSearchParams(window.location.search).get("page");
  if (page === "route") return "collection";
  return pageIds.has(page) ? page : "home";
}

function routeFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const page = pageFromLocation();
  const chapter = params.get("chapter");
  const artworkId = Number(params.get("artwork"));
  const panel = params.get("panel");

  return {
    page,
    activeFilter:
      page === "collection" && chapters.some(({ id }) => id === chapter)
        ? chapter
        : "all",
    searchQuery: params.get("q") || "",
    overlay: overlayIds.has(panel) ? panel : null,
    artworkId: artworkById(artworkId) ? artworkId : null,
    modalEntry: null,
    scroll: { x: 0, y: 0 },
  };
}

function routeUrl({
  page = state.currentPage,
  activeFilter = state.activeFilter,
  searchQuery = state.searchQuery,
  overlay = state.overlay,
  artworkId = null,
}) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("page", page);

  if (page === "collection" && activeFilter !== "all") {
    url.searchParams.set("chapter", activeFilter);
  }
  if (overlay) {
    url.searchParams.set("panel", overlay);
  }
  if (overlay === "search" && searchQuery) {
    url.searchParams.set("q", searchQuery);
  }
  if (artworkId) {
    url.searchParams.set("artwork", artworkId);
  }

  return url;
}

function createHistoryState({
  page = state.currentPage,
  activeFilter = state.activeFilter,
  searchQuery = state.searchQuery,
  overlay = state.overlay,
  artworkId = null,
  modalEntry = history.state?.modalEntry || null,
  scroll = { x: window.scrollX, y: window.scrollY },
} = {}) {
  return {
    page,
    activeFilter,
    searchQuery,
    overlay,
    artworkId,
    modalEntry,
    scroll,
  };
}

function updateRouteLinks() {
  $$("[data-route-page]").forEach((element) => {
    const page = element.dataset.routePage;
    const isActive = state.currentPage === page && !state.overlay;

    element.classList.toggle("is-active", isActive);
    if (element instanceof HTMLAnchorElement) {
      if (isActive) {
        element.setAttribute("aria-current", "page");
      } else {
        element.removeAttribute("aria-current");
      }
    }
  });

  $$("[data-open-overlay]").forEach((element) => {
    element.classList.toggle(
      "is-active",
      state.overlay === element.dataset.openOverlay,
    );
  });
}

function renderPage(page = state.currentPage) {
  state.currentPage = page;

  $$("[data-view]").forEach((view) => {
    view.hidden = view.dataset.view !== page;
  });

  document.body.dataset.page = page;
  document.documentElement.dataset.page = page;
  updateRouteLinks();

  if (page === "collection") {
    renderChapters();
    renderFilters();
    renderGallery();
  }

  observeRevealElements();
}

function saveScrollPosition() {
  history.replaceState(
    createHistoryState(),
    "",
    routeUrl(createHistoryState()),
  );
}

function navigateTo(
  page,
  { activeFilter = state.activeFilter, scrollTarget = null } = {},
) {
  const nextPage = pageIds.has(page) ? page : "home";
  // Leaving for a page always closes any open overlay.
  state.overlay = null;
  saveScrollPosition();
  const nextState = createHistoryState({
    page: nextPage,
    activeFilter: nextPage === "collection" ? activeFilter : "all",
    overlay: null,
    modalEntry: null,
    scroll: { x: 0, y: 0 },
  });

  history.pushState(nextState, "", routeUrl(nextState));
  state.activeFilter = nextState.activeFilter;
  renderPage(nextPage);
  syncOverlays();
  const target = scrollTarget ? document.getElementById(scrollTarget) : null;
  if (target) {
    requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "smooth" }));
  } else {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
}

function bindRouteLinks() {
  $$("[data-route-page]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      navigateTo(element.dataset.routePage, {
        scrollTarget: element.dataset.routeTarget || null,
      });
    });
  });
}

// ---- Overlays (search / saved): float above the page, blur behind ----
function openOverlay(name) {
  if (!overlayIds.has(name)) return;
  if (state.overlay === name) {
    closeOverlay();
    return;
  }
  if (document.activeElement instanceof HTMLElement) {
    lastOverlayTrigger = document.activeElement;
  }
  saveScrollPosition();
  state.overlay = name;
  const nextState = createHistoryState({
    overlay: name,
    modalEntry: "overlay",
    scroll: { x: 0, y: 0 },
  });
  history.pushState(nextState, "", routeUrl(nextState));
  syncOverlays();
}

function closeOverlay() {
  if (!state.overlay) return;
  // Prefer stepping back so the URL/history stays clean; the popstate
  // handler will run syncOverlays().
  if (history.state?.modalEntry === "overlay") {
    history.back();
    return;
  }
  state.overlay = null;
  const nextState = createHistoryState({
    overlay: null,
    modalEntry: null,
  });
  history.replaceState(nextState, "", routeUrl(nextState));
  syncOverlays();
}

function syncOverlays(restoreFocus = true) {
  const active = state.overlay;
  const wasOpen = document.body.classList.contains("overlay-open");
  ["search", "saved"].forEach((name) => {
    const el = $(`#${name}-overlay`);
    if (!el) return;
    const isOpen = active === name;
    el.setAttribute("aria-hidden", String(!isOpen));
    if (isOpen) {
      el.hidden = false;
      requestAnimationFrame(() => {
        if (state.overlay === name) el.classList.add("is-open");
      });
    } else {
      el.classList.remove("is-open");
      window.setTimeout(() => {
        if (state.overlay !== name) el.hidden = true;
      }, 360);
    }
  });

  document.body.classList.toggle("overlay-open", Boolean(active));
  [$(".site-header"), $("main")]
    .filter(Boolean)
    .forEach((element) => {
      element.inert = Boolean(active);
      if (active) {
        element.setAttribute("aria-hidden", "true");
      } else {
        element.removeAttribute("aria-hidden");
      }
    });

  if (active === "search") {
    renderSearch(state.searchQuery);
    const input = $("#search-input");
    const clear = $("#search-clear");
    input.value = state.searchQuery;
    clear.hidden = !state.searchQuery;
    requestAnimationFrame(() => input.focus());
  } else if (active === "saved") {
    renderSaved();
    requestAnimationFrame(() => $("#saved-close")?.focus());
  } else if (wasOpen && restoreFocus) {
    requestAnimationFrame(() => lastOverlayTrigger?.focus());
  }

  updateRouteLinks();
}

function renderChapters() {
  $("#chapter-list").innerHTML = chapters
    .map(
      (chapter, index) => `
        <a class="chapter-card" href="?page=collection&chapter=${chapter.id}" data-chapter="${chapter.id}">
          <span class="chapter-index">${number(index + 1)}</span>
          <span class="chapter-range">
            <span>${chapter.range}</span>
            <strong>${chapter.title}</strong>
          </span>
          <h3>${chapter.title}</h3>
          <p>${chapter.description}</p>
          <span class="chapter-action">
            <span>进入此章</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12h15"></path><path d="m13 6 6 6-6 6"></path>
            </svg>
          </span>
        </a>
      `,
    )
    .join("");

  $$(".chapter-card").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      state.activeFilter = item.dataset.chapter;
      renderFilters();
      renderGallery();
      updateCurrentRoute();
      $("#collection")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  });
}

function renderFilters() {
  const filters = [
    { id: "all", label: "按现场三章 · 全部 36 件" },
    ...chapters.map((chapter) => ({
      id: chapter.id,
      label: `${chapter.range} · ${chapter.title}`,
    })),
  ];

  $("#filter-bar").innerHTML = filters
    .map(
      (filter) => `
        <button class="filter-button ${state.activeFilter === filter.id ? "is-active" : ""}" data-filter="${filter.id}" type="button">
          ${filter.label}
        </button>
      `,
    )
    .join("");

  $$(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter;
      renderFilters();
      renderGallery();
      updateCurrentRoute();
    });
  });
}

function displayedArtworks() {
  const artworkIds =
    state.activeFilter === "all"
      ? chapters.flatMap((chapter) => chapter.ids)
      : chapters.find((chapter) => chapter.id === state.activeFilter).ids;

  return artworkIds.map(artworkById);
}

function cardTemplate(artwork) {
  const saved = state.saved.has(artwork.id);
  return `
    <article class="art-card" data-artwork="${artwork.id}">
      <button class="art-open" type="button" aria-label="打开${artwork.artist}《${artwork.title}》的详情">
        <div class="card-image">
          <img src="${artwork.image}" alt="${artwork.artist}《${artwork.title}》" loading="lazy" />
          <span class="card-no">${number(artwork.id)}</span>
        </div>
        <div class="card-copy">
          <h3>${artwork.title}${artwork.subtitle ? `<span>${artwork.subtitle}</span>` : ""}</h3>
          <p class="post-author">
            ${artistAvatar(artwork.artist)}
            <span>${artwork.artist}</span>
          </p>
        </div>
      </button>
      <button class="save-work ${saved ? "is-saved" : ""}" data-save="${artwork.id}" type="button" aria-label="${saved ? "移出回看册" : "加入回看册"} ${artwork.title}">
        ${bookmarkIcon(saved)}
      </button>
    </article>
  `;
}

function bindArtworkInteractions(parent = document) {
  $$("img", parent).forEach((image) => {
    image.addEventListener("error", () => {
      if (image.dataset.usedFallback) return;
      image.dataset.usedFallback = "true";
      image.src = imageAssets.fallback;
    });
  });

  $$(".art-open", parent).forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.closest("[data-artwork]").dataset.artwork;
      openArtwork(id);
    });
  });

  $$("[data-save]", parent).forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSaved(Number(button.dataset.save));
    });
  });
}

function renderGallery() {
  const artList = displayedArtworks();
  $("#gallery-grid").innerHTML = artList.map(cardTemplate).join("");
  bindArtworkInteractions($("#gallery-grid"));
}

function renderDialog(artwork) {
  const artist = artists[artwork.artist];
  const profile = artistProfiles[artwork.artist];
  const note = curatorialNotes[artwork.id];
  const saved = state.saved.has(artwork.id);
  const sections = [
    ["画面里发生了什么", note?.scene || artwork.look],
    ["画面细读", note?.reading || artwork.clue],
    ["故事底本与时代", note?.story || note?.context || artwork.origin],
    ["画法与材质", note?.technique || artwork.method],
  ];
  const signals = note?.symbols || [];

  $("#dialog-content").innerHTML = `
    <button class="dialog-close" data-dialog-close type="button" aria-label="返回作品长廊" autofocus>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6.8 6.8 10.4 10.4"></path>
        <path d="m17.2 6.8-10.4 10.4"></path>
      </svg>
    </button>
    <div class="dialog-layout" data-artwork="${artwork.id}">
      <div class="dialog-image">
        <img src="${artwork.image}" alt="${artwork.artist}《${artwork.title}》" />
        <span>${artwork.source}</span>
      </div>
      <article class="dialog-copy">
        <section class="artist-first">
          <p class="eyebrow">艺术家</p>
          <h2>${profile?.fullName || artwork.artist}</h2>
          <p class="artist-latin">${profile?.latinName || artwork.artist} · ${profile?.dates || artist?.years || "16世纪"}</p>
          <p class="artist-role">${profile?.lead || ""}</p>
          <p class="artist-lead">${profile?.short || artist?.bio || "本展作品的艺术家信息请以现场展签为准。"}</p>
        </section>
        <header class="artwork-heading">
          <p class="eyebrow">${number(artwork.id)} / 36 · 作品</p>
          <h3>${artwork.title}${artwork.subtitle ? `<span>${artwork.subtitle}</span>` : ""}</h3>
        </header>
        <p class="metadata-label">作品小档案</p>
        <div class="dialog-metadata">
          <span>时期<b>${artwork.period}</b></span>
          <span>题材<b>${artwork.genre}</b></span>
          <span>绘画方式<b>${artwork.medium}</b></span>
          <span>年代<b>${artwork.year}</b></span>
        </div>
        <div class="read-sections">
          ${sections
            .map(
              ([heading, content]) => `
                <section class="read-section">
                  <h3>${heading}</h3>
                  <p>${content}</p>
                </section>
              `,
            )
            .join("")}
        </div>
        <section class="signals-section" aria-labelledby="signals-${artwork.id}">
          <p class="story-kicker">画中暗号</p>
          <h3 id="signals-${artwork.id}">别错过这些细节</h3>
          <div class="signal-list">
            ${signals
              .map(
                ([label, content, evidence]) => `
                  <article class="signal-card">
                    <div>
                      <h4>${label}</h4>
                      <span>${evidence}</span>
                    </div>
                    <p>${content}</p>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="reception-section">
          <p class="story-kicker">它为何重要</p>
          <h3>艺术史怎样看它</h3>
          <p>${note?.reception || "这件作品的题材、画法与流传史，都是理解意大利文艺复兴绘画的重要线索。具体归属与年代仍应以现场展签和馆藏研究为准。"}</p>
        </section>
        <section class="provenance-section">
          <p class="story-kicker">作品来历与研究</p>
          <p>${note?.context || artwork.origin}</p>
        </section>
        <section class="question-card">
          <p class="story-kicker">画前问题</p>
          <h3>${note?.question || "这幅画最关键的细节在哪里？"}</h3>
          <p class="answer-label">参考答案</p>
          <p>${note?.answer || artwork.clue}</p>
        </section>
        <aside class="artist-note">
          <p class="artist-note-kicker">继续认识画家</p>
          <strong>${profile?.fullName || artwork.artist} · ${profile?.place || artist?.school || ""}</strong>
          <p>${profile?.long || ""}</p>
          <p>${artist?.bio || ""}</p>
        </aside>
        <aside class="research-note">
          <p>资料核对</p>
          <span>年代、媒材与展览信息以现场作品标签为准。本页叙述参考中国美术馆官方展讯、乌菲齐公开馆藏资料及相关馆藏说明；存在归属或人物身份争议处，正文已保留说明。</span>
          <a href="${exhibition.officialUrl}" target="_blank" rel="noreferrer">查看官方展讯</a>
        </aside>
        ${
          artwork.imageNote
            ? `<aside class="image-note"><p>图像说明：${artwork.imageNote}</p></aside>`
            : ""
        }
        <button class="dialog-save ${saved ? "is-saved" : ""}" data-save="${artwork.id}" type="button">
          ${bookmarkIcon(saved)} ${saved ? "已在回看册" : "加入回看册"}
        </button>
      </article>
    </div>
  `;
  bindArtworkInteractions($("#dialog-content"));
  $("[data-dialog-close]", $("#dialog-content")).addEventListener("click", closeArtwork);
}

function resetDialogScroll(dialog) {
  const reset = () => {
    dialog.scrollTo({ top: 0, left: 0, behavior: "instant" });
    $(".dialog-shell", dialog)?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  reset();
  dialog.dataset.scrolled = "false";
  requestAnimationFrame(() => {
    reset();
    requestAnimationFrame(reset);
  });
}

function bindDialogScrollFade(dialog) {
  if (dialog.dataset.scrollBound === "true") return;
  dialog.dataset.scrollBound = "true";

  let lastY = 0;
  dialog.addEventListener(
    "scroll",
    () => {
      const y = dialog.scrollTop;
      // Hide the floating close once the reader moves down into the text;
      // bring it back near the top or whenever they scroll up.
      if (y > 96 && y > lastY) {
        dialog.dataset.scrolled = "true";
      } else if (y < 64 || y < lastY) {
        dialog.dataset.scrolled = "false";
      }
      lastY = y;
    },
    { passive: true },
  );
}

function showArtwork(id) {
  const artwork = artworkById(id);
  if (!artwork) return;
  renderDialog(artwork);
  const dialog = $("#art-dialog");
  if (!dialog.open) {
    dialog.showModal();
  }
  bindDialogScrollFade(dialog);
  resetDialogScroll(dialog);
}

function openArtwork(id) {
  const artwork = artworkById(id);
  if (!artwork) return;

  saveScrollPosition();
  // Opening a work supersedes any overlay; hide it so the dialog reads clean
  // and Back from the dialog returns to the underlying page.
  state.overlay = null;
  syncOverlays(false);
  const artworkState = createHistoryState({
    artworkId: artwork.id,
    overlay: null,
    modalEntry: "artwork",
    scroll: { x: 0, y: 0 },
  });
  history.pushState(artworkState, "", routeUrl(artworkState));
  showArtwork(artwork.id);
}

function closeArtwork() {
  const dialog = $("#art-dialog");
  if (!dialog.open) return;

  if (history.state?.modalEntry === "artwork") {
    history.back();
    return;
  }

  dialog.close();
  const nextState = createHistoryState({
    artworkId: null,
    modalEntry: null,
  });
  history.replaceState(nextState, "", routeUrl(nextState));
}

function toggleSaved(id) {
  if (state.saved.has(id)) {
    state.saved.delete(id);
  } else {
    state.saved.add(id);
  }
  localStorage.setItem("renaissance-saved", JSON.stringify([...state.saved]));
  updateSavedCount();
  renderGallery();

  if ($("#art-dialog").open) {
    showArtwork(history.state?.artworkId);
  }
  if (state.overlay === "saved") {
    renderSaved();
  }
}

function updateSavedCount() {
  const count = state.saved.size;
  const badge = $("#saved-count");
  if (badge) {
    badge.textContent = count;
    badge.hidden = count === 0;
  }
}

function renderSearch(query = "") {
  state.searchQuery = query;
  const normalized = query.trim().toLowerCase();
  const matches = normalized
    ? artworks.filter((artwork) =>
        [
          artwork.title,
          artwork.subtitle,
          artwork.artist,
          artwork.genre,
          artwork.period,
          artwork.year,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
    : artworks.slice(0, 7);

  $("#search-results").innerHTML = matches.length
    ? matches
        .map(
          (artwork) => `
          <button class="result-item" type="button" data-result="${artwork.id}">
            <span class="result-no">${number(artwork.id)}</span>
            <img src="${artwork.image}" alt="" />
            <span><strong>${artwork.title}</strong><small>${artwork.artist} · ${artwork.genre}</small></span>
          </button>
        `,
        )
        .join("")
    : `<p class="empty-state">没有找到这件作品。试试艺术家、题材或另一个关键词。</p>`;

  $$("[data-result]", $("#search-results")).forEach((button) => {
    button.addEventListener("click", () => {
      openArtwork(button.dataset.result);
    });
  });
}

function renderSaved() {
  const savedWorks = artworks.filter((artwork) => state.saved.has(artwork.id));
  $("#saved-results").innerHTML = savedWorks.length
    ? savedWorks
        .map(
          (artwork) => `
          <button class="result-item" type="button" data-saved-result="${artwork.id}">
            <span class="result-no">${number(artwork.id)}</span>
            <img src="${artwork.image}" alt="" />
            <span><strong>${artwork.title}</strong><small>${artwork.artist} · ${artwork.period}</small></span>
          </button>
        `,
        )
        .join("")
    : `<p class="empty-state">回看册还是空的。遇到想再看的作品时，点一下书签。</p>`;

  $$("[data-saved-result]", $("#saved-results")).forEach((button) => {
    button.addEventListener("click", () => {
      openArtwork(button.dataset.savedResult);
    });
  });
}

async function spinToRandomWork() {
  const available = artworks.filter((artwork) => artwork.id !== state.focusId);
  state.focusId = available[Math.floor(Math.random() * available.length)].id;
  const next = artworkById(state.focusId);
  if (!next) return state.focusId;

  await heroScene?.setArtwork(next.image);
  $("#hero-art-image").src = next.image;
  $("#hero-art-image").alt = `${next.artist}《${next.title}》`;
  const caption = $(".hero-art figcaption");
  if (caption) {
    caption.innerHTML = `
      <span>${number(next.id)} / 36</span>
      <span>${next.artist} · ${next.title}</span>
    `;
  }
  return state.focusId;
}

function updateCurrentRoute() {
  const nextState = createHistoryState();
  history.replaceState(nextState, "", routeUrl(nextState));
}

function initRevealObserver() {
  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );

  observeRevealElements();
}

function observeRevealElements() {
  if (!revealObserver) return;

  $$(".chapter-card, .ritual-list li").forEach(
    (element, index) => {
      if (element.classList.contains("reveal-on-scroll")) return;
      element.classList.add("reveal-on-scroll");
      element.style.setProperty("--reveal-delay", `${(index % 4) * 55}ms`);
      revealObserver.observe(element);
    },
  );
}

let heroScene = null;

async function initHero3D() {
  const canvas = $("#hero-canvas");
  const heroArt = $(".hero-art");
  if (!canvas || !heroArt) return;

  const initialArtworkId = state.focusId;
  try {
    const { createHeroScene } = await import("./hero3d.js");
    heroScene = await createHeroScene({
      canvas,
      initialImage: artworkById(initialArtworkId)?.image || imageAssets.hero,
      onActivate: () => openArtwork(state.focusId || 1),
    });
  } catch (error) {
    heroScene = null;
  }

  if (heroScene) {
    if (state.focusId !== initialArtworkId) {
      const current = artworkById(state.focusId);
      if (current) await heroScene.setArtwork(current.image);
    }
    // 3D took over — retire the flat CSS frame and reveal the live canvas.
    heroArt.classList.add("is-3d");
    const hint = $("#hero-drag-hint");
    if (hint) {
      const dismiss = () => hint.classList.add("is-hidden");
      canvas.addEventListener("pointerdown", dismiss, { once: true });
      setTimeout(dismiss, 6000);
    }
  } else {
    // No WebGL: keep the CSS frame and its pointer parallax.
    initHeroDepth();
  }
}

function initHeroDepth() {
  const frame = $(".hero-art-frame");
  const hero = $(".hero");
  if (
    !frame ||
    !hero ||
    window.matchMedia("(hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)")
      .matches
  ) {
    return;
  }

  hero.addEventListener("pointermove", (event) => {
    const bounds = hero.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;
    frame.style.setProperty("--frame-rotate-x", `${offsetY * -3.2}deg`);
    frame.style.setProperty("--frame-rotate-y", `${-7 + offsetX * 5.5}deg`);
  });

  hero.addEventListener("pointerleave", () => {
    frame.style.removeProperty("--frame-rotate-x");
    frame.style.removeProperty("--frame-rotate-y");
  });
}

function init() {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || image.dataset.usedFallback) return;
      image.dataset.usedFallback = "true";
      image.src = imageAssets.fallback;
    },
    true,
  );

  // Resolve against the document so CSS vars don't inherit the stylesheet's
  // /assets/ base (which would double the path to /assets/assets/...).
  const absUrl = (path) => new URL(path, window.location.href).href;
  document.documentElement.style.setProperty("--hero-image", `url("${absUrl(imageAssets.hero)}")`);
  document.documentElement.style.setProperty("--closing-image", `url("${absUrl(imageAssets.closing)}")`);
  $("#hero-art-image").src = imageAssets.hero;
  updateSavedCount();
  bindRouteLinks();

  // Top-bar buttons open floating overlays instead of routing to pages.
  $("#open-search").addEventListener("click", () => openOverlay("search"));
  $("#open-saved").addEventListener("click", () => openOverlay("saved"));

  $("#surprise-me").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.classList.add("is-spinning");
    await spinToRandomWork();
    button.classList.remove("is-spinning");
    button.disabled = false;
  });

  // Overlay dismissal: × button, click on scrim, or Escape.
  $$("[data-overlay-dismiss], .overlay-close").forEach((el) => {
    el.addEventListener("click", closeOverlay);
  });

  $("#art-dialog").addEventListener("cancel", (event) => {
    if (!history.state?.artworkId) return;
    event.preventDefault();
    closeArtwork();
  });
  $("#art-dialog").addEventListener("click", (event) => {
    if (event.target === $("#art-dialog") && history.state?.artworkId) {
      closeArtwork();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.overlay && !$("#art-dialog").open) {
      event.preventDefault();
      closeOverlay();
      return;
    }
    if (event.key === "Tab" && state.overlay) {
      const panel = $(`#${state.overlay}-overlay .overlay-panel`);
      const focusable = $$(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        panel,
      ).filter((element) => !element.hidden);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  $("#search-input").addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    renderSearch(state.searchQuery);
    $("#search-clear").hidden = !state.searchQuery;
    updateCurrentRoute();
  });
  $("#search-clear").addEventListener("click", () => {
    state.searchQuery = "";
    $("#search-input").value = "";
    $("#search-clear").hidden = true;
    renderSearch("");
    updateCurrentRoute();
    $("#search-input").focus();
  });

  window.addEventListener("popstate", (event) => {
    const nextState = event.state || routeFromLocation();
    state.currentPage = pageIds.has(nextState.page) ? nextState.page : "home";
    state.activeFilter = nextState.activeFilter || "all";
    state.searchQuery = nextState.searchQuery || "";
    state.overlay = overlayIds.has(nextState.overlay) ? nextState.overlay : null;
    renderPage(state.currentPage);
    syncOverlays();

    if ($("#art-dialog").open) {
      $("#art-dialog").close();
    }
    if (nextState.artworkId) {
      showArtwork(nextState.artworkId);
    }

    requestAnimationFrame(() => {
      window.scrollTo({
        left: nextState.scroll?.x || 0,
        top: nextState.scroll?.y || 0,
        behavior: "instant",
      });
    });
  });

  const initialState = routeFromLocation();
  state.currentPage = initialState.page;
  state.activeFilter = initialState.activeFilter;
  state.searchQuery = initialState.searchQuery;
  state.overlay = initialState.overlay;
  history.replaceState(initialState, "", routeUrl(initialState));
  initRevealObserver();
  renderPage(initialState.page);
  syncOverlays();
  if (initialState.artworkId) {
    showArtwork(initialState.artworkId);
  }
  initHero3D();
}

init();
