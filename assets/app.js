import { artists, artworks, chapters, imageAssets } from "../data/artworks.js";

const state = {
  activeFilter: "all",
  focusId: 15,
  saved: new Set(JSON.parse(localStorage.getItem("renaissance-saved") || "[]")),
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const number = (id) => String(id).padStart(2, "0");

const bookmarkIcon = (filled = false) => `
  <svg viewBox="0 0 24 24" aria-hidden="true" ${filled ? 'fill="currentColor"' : ""}>
    <path d="M6.5 4.3h11v15.4l-5.5-3.4-5.5 3.4V4.3Z"></path>
  </svg>
`;

const arrowIcon = () => `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12h15"></path><path d="m13 6 6 6-6 6"></path>
  </svg>
`;

const artworkById = (id) => artworks.find((artwork) => artwork.id === Number(id));

function renderChapters() {
  $("#chapter-list").innerHTML = chapters
    .map(
      (chapter) => `
        <a class="chapter-card" href="#collection" data-chapter="${chapter.id}">
          <span class="chapter-range">${chapter.range}</span>
          <h3>${chapter.title}</h3>
          <p>${chapter.description}</p>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h15"></path><path d="m13 6 6 6-6 6"></path>
          </svg>
        </a>
      `,
    )
    .join("");

  $$(".chapter-card").forEach((item) => {
    item.addEventListener("click", () => {
      state.activeFilter = item.dataset.chapter;
      renderFilters();
      renderGallery();
    });
  });
}

function renderFilters() {
  const filters = [
    { id: "all", label: "全部 36" },
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
    });
  });
}

function displayedArtworks() {
  if (state.activeFilter === "all") return artworks;
  const chapter = chapters.find((item) => item.id === state.activeFilter);
  return artworks.filter((artwork) => chapter.ids.includes(artwork.id));
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
          <p>${artwork.artist}</p>
          <h3>${artwork.title}${artwork.subtitle ? `<span>${artwork.subtitle}</span>` : ""}</h3>
        </div>
      </button>
      <button class="save-work ${saved ? "is-saved" : ""}" data-save="${artwork.id}" type="button" aria-label="${saved ? "取消收藏" : "收藏"} ${artwork.title}">
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

function renderFocus() {
  const artwork = artworkById(state.focusId);
  $("#focus-work").innerHTML = `
    <div class="focus-layout" data-artwork="${artwork.id}">
      <div class="focus-image">
        <img src="${artwork.image}" alt="${artwork.artist}《${artwork.title}》" />
        <span>${number(artwork.id)} / 36</span>
      </div>
      <div class="focus-copy">
        <p class="eyebrow">${artwork.artist.toUpperCase()} · ${artwork.period}</p>
        <h3>${artwork.title}${artwork.subtitle ? `<span>${artwork.subtitle}</span>` : ""}</h3>
        <p>${artwork.look}</p>
        <button class="detail-link" data-focus-open="${artwork.id}" type="button">
          打开这件作品的慢读卡 ${arrowIcon()}
        </button>
      </div>
    </div>
  `;

  $("[data-focus-open]").addEventListener("click", () => openArtwork(state.focusId));
}

function renderDialog(artwork) {
  const artist = artists[artwork.artist];
  const saved = state.saved.has(artwork.id);
  const sections = [
    ["看什么", artwork.look],
    ["从哪来", artwork.origin],
    ["怎么画", artwork.method],
    ["画面线索", artwork.clue],
  ];

  $("#dialog-content").innerHTML = `
    <div class="dialog-layout" data-artwork="${artwork.id}">
      <div class="dialog-image">
        <img src="${artwork.image}" alt="${artwork.artist}《${artwork.title}》" />
        <span>${artwork.source}</span>
      </div>
      <article class="dialog-copy">
        <p class="eyebrow">${number(artwork.id)} / 36 · ${artwork.artist}</p>
        <h2>${artwork.title}${artwork.subtitle ? `<span>${artwork.subtitle}</span>` : ""}</h2>
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
        <aside class="artist-note">
          <strong>${artwork.artist} · ${artist?.years || "16世纪"}</strong>
          <p>${artist?.bio || "本展作品的艺术家信息请以现场展签为准。"}</p>
        </aside>
        ${
          artwork.imageNote
            ? `<aside class="image-note"><p>图像说明：${artwork.imageNote}</p></aside>`
            : ""
        }
        <button class="dialog-save ${saved ? "is-saved" : ""}" data-save="${artwork.id}" type="button">
          ${bookmarkIcon(saved)} ${saved ? "已加入私人清单" : "加入私人清单"}
        </button>
      </article>
    </div>
  `;
  bindArtworkInteractions($("#dialog-content"));
}

function openArtwork(id) {
  const artwork = artworkById(id);
  if (!artwork) return;
  renderDialog(artwork);
  const dialog = $("#art-dialog");
  dialog.showModal();
  dialog.scrollTop = 0;
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
  renderFocus();

  if ($("#art-dialog").open) {
    renderDialog(artworkById(id));
  }
  if ($("#saved-dialog").open) {
    renderSaved();
  }
}

function updateSavedCount() {
  $("#saved-count").textContent = state.saved.size;
}

function renderSearch(query = "") {
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
      $("#search-dialog").close();
      openArtwork(button.dataset.result);
    });
  });
}

function openSearch() {
  const dialog = $("#search-dialog");
  dialog.showModal();
  const input = $("#search-input");
  input.value = "";
  renderSearch();
  requestAnimationFrame(() => input.focus());
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
    : `<p class="empty-state">还没有收藏。遇到想再看的作品时，点一下书签。</p>`;

  $$("[data-saved-result]", $("#saved-results")).forEach((button) => {
    button.addEventListener("click", () => {
      $("#saved-dialog").close();
      openArtwork(button.dataset.savedResult);
    });
  });
}

function openSaved() {
  renderSaved();
  $("#saved-dialog").showModal();
}

function chooseNextFocus() {
  const available = artworks.filter((artwork) => artwork.id !== state.focusId);
  state.focusId = available[Math.floor(Math.random() * available.length)].id;
  renderFocus();
}

function closeOnBackdrop(dialog) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function init() {
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

  document.documentElement.style.setProperty("--hero-image", `url("${imageAssets.hero}")`);
  document.documentElement.style.setProperty("--closing-image", `url("${imageAssets.closing}")`);
  $("#hero-art-image").src = imageAssets.hero;
  renderChapters();
  renderFilters();
  renderGallery();
  renderFocus();
  updateSavedCount();

  $("#open-search").addEventListener("click", openSearch);
  $("#mobile-search").addEventListener("click", openSearch);
  $("#open-saved").addEventListener("click", openSaved);
  $("#mobile-saved").addEventListener("click", openSaved);
  $("#refresh-focus").addEventListener("click", chooseNextFocus);
  $("#surprise-me").addEventListener("click", () => {
    chooseNextFocus();
    const focusTop = $("#focus").getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: focusTop, behavior: "smooth" });
  });

  $(".art-dialog .dialog-close").addEventListener("click", () => $("#art-dialog").close());
  $("[data-close-search]").addEventListener("click", () => $("#search-dialog").close());
  $("[data-close-saved]").addEventListener("click", () => $("#saved-dialog").close());
  $("#search-input").addEventListener("input", (event) => renderSearch(event.target.value));

  [$("#art-dialog"), $("#search-dialog"), $("#saved-dialog")].forEach(closeOnBackdrop);
}

init();
