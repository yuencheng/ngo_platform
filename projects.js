// 專案列表：SDGs 篩選（圓盤與篩選列皆可設定條件，可複選）
//          ＋ 專案詳情分頁路由（以網址 hash 切換）
(function () {
    // ---- 詳情分頁：列表 / 詳情兩個檢視，用網址 hash 決定顯示哪一個 ----
    var indexView = document.getElementById("indexView");
    var pages = Array.prototype.slice.call(document.querySelectorAll(".project-page"));

    // 捲動到指定元素。偏移量直接取自該元素自身的 scroll-margin-top
    // （CSS 已為 #top / #projects / #about 設好 calc(var(--nav-h) + 16px)），
    // 所以 JS 捲動與瀏覽器原生錨點會停在同一位置。
    function scrollToEl(el) {
        if (!el) return;
        window.requestAnimationFrame(function () {
            var margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
            var y = el.getBoundingClientRect().top + window.pageYOffset - margin;
            window.scrollTo(0, Math.max(0, y));
        });
    }

    if (pages.length) {
        var render = function () {
            var id = decodeURIComponent(location.hash.replace(/^#/, ""));
            var target = null;
            pages.forEach(function (p) { if (p.id === id) target = p; });

            if (target && indexView) {
                // 進入專案詳情分頁
                indexView.hidden = true;
                pages.forEach(function (p) { p.hidden = p !== target; });
                window.scrollTo(0, 0);
            } else {
                // 回到專案列表
                if (indexView) indexView.hidden = false;
                pages.forEach(function (p) { p.hidden = true; });
                // 由詳情頁返回，或點選導覽列錨點時，捲到對應區塊
                if (id) scrollToEl(document.getElementById(id));
            }
        };

        window.addEventListener("hashchange", render);
        render();
    }

    // ---- 依 SDGs 篩選 project（複選：符合任一個被選取的目標就顯示） ----
    var projects = document.querySelectorAll(".project");
    var filterBar = document.getElementById("filterBar");
    var filterLabel = document.getElementById("filterLabel");
    var filterClear = document.getElementById("filterClear");
    // 專案成果、提案列表各有一個「無符合項目」提示
    var emptyMsgs = document.querySelectorAll(".filter-empty");
    var addToggle = document.getElementById("filterAddToggle");
    var menu = document.getElementById("filterMenu");
    if (!filterBar || !filterLabel || !filterClear) return;

    // 選單選項來自 sdgs.js：名稱與色碼只有單一來源
    var goals = window.OD_SDGS_GOALS || [];

    if (addToggle && menu && goals.length) {
        goals.forEach(function (goal) {
            var item = document.createElement("button");
            item.type = "button";
            item.className = "filter-menu-item";
            item.dataset.index = String(goal.index);
            item.style.setProperty("--c", goal.color);
            item.setAttribute("aria-pressed", "false");
            item.innerHTML = "<b>" + goal.index + "</b><span>" + goal.name + "</span>";
            // 交給 sdgs.js 切換，連同圓盤上的選取狀態一起同步
            item.addEventListener("click", function () {
                window.dispatchEvent(new CustomEvent("sdgs:toggle", { detail: { index: goal.index } }));
            });
            menu.appendChild(item);
        });
    } else if (addToggle) {
        addToggle.hidden = true;
    }

    function setMenuOpen(open) {
        if (!menu || !addToggle) return;
        menu.hidden = !open;
        addToggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    // 讓選單項目的選取狀態與目前的篩選條件同步
    function syncMenu(selected) {
        if (!menu) return;
        Array.prototype.forEach.call(menu.children, function (el) {
            var on = selected.indexOf(el.dataset.index) !== -1;
            el.classList.toggle("is-active", on);
            el.setAttribute("aria-pressed", on ? "true" : "false");
        });
    }

    function renderPills(items) {
        filterLabel.innerHTML = "";
        var prefix = document.createElement("span");
        prefix.className = "filter-bar-prefix";
        prefix.textContent = "篩選：";
        filterLabel.appendChild(prefix);

        items.forEach(function (it) {
            var pill = document.createElement("span");
            pill.className = "filter-pill";
            pill.style.setProperty("--c", it.color);
            pill.innerHTML = "<b>" + it.index + "</b>" + it.name;

            var rm = document.createElement("button");
            rm.type = "button";
            rm.className = "filter-pill-remove";
            rm.setAttribute("aria-label", "移除「" + it.name + "」篩選");
            rm.textContent = "×";
            rm.addEventListener("click", function () {
                // 交給 sdgs.js 處理：連同圓盤上的選取狀態一起取消
                window.dispatchEvent(new CustomEvent("sdgs:untoggle", { detail: { index: it.index } }));
            });
            pill.appendChild(rm);

            filterLabel.appendChild(pill);
        });
    }

    function applyFilter(items) {
        items = items || [];
        var selected = items.map(function (it) { return String(it.index); });

        if (!items.length) {
            projects.forEach(function (p) { p.hidden = false; });
            filterLabel.innerHTML =
                '<span class="filter-bar-hint">尚未選擇條件 — 點「加入條件」，或點選上方 SDGs 圓盤的編號</span>';
            filterClear.hidden = true;
            emptyMsgs.forEach(function (m) { m.hidden = true; });
            syncMenu(selected);
            return;
        }

        // 專案卡片與提案卡片一起篩選
        projects.forEach(function (p) {
            var tags = (p.dataset.sdgs || "").split(",").map(function (s) { return s.trim(); });
            p.hidden = !tags.some(function (t) { return selected.indexOf(t) !== -1; });
        });

        renderPills(items);
        filterClear.hidden = false;
        // 各區塊分別判斷：該區塊內沒有任何卡片符合時才顯示提示
        emptyMsgs.forEach(function (m) {
            var sec = m.closest(".section");
            m.hidden = !!(sec && sec.querySelector(".project:not([hidden])"));
        });
        syncMenu(selected);
    }

    // 把目前顯示中的分頁（專案成果 #projects 或提案列表 #proposal）捲進視野。
    // 不使用 scrollIntoView，避免影響嵌入預覽；偏移量由該區塊自身的 scroll-margin-top 決定。
    function scrollToProjects() {
        var proposal = document.getElementById("proposal");
        var onProposal = proposal && !proposal.hidden;
        scrollToEl(onProposal ? proposal : document.getElementById("projects"));
    }

    // SDGs 圓盤在 sdgs.js 裡送出的篩選事件（點擊扇形加入／移出篩選條件）
    window.addEventListener("sdgs:filter", function (e) {
        var detail = e.detail || {};
        var items = detail.items || [];
        applyFilter(items);
        // 從圓盤點選目標後，把下方目前分頁的列表捲進視野，讓使用者馬上看到篩選結果。
        // 篩選列上的操作（source: external）不會觸發捲動。
        if (detail.source === "wheel" && items.length) scrollToProjects();
    });

    // 「加入條件」選單：開合，點擊外部或按 Esc 關閉
    if (addToggle && menu) {
        addToggle.addEventListener("click", function () {
            setMenuOpen(menu.hidden);
        });
        document.addEventListener("click", function (e) {
            if (menu.hidden) return;
            if (addToggle.contains(e.target) || menu.contains(e.target)) return;
            setMenuOpen(false);
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !menu.hidden) {
                setMenuOpen(false);
                addToggle.focus();
            }
        });
    }

    // 「清除篩選」按鈕：請 sdgs.js 把圓盤上所有選取狀態也一併重設
    filterClear.addEventListener("click", function () {
        window.dispatchEvent(new CustomEvent("sdgs:reset"));
    });

    // 初始狀態（尚未選擇任何條件）
    applyFilter([]);
})();
