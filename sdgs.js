// SDGs 圓環：17 塊扇形，滑鼠移上去會向外延展並在旁邊顯示名稱
(function () {
    // SDGs 官方色票集中定義在 css.css 的 :root（--sdg-1 ~ --sdg-17），
    // 這裡讀回來使用，讓色碼只有單一來源。
    var rootStyle = getComputedStyle(document.documentElement);
    var sdgColor = function (n) {
        return rootStyle.getPropertyValue("--sdg-" + n).trim();
    };

    var GOALS = [
        ["消除貧窮", sdgColor(1), "img/sdgs1.png"],
        ["終結飢餓", sdgColor(2), "img/sdgs2.png"],
        ["健康與福祉", sdgColor(3), "img/sdgs3.png"],
        ["優質教育", sdgColor(4), "img/sdgs4.png"],
        ["性別平等", sdgColor(5), "img/sdgs5.png"],
        ["淨水與衛生", sdgColor(6), "img/sdgs6.png"],
        ["可負擔的永續能源", sdgColor(7), "img/sdgs7.png"],
        ["就業與經濟成長", sdgColor(8), "img/sdgs8.png"],
        ["永續工業與基礎建設", sdgColor(9), "img/sdgs9.png"],
        ["減少不平等", sdgColor(10), "img/sdgs10.png"],
        ["永續城鄉", sdgColor(11), "img/sdgs11.png"],
        ["責任消費與生產", sdgColor(12), "img/sdgs12.png"],
        ["氣候行動", sdgColor(13), "img/sdgs13.png"],
        ["永續保育與海洋", sdgColor(14), "img/sdgs14.png"],
        ["陸域生態", sdgColor(15), "img/sdgs15.png"],
        ["制度和平與正義", sdgColor(16), "img/sdgs16.png"],
        ["永續發展夥伴關係", sdgColor(17), "img/sdgs17.png"]
    ];

    // 供篩選列（projects.js 的「加入條件」選單）建立選項使用，
    // 名稱與色碼只在這裡定義一次。
    window.OD_SDGS_GOALS = GOALS.map(function (g, i) {
        return { index: i + 1, name: g[0], color: g[1] };
    });

    var VIEW = 260;      // viewBox 為 -VIEW ~ VIEW
    var R_OUT = 240;     // 外半徑
    var R_IN = 140;      // 內半徑
    var GAP = 1.6;       // 扇形之間的間隙（度）
    var POP = 16;        // 延展距離
    // 一般圖示（透明背景）放在這個方框內，SVG 會依圖片本身比例縮放並置中，
    // 所以新下載的圖檔不管尺寸多大都會縮成相同的大小，不用另外設定
    var ICON_W = 44;
    var ICON_H = 28;
    // 例外：「不透明白底＋深色圖案」的圖檔，要去掉白底，方框也可能要放大，
    // 畫面上圖案才會跟其他圖示一樣大。
    // 之後若有這類圖檔，照這個格式加進來：路徑 → 方框寬、高，例如 { "img/sdgsX.png": [72, 30] }
    // （sdgs1.png 已換成透明背景的白色圖案，不需要列在這裡）
    var OPAQUE_BG = {};
    // 個別圖示的方框大小（透明背景的圖檔）：路徑 → 方框寬、高，沒列出的就用 ICON_W × ICON_H
    // sdgs1.png 比例約 2:1，實際大小由寬度決定，要調整大小改第一個數字即可
    var ICON_SIZE = { "img/sdgs1.png": [55, 33] };
    var NS = "http://www.w3.org/2000/svg";

    var root = document.getElementById("sdgs");
    if (!root) return;

    var step = 360 / GOALS.length;
    var rad = function (deg) { return deg * Math.PI / 180; };
    var pt = function (r, deg) {
        return (r * Math.sin(rad(deg))).toFixed(2) + " " + (-r * Math.cos(rad(deg))).toFixed(2);
    };
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", [-VIEW, -VIEW, VIEW * 2, VIEW * 2].join(" "));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "聯合國永續發展目標 SDGs");
    root.appendChild(svg);

    // 兩個濾鏡都把圖示變成白色，才能疊在彩色扇形上：
    //  sdgs-icon-solid：透明背景的圖檔，保留原本的透明度，只把顏色改成白色
    //  sdgs-icon-white：不透明白底的圖檔，同時把白底變透明（用綠色通道判斷哪裡是圖案）
    var defs = document.createElementNS(NS, "defs");
    defs.innerHTML =
        '<filter id="sdgs-icon-solid" color-interpolation-filters="sRGB">' +
        '<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/>' +
        '</filter>' +
        '<filter id="sdgs-icon-white" color-interpolation-filters="sRGB">' +
        '<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 -1.7 0 1.55 0"/>' +
        '</filter>';
    svg.appendChild(defs);

    var label = document.createElement("div");
    label.className = "sdgs-label";
    root.appendChild(label);

    // 點擊扇形＝篩選，可以多選：每個扇形各自記住是否被選取
    // segRefs：編號 → { g, goal }，讓外部（例如篩選列上單一標籤的 ×）也能找到對應扇形
    // activeMap：編號 → goal，目前所有被選取的目標
    var segRefs = {};
    var activeMap = {};

    // source：這批篩選條件是從哪裡來的。
    //   "wheel"    = 使用者直接點選圓盤上的編號 → 下方的精選專案列表要捲進視野
    //   "external" = 篩選列上的移除／清除（人已經在專案區塊，不需要再捲動）
    function broadcastFilter(source) {
        var keys = Object.keys(activeMap).map(Number).sort(function (a, b) { return a - b; });
        if (keys.length) {
            root.classList.add("has-active");
        } else {
            root.classList.remove("has-active");
        }
        var items = keys.map(function (k) {
            return { index: k, name: activeMap[k][0], color: activeMap[k][1] };
        });
        window.dispatchEvent(new CustomEvent("sdgs:filter", {
            detail: { items: items, source: source || "external" }
        }));
    }

    function toggleGoal(index, g, goal, source) {
        if (activeMap[index]) {
            g.classList.remove("active");
            delete activeMap[index];
        } else {
            g.classList.add("active");
            activeMap[index] = goal;
        }
        broadcastFilter(source);
    }

    // 外部要求取消單一目標（篩選列上該標籤的 ×）
    window.addEventListener("sdgs:untoggle", function (e) {
        var index = e.detail && e.detail.index;
        var ref = segRefs[index];
        if (ref && activeMap[index]) toggleGoal(index, ref.g, ref.goal, "external");
    });

    // 外部要求加入單一目標（篩選列「加入條件」選單）
    window.addEventListener("sdgs:toggle", function (e) {
        var index = e.detail && e.detail.index;
        var ref = segRefs[index];
        if (ref && !activeMap[index]) toggleGoal(index, ref.g, ref.goal, "external");
    });

    // 外部（清除篩選按鈕）要求重設圓環的所有選取狀態
    window.addEventListener("sdgs:reset", function () {
        Object.keys(activeMap).forEach(function (k) {
            if (segRefs[k]) segRefs[k].g.classList.remove("active");
        });
        activeMap = {};
        broadcastFilter();
    });

    GOALS.forEach(function (goal, i) {
        var a0 = i * step + GAP / 2;
        var a1 = (i + 1) * step - GAP / 2;
        var mid = (a0 + a1) / 2;

        var g = document.createElementNS(NS, "g");
        g.setAttribute("class", "sdgs-seg");
        g.setAttribute("tabindex", "0");
        g.style.setProperty("--i", i);   // 載入動畫：依序出現的順序
        g.style.setProperty("--dx", (POP * Math.sin(rad(mid))).toFixed(2) + "px");
        g.style.setProperty("--dy", (-POP * Math.cos(rad(mid))).toFixed(2) + "px");

        var path = document.createElementNS(NS, "path");
        path.setAttribute("d",
            "M " + pt(R_OUT, a0) +
            " A " + R_OUT + " " + R_OUT + " 0 0 1 " + pt(R_OUT, a1) +
            " L " + pt(R_IN, a1) +
            " A " + R_IN + " " + R_IN + " 0 0 0 " + pt(R_IN, a0) + " Z");
        path.setAttribute("fill", goal[1]);

        var num = document.createElementNS(NS, "text");
        var hasIcon = !!goal[2];
        // 有圖示時，數字往內圈靠，外圈留給圖示
        var c = pt(R_IN + (hasIcon ? 22 : 30), mid).split(" ");
        num.setAttribute("x", c[0]);
        num.setAttribute("y", c[1]);
        num.setAttribute("text-anchor", "middle");
        num.setAttribute("dominant-baseline", "central");
        num.textContent = i + 1;

        g.appendChild(path);
        g.appendChild(num);

        if (hasIcon) {
            var ic = pt(R_IN + 66, mid).split(" ");
            var img = document.createElementNS(NS, "image");
            img.setAttribute("href", goal[2]);
            var opaque = OPAQUE_BG[goal[2]];
            var size = opaque || ICON_SIZE[goal[2]] || [ICON_W, ICON_H];
            var w = size[0];
            var h = size[1];
            img.setAttribute("width", w);
            img.setAttribute("height", h);
            img.setAttribute("x", (parseFloat(ic[0]) - w / 2).toFixed(2));
            img.setAttribute("y", (parseFloat(ic[1]) - h / 2).toFixed(2));
            img.setAttribute("filter", opaque ? "url(#sdgs-icon-white)" : "url(#sdgs-icon-solid)");
            img.setAttribute("class", "sdgs-icon");
            // 圖檔還沒放進 img/ 時，不顯示破圖，數字也回到預設位置
            img.addEventListener("error", function () {
                img.remove();
                var c0 = pt(R_IN + 30, mid).split(" ");
                num.setAttribute("x", c0[0]);
                num.setAttribute("y", c0[1]);
            });
            g.appendChild(img);
        }
        svg.appendChild(g);

        var show = function () {
            var p = pt(R_OUT + POP + 14, mid).split(" ");
            var onRight = Math.sin(rad(mid)) >= 0;

            // 先填內容再量測尺寸，才能把標籤夾在可見範圍內
            label.style.borderColor = goal[1];
            label.innerHTML = "<b style=\"background:" + goal[1] + "\">" + (i + 1) + "</b>" + goal[0];

            var box = root.getBoundingClientRect();
            var scale = box.width / (VIEW * 2);
            var ax = box.left + (parseFloat(p[0]) + VIEW) * scale;
            var ay = box.top + (parseFloat(p[1]) + VIEW) * scale;

            var lw = label.offsetWidth;
            var lh = label.offsetHeight;
            var m = 12;
            var vw = document.documentElement.clientWidth;
            var vh = document.documentElement.clientHeight;

            // 標籤往圓盤外側展開；右側的標籤若會超出視窗，
            // 就往左夾進畫面內，避免被 overflow-x:hidden 裁掉。
            var left = onRight ? ax : ax - lw;
            left = Math.min(left, vw - m - lw);
            left = Math.max(left, m);

            var top = ay - lh / 2;
            top = Math.min(top, vh - m - lh);
            top = Math.max(top, m);

            label.style.left = (left - box.left) + "px";
            label.style.top = (top - box.top) + "px";
            label.style.transform = "none";
            label.classList.add("show");
        };
        var hide = function () { label.classList.remove("show"); };

        g.addEventListener("mouseenter", show);
        g.addEventListener("mouseleave", hide);
        g.addEventListener("focus", show);
        g.addEventListener("blur", hide);

        segRefs[i + 1] = { g: g, goal: goal };

        // 點擊（或鍵盤 Enter/空白鍵）＝把這個目標加入／移出下方 project 的篩選條件（可複選）
        g.addEventListener("click", function () { toggleGoal(i + 1, g, goal, "wheel"); });
        g.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                e.preventDefault();
                toggleGoal(i + 1, g, goal, "wheel");
            }
        });
    });

    // 圓環中央標誌（縮小置中，不會壓到扇形）
    var title = document.createElement("div");
    title.className = "sdgs-title";
    var logo = document.createElement("img");
    logo.src = "img/sdgs-logo.png";
    logo.alt = "聯合國永續發展目標 SDGs";
    logo.className = "sdgs-logo";
    logo.addEventListener("error", function () { logo.remove(); });
    title.appendChild(logo);
    root.appendChild(title);
})();
