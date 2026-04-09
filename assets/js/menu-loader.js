document.addEventListener("DOMContentLoaded", function () {
  const tabsEl = document.getElementById("menu-tabs");
  const contentEl = document.getElementById("menu-content");
  const toastEl = document.getElementById("menu-update-toast");
  const lastUpdateEl = document.getElementById("menu-last-update");

  if (!tabsEl || !contentEl) return;

  const SHEET_ID = "18ljJSrVfKJnV7ZAZzdQLrNzHjxSS2kpazkWoQOTBxUY";
  const GID = "0";

  const GVIZ_URL =
    SHEET_ID && GID !== ""
      ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${GID}&tqx=out:json`
      : "";

  let lastRenderedData = "";
  let toastTimer = null;

  init();

  async function init() {
    await loadAndRenderMenu();

    setInterval(async () => {
      await loadAndRenderMenu(true);
    }, 30000);
  }

  async function loadAndRenderMenu(isBackgroundRefresh = false) {
    try {
      if (!isBackgroundRefresh) {
        contentEl.innerHTML = `
          <div class="text-center py-5">
            <p>Menü yükleniyor...</p>
          </div>
        `;
      }

      const items = await fetchMenuFromSheets();

      if (!items.length) {
        tabsEl.innerHTML = "";
        contentEl.innerHTML = `
          <div class="text-center py-5">
            <p>Menü bulunamadı.</p>
          </div>
        `;
        return;
      }

      const groupedMenu = groupByCategory(items);
      const newDataString = JSON.stringify(groupedMenu);

      if (newDataString === lastRenderedData) return;

      const hadOldData = lastRenderedData !== "";
      lastRenderedData = newDataString;

      renderMenu(groupedMenu);
      updateLastUpdateTime();

      if (isBackgroundRefresh && hadOldData) {
        showToast("Menü güncellendi");
      }
    } catch (error) {
      console.error("Menü yükleme hatası:", error);

      if (!isBackgroundRefresh) {
        tabsEl.innerHTML = "";
        contentEl.innerHTML = `
          <div class="text-center py-5">
            <p>Menü yüklenirken hata oluştu.</p>
          </div>
        `;
      }
    }
  }

  async function fetchMenuFromSheets() {
    if (!GVIZ_URL) throw new Error("Sheet ayarları eksik");

    const res = await fetch(`${GVIZ_URL}&_=${Date.now()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    return parseGviz(text);
  }

  function parseGviz(text) {
    const jsonStr = text.substring(text.indexOf("{"), text.lastIndexOf(")"));
    const data = JSON.parse(jsonStr);

    const cols = data.table.cols.map((c) => (c.label || "").toLowerCase());

    const get = (row, nameVariants) => {
      const idx = cols.findIndex((c) =>
        nameVariants.some((name) => c === name || c.includes(name))
      );
      return idx >= 0 ? row.c[idx]?.v ?? "" : "";
    };

    return data.table.rows
      .map((row) => ({
        category: String(get(row, ["kategori"])).trim(),
        name: String(get(row, ["ürün", "urun"])).trim(),
        description: String(get(row, ["açıklama", "aciklama"])).trim(),
        price: String(get(row, ["fiyat"])).trim(),
        image: String(get(row, ["resim"])).trim(),
        status: String(get(row, ["durum"])).trim().toLowerCase(),
        stock: String(get(row, ["stok"])).trim().toLowerCase(),
      }))
      .filter((item) => item.name && item.status !== "pasif");
  }

  function groupByCategory(items) {
    const grouped = {};

    items.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });

    return Object.keys(grouped).map((category) => ({
      category,
      items: grouped[category],
    }));
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ş/g, "s")
      .replace(/ü/g, "u")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function renderMenu(menuData) {
    tabsEl.innerHTML = "";
    contentEl.innerHTML = "";

    menuData.forEach((group, index) => {
      const tabId = "menu-" + slugify(group.category);
      const isActive = index === 0 ? "active show" : "";

      tabsEl.innerHTML += `
        <li class="nav-item">
          <a
            class="nav-link ${isActive}"
            data-bs-toggle="tab"
            data-bs-target="#${tabId}"
            href="javascript:void(0)"
          >
            <h4>${group.category}</h4>
          </a>
        </li>
      `;

      contentEl.innerHTML += `
        <div class="tab-pane fade ${isActive}" id="${tabId}">
          <div class="tab-header text-center">
            <p>Menü</p>
            <h3>${group.category}</h3>
          </div>

          <div class="row gy-5">
            ${group.items
              .map((item) => {
                const isOutOfStock = item.stock === "yok";

                return `
                  <div class="col-lg-4 menu-item ${
                    isOutOfStock ? "out-of-stock" : ""
                  }">
                    <div class="menu-card-wrap">
                      ${
                        isOutOfStock
                          ? `<span class="stock-badge">Stokta yok</span>`
                          : ""
                      }

                      <img
                        src="${item.image}"
                        class="menu-img img-fluid"
                        alt="${item.name}"
                        loading="lazy"
                      />

                      <h4>${item.name}</h4>
                      <p class="ingredients">
                        ${item.description || ""}
                        ${
                          isOutOfStock
                            ? `<br><span class="stock-note">Geçici olarak servis dışı</span>`
                            : ""
                        }
                      </p>
                      <p class="price">${item.price}₺</p>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    });
  }

  function showToast(message) {
    if (!toastEl) return;

    toastEl.textContent = message;
    toastEl.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 2500);
  }

  function updateLastUpdateTime() {
    if (!lastUpdateEl) return;

    const now = new Date();

    const date =
      now.getDate().toString().padStart(2, "0") +
      "." +
      (now.getMonth() + 1).toString().padStart(2, "0") +
      "." +
      now.getFullYear();

    lastUpdateEl.textContent = "Son güncelleme: " + date;
  }
});