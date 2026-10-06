// 提案認領：提案卡片顯示認領狀態，提案詳情頁提供「認領此提案」表單
// 資料存取交給 store.js（window.OD_STORE）
(function () {
    var store = window.OD_STORE;
    var dialog = document.getElementById("claimDialog");
    var form = document.getElementById("claimForm");
    var targetLabel = document.getElementById("claimDialogTarget");
    var errorMsg = document.getElementById("claimFormError");
    if (!store || !dialog || !form) return;

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function formatDate(iso) {
        var d = new Date(iso);
        var pad = function (n) { return (n < 10 ? "0" : "") + n; };
        return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate());
    }

    function badge(claim) {
        return el("span", "claim-badge" + (claim ? " is-claimed" : ""), claim ? "已認領" : "開放認領");
    }

    // ---- 提案卡片：標示狀態 ----
    // 提案 id 取自卡片連結（#proposal-N），與詳情頁 <article id="proposal-N"> 對應
    var cards = Array.prototype.map.call(document.querySelectorAll(".proposals .project"), function (card) {
        var link = card.querySelector(".project-open");
        var slot = el("p", "claim-slot");
        card.insertBefore(slot, card.firstChild);
        return { id: link ? link.getAttribute("href").replace(/^#/, "") : "", slot: slot };
    });

    // ---- 提案詳情頁：認領區塊 ----
    var pages = Array.prototype.map.call(document.querySelectorAll('.project-page[id^="proposal-"]'), function (page) {
        var body = page.querySelector(".page-body");
        var panel = el("section", "claim-panel");
        panel.setAttribute("aria-label", "企業認領");
        if (body) body.insertBefore(panel, body.querySelector(".pdf-actions"));
        var title = page.querySelector(".page-title");
        return { id: page.id, panel: panel, title: title ? title.textContent.trim() : "" };
    });

    function renderPanel(p) {
        var claim = store.getClaim(p.id);
        p.panel.innerHTML = "";
        p.panel.classList.toggle("is-claimed", !!claim);

        var info = el("div", "claim-info");
        info.appendChild(badge(claim));
        if (claim) {
            var text = el("p", "claim-text");
            text.appendChild(document.createTextNode("由 "));
            text.appendChild(el("b", null, claim.company));
            text.appendChild(document.createTextNode(" 認領 · " + claim.type + " · " + formatDate(claim.claimedAt)));
            info.appendChild(text);
        } else {
            info.appendChild(el("p", "claim-text", "此提案正在尋找企業夥伴。認領後，提案 NGO 會透過您留下的聯絡方式與您聯繫。"));
        }
        p.panel.appendChild(info);

        var btn = el("button", claim ? "btn btn-secondary" : "btn btn-primary", claim ? "取消認領" : "認領此提案");
        btn.type = "button";
        btn.addEventListener("click", function () {
            if (claim) {
                if (window.confirm("確定要取消「" + claim.company + "」對此提案的認領嗎？")) store.unclaim(p.id);
            } else {
                open(p);
            }
        });
        p.panel.appendChild(btn);
    }

    function render() {
        cards.forEach(function (c) {
            c.slot.innerHTML = "";
            c.slot.appendChild(badge(store.getClaim(c.id)));
        });
        pages.forEach(renderPanel);
    }

    // ---- 表單 ----
    var current = null;   // 目前正在認領的提案

    function showError(text) {
        errorMsg.textContent = text || "";
        errorMsg.hidden = !text;
    }

    function open(p) {
        current = p;
        form.reset();
        showError("");
        targetLabel.textContent = p.title;
        dialog.showModal();
        form.elements.company.focus();
    }

    dialog.addEventListener("click", function (e) {
        // 點關閉按鈕，或點對話框外的背景，都會關閉
        if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
    });

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!current) return;
        var f = form.elements;
        // 先去掉前後空白，只填空白的必填欄位才會被視為未填
        ["company", "contact", "email"].forEach(function (k) { f[k].value = f[k].value.trim(); });
        if (!form.reportValidity()) return;

        if (store.getClaim(current.id)) {
            showError("這個提案剛剛已經被認領了。");
            render();
            return;
        }
        var saved = store.claim(current.id, {
            company: f.company.value,
            contact: f.contact.value,
            email: f.email.value,
            phone: f.phone.value.trim(),
            type: f.type.value,
            message: f.message.value.trim()
        });
        if (!saved) {
            showError("無法儲存：瀏覽器可能封鎖了網站資料儲存，請確認不是在無痕模式。");
            return;
        }
        dialog.close();
    });

    window.addEventListener("store:change", function (e) {
        if (e.detail && e.detail.type === "claims") render();
    });

    render();
})();
