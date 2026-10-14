// 專案狀態與成熟度：依詳情頁 <article> 上的 data-* 屬性，
// 在詳情頁顯示「專案狀態卡＋成熟度進度條＋成果狀態提示」，並在對應的卡片上標示目前階段。
//
// 每個提案在 index.htm 的 <article class="project-page"> 上設定：
//   data-stage     專案階段（STAGES 的 key）
//   data-evidence  證據等級（EVIDENCE 的 key）
//   data-outcome   成果狀態（OUTCOMES 的 key）
//   data-report    報表狀態（直接顯示的文字）
//   data-compiled  編製日期（YYYY-MM-DD）
(function () {
    // 專案成熟度：依序排列，進度條會標出目前所在的位置。
    // summary：狀態卡上「一眼看懂目前狀態」的說明
    var STAGES = [
        { key: "problem",   zh: "問題確認", en: "Problem Identified" },
        { key: "analysis",  zh: "需求分析", en: "Needs Analyzed" },
        { key: "solution",  zh: "方案提出", en: "Solution Proposed",
          summary: "這個專案目前是已提出方案，但尚未進入正式執行與成果驗證階段。" },
        { key: "build",     zh: "系統建置", en: "System Built" },
        { key: "pilot",     zh: "場域試行", en: "Field Pilot" },
        { key: "adoption",  zh: "正式導入", en: "Adopted" },
        { key: "verified",  zh: "成效驗證", en: "Impact Verified" }
    ];

    // 證據等級 E0～E5：依序排列，專案進程的進度條依 data-evidence 標出目前所在的等級。
    // rule：達到這個等級的條件
    var LEVELS = [
        { key: "E0", en: "Incomplete",       zh: "資料待補",       rule: "尚不符合 E1" },
        { key: "E1", en: "Concept",          zh: "提案有據",       rule: "完整已提交提案、來源附件或版本定位" },
        { key: "E2", en: "Expert Reviewed",  zh: "專家已審查",     rule: "E1＋當前 proposal_revision 的 expert_review 通過" },
        { key: "E3", en: "NPO Validated",    zh: "場域需求已確認", rule: "E2＋當前 proposal_revision 的 npo_validation 通過" },
        { key: "E4", en: "Implemented",      zh: "已有實施證據",   rule: "E3＋至少一筆 NPO 確認的完成實施紀錄" },
        { key: "E5", en: "Outcome Verified", zh: "指定成果已驗證", rule: "E4＋報表凍結範圍內完整驗證，且無失效紀錄" }
    ];
    var EVIDENCE = {};
    LEVELS.forEach(function (lv) { EVIDENCE[lv.key] = lv; });

    // 成果狀態；tone 決定標籤樣式（預期成果以虛線框表示「尚未實現」）
    var OUTCOMES = {
        expected: { en: "Expected Outcomes", zh: "預期成果", tone: "is-pending" },
        observed: { en: "Observed Outcomes", zh: "初步成果", tone: "" },
        verified: { en: "Verified Outcomes", zh: "驗證成果", tone: "is-done" }
    };

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    // "2026-09-18" → "2026/09/18"
    function formatDate(s) {
        return (s || "").replace(/-/g, "/");
    }

    // 狀態卡上的一格：標題＋Badge
    function statusItem(title, value, badgeClass) {
        var div = el("div", "status-item");
        div.appendChild(el("dt", null, title));
        var dd = el("dd");
        dd.appendChild(el("span", "status-badge " + (badgeClass || ""), value));
        div.appendChild(dd);
        return div;
    }

    // 成熟度進度條（橫式，已停用）：已完成 / 目前 / 未完成 三種狀態
    function stepper(current) {
        var ol = el("ol", "stage-steps");
        ol.setAttribute("aria-label", "專案成熟度");
        STAGES.forEach(function (s, i) {
            var state = i < current ? "is-done" : i === current ? "is-current" : "is-todo";
            var li = el("li", "stage-step " + state);
            if (i === current) li.setAttribute("aria-current", "step");
            li.appendChild(el("span", "stage-dot", i < current ? "✓" : String(i + 1)));
            li.appendChild(el("span", "stage-name", s.zh));
            if (i === current) li.appendChild(el("span", "stage-now", "目前階段"));
            ol.appendChild(li);
        });
        return ol;
    }

    // 專案階段進度條（E0～E5，直式）：每一級顯示名稱與達成條件
    function levelStepper(current) {
        var ol = el("ol", "stage-steps is-vertical is-levels");
        ol.setAttribute("aria-label", "專案階段（證據等級 E0～E5）");
        LEVELS.forEach(function (lv, i) {
            var state = i < current ? "is-done" : i === current ? "is-current" : "is-todo";
            var li = el("li", "stage-step " + state);
            if (i === current) li.setAttribute("aria-current", "step");
            li.appendChild(el("span", "stage-dot", lv.key));
            li.appendChild(el("span", "stage-name", lv.zh));
            if (i === current) li.appendChild(el("span", "stage-now", "目前"));
            li.appendChild(el("span", "stage-desc", lv.en + "｜" + lv.rule));
            ol.appendChild(li);
        });
        return ol;
    }

    document.querySelectorAll(".project-page[data-stage]").forEach(function (page) {
        var d = page.dataset;
        var index = -1;
        STAGES.forEach(function (s, i) { if (s.key === d.stage) index = i; });
        if (index === -1) return;
        var stage = STAGES[index];
        var evidence = EVIDENCE[d.evidence];
        // 目前所在的證據等級（E0～E5 的位置），進度條與卡片都用這個
        var level = evidence ? LEVELS.indexOf(evidence) : -1;
        var outcome = OUTCOMES[d.outcome];

        /* 暫時停用：橫式專案進程（放在頁首標題下方、與頁首同寬），已改用下方的直式版本
        // ---- 詳情頁：專案進程，放在頁首標題下方、內文之前（與頁首同寬） ----
        var body = page.querySelector(".page-body");
        if (body) {
            var box = el("section", "status-panel");
            box.setAttribute("aria-label", "專案進程");

            var head = el("div", "status-panel-head");
            head.appendChild(el("h3", null, "專案進程"));
            var meta = el("p", "status-meta");
            if (d.report) meta.appendChild(el("span", null, "報表狀態：" + d.report));
            if (d.compiled) meta.appendChild(el("span", null, "編製日期：" + formatDate(d.compiled)));
            head.appendChild(meta);
            box.appendChild(head);

            // 1. 專案狀態卡
            var items = el("dl", "status-items");
            items.appendChild(statusItem("專案階段", stage.en + "｜" + stage.zh, "is-stage"));
            if (d.evidence) {
                items.appendChild(statusItem("證據等級",
                    evidence ? d.evidence + " " + evidence.en + "｜" + evidence.zh : d.evidence, ""));
            }
            if (d.outcome) {
                items.appendChild(statusItem("成果狀態",
                    outcome ? outcome.en + "｜" + outcome.zh : d.outcome, outcome ? outcome.tone : ""));
            }
            box.appendChild(items);
            if (stage.summary) box.appendChild(el("p", "status-summary", stage.summary));

            // 2. 專案成熟度進度條
            var maturity = el("div", "status-maturity");
            var mhead = el("div", "status-maturity-head");
            mhead.appendChild(el("span", null, "專案成熟度"));
            mhead.appendChild(el("span", null, (index + 1) + " / " + STAGES.length));
            maturity.appendChild(mhead);
            maturity.appendChild(stepper(index));
            box.appendChild(maturity);

            // 3. 成果狀態提示（資訊提醒，不是警告）
            if (d.outcome === "expected") {
                var note = el("p", "status-note");
                note.setAttribute("role", "note");
                note.appendChild(el("span", "status-note-icon", "i"));
                note.appendChild(el("span", null,
                    "目前專案仍處於" + stage.zh + "階段，因此本提案中的效益與改善內容皆屬預期成果，" +
                    "尚不能視為已完成或已驗證的實際績效。"));
                box.appendChild(note);
            }

            // 放在 .page-body 外面，才不會被內文的 720px 寬度限制
            body.parentNode.insertBefore(box, body);
        }
        暫時停用：橫式專案進程 結束 */

        // ---- 詳情頁：直式專案進程，放在內文右側，往下捲動時固定在畫面上 ----
        // 把 .page-body 包進兩欄版面：左邊是原本的內文，右邊是專案進程
        var pageBody = page.querySelector(".page-body");
        if (pageBody) {
            var layout = el("div", "page-layout");
            pageBody.parentNode.insertBefore(layout, pageBody);
            layout.appendChild(pageBody);

            var aside = el("aside", "status-aside");
            aside.setAttribute("aria-label", "專案進程");
            aside.appendChild(el("h3", "status-aside-title", "專案進程"));

            // 專案狀態：階段／證據等級／成果狀態
            var list = el("dl", "status-list");
            list.appendChild(statusItem("專案階段", stage.en + "｜" + stage.zh, "is-stage"));
            if (d.evidence) {
                list.appendChild(statusItem("證據等級",
                    evidence ? d.evidence + " " + evidence.en + "｜" + evidence.zh : d.evidence, ""));
            }
            if (d.outcome) {
                list.appendChild(statusItem("成果狀態",
                    outcome ? outcome.en + "｜" + outcome.zh : d.outcome, outcome ? outcome.tone : ""));
            }
            aside.appendChild(list);
            if (stage.summary) aside.appendChild(el("p", "status-summary", stage.summary));

            // 專案階段進度條：E0～E5
            if (level !== -1) {
                var mHead = el("div", "status-maturity-head");
                mHead.appendChild(el("span", null, "專案階段"));
                mHead.appendChild(el("span", null, evidence.key + " / E" + (LEVELS.length - 1)));
                aside.appendChild(mHead);
                aside.appendChild(levelStepper(level));
            }

            // 成果狀態提示（資訊提醒，不是警告）
            if (d.outcome === "expected") {
                var tip = el("p", "status-note");
                tip.setAttribute("role", "note");
                tip.appendChild(el("span", "status-note-icon", "i"));
                tip.appendChild(el("span", null,
                    "目前專案仍處於" + stage.zh + "階段，因此本提案中的效益與改善內容皆屬預期成果，" +
                    "尚不能視為已完成或已驗證的實際績效。"));
                aside.appendChild(tip);
            }

            var foot = el("p", "status-meta");
            if (d.report) foot.appendChild(el("span", null, "報表狀態：" + d.report));
            if (d.compiled) foot.appendChild(el("span", null, "編製日期：" + formatDate(d.compiled)));
            aside.appendChild(foot);

            layout.appendChild(aside);
        }

        // ---- 卡片：迷你進程（目前所在的 E0～E5 等級） ----
        var link = document.querySelector('.project-open[href="#' + page.id + '"]');
        var card = link && link.closest(".project");
        if (card && level !== -1) {
            var mini = el("p", "stage-mini");
            var bar = el("span", "stage-mini-bar");
            bar.setAttribute("aria-hidden", "true");
            LEVELS.forEach(function (lv, i) {
                bar.appendChild(el("i", i <= level ? "is-on" : ""));
            });
            mini.appendChild(bar);
            mini.appendChild(el("span", null, evidence.key + " " + evidence.zh));
            var anchor = card.querySelector(".sdg-tags") || card.querySelector(".project-more");
            card.insertBefore(mini, anchor);
        }
    });
})();
