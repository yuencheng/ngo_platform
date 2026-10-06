// 資料存取層：活動與提案認領
// 雛型階段先存在瀏覽器的 localStorage（只有目前這個瀏覽器看得到）。
// 之後接上後端 API 時，只要改寫這個檔案裡的函式，events.js / claims.js 不需要變動。
(function () {
    var KEY_EVENTS = "od.events";
    var KEY_CLAIMS = "od.claims";

    // localStorage 可能被瀏覽器封鎖（無痕模式、關閉網站資料等），讀寫失敗時退回空資料
    function read(key, fallback) {
        try {
            var raw = window.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }
    function write(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }

    // 資料變動時通知畫面重新繪製
    function notify(type) {
        window.dispatchEvent(new CustomEvent("store:change", { detail: { type: type } }));
    }

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    window.OD_STORE = {
        // ---- 活動 ----
        // 活動：{ id, title, org, date: "YYYY-MM-DD", time: "HH:MM", place, desc, link, sdgs: [數字], createdAt }
        listEvents: function () {
            return read(KEY_EVENTS, []);
        },
        addEvent: function (data) {
            var list = read(KEY_EVENTS, []);
            var ev = Object.assign({ id: uid(), createdAt: new Date().toISOString() }, data);
            list.push(ev);
            if (!write(KEY_EVENTS, list)) return null;
            notify("events");
            return ev;
        },
        removeEvent: function (id) {
            var list = read(KEY_EVENTS, []).filter(function (ev) { return ev.id !== id; });
            write(KEY_EVENTS, list);
            notify("events");
        },

        // ---- 提案認領 ----
        // 認領紀錄以提案 id（例如 "proposal-1"）為 key：
        // { company, contact, email, phone, type, message, claimedAt }
        getClaim: function (proposalId) {
            return read(KEY_CLAIMS, {})[proposalId] || null;
        },
        claim: function (proposalId, data) {
            var map = read(KEY_CLAIMS, {});
            if (map[proposalId]) return null;   // 已被認領
            map[proposalId] = Object.assign({ claimedAt: new Date().toISOString() }, data);
            if (!write(KEY_CLAIMS, map)) return null;
            notify("claims");
            return map[proposalId];
        },
        unclaim: function (proposalId) {
            var map = read(KEY_CLAIMS, {});
            delete map[proposalId];
            write(KEY_CLAIMS, map);
            notify("claims");
        }
    };
})();
