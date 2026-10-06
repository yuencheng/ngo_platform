// 活動列表：顯示已上架的活動，並提供「上架活動」表單
// 資料存取交給 store.js（window.OD_STORE）
(function () {
    var store = window.OD_STORE;
    var list = document.getElementById("eventList");
    var empty = document.getElementById("eventEmpty");
    var addBtn = document.getElementById("eventAddBtn");
    var dialog = document.getElementById("eventDialog");
    var form = document.getElementById("eventForm");
    var picker = document.getElementById("eventSdgPicker");
    var errorMsg = document.getElementById("eventFormError");
    if (!store || !list || !dialog || !form) return;

    // SDGs 名稱與色碼來自 sdgs.js，只有單一來源
    var goals = window.OD_SDGS_GOALS || [];
    var goalByIndex = {};
    goals.forEach(function (g) { goalByIndex[g.index] = g; });

    var WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

    function todayStr() {
        var d = new Date();
        var pad = function (n) { return (n < 10 ? "0" : "") + n; };
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }

    // "2026-10-18" + "14:00" → "2026/10/18（六）14:00"
    function formatDate(date, time) {
        var p = date.split("-");
        var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        return p.join("/") + "（" + WEEKDAYS[d.getDay()] + "）" + (time ? " " + time : "");
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    // 只接受 http(s) 連結，避免 javascript: 之類的網址被放進 href
    function safeUrl(url) {
        try {
            var u = new URL(url);
            return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
        } catch (e) {
            return "";
        }
    }

    // ---- 列表 ----
    function render() {
        var today = todayStr();
        // 即將舉行的活動依日期由近到遠排在前面，已結束的排在最後（最近結束的在前）
        var events = store.listEvents().slice().sort(function (a, b) {
            var ap = a.date < today, bp = b.date < today;
            if (ap !== bp) return ap ? 1 : -1;
            var ka = a.date + (a.time || ""), kb = b.date + (b.time || "");
            return ap ? (ka < kb ? 1 : -1) : (ka < kb ? -1 : 1);
        });

        list.innerHTML = "";
        empty.hidden = events.length > 0;

        events.forEach(function (ev) {
            var past = ev.date < today;
            var card = el("article", "event-card" + (past ? " is-past" : ""));

            var when = el("p", "event-when");
            when.appendChild(el("span", null, formatDate(ev.date, ev.time)));
            if (past) when.appendChild(el("span", "event-status", "已結束"));
            card.appendChild(when);

            card.appendChild(el("h3", "event-title", ev.title));
            card.appendChild(el("p", "project-org", ev.org));
            card.appendChild(el("p", "event-place", ev.place));
            if (ev.desc) card.appendChild(el("p", "project-summary", ev.desc));

            if (ev.sdgs && ev.sdgs.length) {
                var tags = el("ul", "sdg-tags");
                tags.setAttribute("aria-label", "本活動對應的 SDGs");
                ev.sdgs.forEach(function (n) {
                    var g = goalByIndex[n];
                    if (!g) return;
                    var li = el("li", "sdg-tag");
                    li.style.setProperty("--c", g.color);
                    li.appendChild(el("b", null, String(n)));
                    li.appendChild(document.createTextNode(g.name));
                    tags.appendChild(li);
                });
                card.appendChild(tags);
            }

            var actions = el("div", "event-actions");
            var href = ev.link && safeUrl(ev.link);
            if (href && !past) {
                var a = el("a", "event-link", "前往報名");
                a.href = href;
                a.target = "_blank";
                a.rel = "noopener";
                actions.appendChild(a);
            }
            var rm = el("button", "event-remove", "下架");
            rm.type = "button";
            rm.addEventListener("click", function () {
                if (window.confirm("確定要下架「" + ev.title + "」嗎？")) store.removeEvent(ev.id);
            });
            actions.appendChild(rm);
            card.appendChild(actions);

            list.appendChild(card);
        });
    }

    // ---- 表單 ----
    goals.forEach(function (g) {
        var label = el("label", "sdg-pick");
        label.style.setProperty("--c", g.color);
        var input = document.createElement("input");
        input.type = "checkbox";
        input.name = "sdgs";
        input.value = String(g.index);
        label.appendChild(input);
        label.appendChild(el("b", null, String(g.index)));
        label.appendChild(el("span", null, g.name));
        picker.appendChild(label);
    });

    function showError(text) {
        errorMsg.textContent = text || "";
        errorMsg.hidden = !text;
    }

    function open() {
        form.reset();
        showError("");
        form.elements.date.min = todayStr();
        dialog.showModal();
        form.elements.title.focus();
    }

    addBtn.addEventListener("click", open);

    dialog.addEventListener("click", function (e) {
        // 點關閉按鈕，或點對話框外的背景，都會關閉
        if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
    });

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var f = form.elements;
        // 先去掉前後空白，只填空白的必填欄位才會被視為未填
        ["title", "org", "place"].forEach(function (k) { f[k].value = f[k].value.trim(); });
        if (!form.reportValidity()) return;

        var link = f.link.value.trim();
        if (link && !safeUrl(link)) {
            showError("報名連結請以 http:// 或 https:// 開頭。");
            f.link.focus();
            return;
        }

        var sdgs = Array.prototype.filter.call(form.querySelectorAll("input[name=sdgs]"), function (i) {
            return i.checked;
        }).map(function (i) { return Number(i.value); });

        var saved = store.addEvent({
            title: f.title.value.trim(),
            org: f.org.value.trim(),
            date: f.date.value,
            time: f.time.value,
            place: f.place.value.trim(),
            desc: f.desc.value.trim(),
            link: link,
            sdgs: sdgs
        });
        if (!saved) {
            showError("無法儲存：瀏覽器可能封鎖了網站資料儲存，請確認不是在無痕模式。");
            return;
        }
        dialog.close();
    });

    window.addEventListener("store:change", function (e) {
        if (e.detail && e.detail.type === "events") render();
    });

    render();
})();
