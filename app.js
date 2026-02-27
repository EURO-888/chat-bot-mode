// Simple admin UI for managing LINE chat modes (BOT / ADMIN)

const BASE_URL = "https://dev-bcrm-fb-battery-api.azurewebsites.net/api/v1/Chat";

const els = {
    keyword: document.getElementById("keyword"),
    searchBtn: document.getElementById("searchBtn"),
    loading: document.getElementById("loading"),
    summary: document.getElementById("summary"),
    tbody: document.getElementById("resultBody")
};

function setLoading(isLoading) {
    if (isLoading) {
        els.loading.classList.remove("hidden");
        els.searchBtn.disabled = true;
    } else {
        els.loading.classList.add("hidden");
        els.searchBtn.disabled = false;
    }
}

async function searchChatMode() {
    const keyword = (els.keyword.value || "").trim();
    const params = new URLSearchParams({
        keyword,
        start: "1",
        limit: "50"
    });

    setLoading(true);
    els.summary.textContent = "กำลังค้นหา...";
    els.tbody.innerHTML = "";

    try {
        const resp = await fetch(`${BASE_URL}/SearchChatMode?${params.toString()}`, {
            method: "GET"
        });

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }

        const json = await resp.json();
        console.log("SearchChatMode response:", json);

        // รองรับทุกแบบ:
        // 1) { Status / Data / Error }
        // 2) { status / data / error }
        // 3) { items, total_records, ... } (ไม่มี envelope)
        const hasEnvelope =
            ("Status" in json || "status" in json) &&
            ("Data" in json || "data" in json);

        let data;
        if (hasEnvelope) {
            const status = json.Status ?? json.status;
            const error = json.Error ?? json.error;

            if (status && status !== "Success" && status !== "success") {
                throw new Error(
                    error?.Message ||
                    error?.message ||
                    "ไม่สามารถดึงข้อมูลได้"
                );
            }

            data = json.Data ?? json.data ?? {};
        } else {
            data = json || {};
        }

        const items = data.items || [];

        if (items.length === 0) {
            els.summary.textContent = "ไม่พบข้อมูลลูกค้าที่ตรงกับเงื่อนไข";
            els.tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="muted">ไม่พบข้อมูล</td>
                </tr>`;
            return;
        }

        els.summary.textContent = `พบทั้งหมด ${data.total_records} รายการ แสดงหน้า ${data.start} (สูงสุด ${data.limit} รายการต่อหน้า)`;

        const rows = items.map((item) => renderRow(item)).join("");
        els.tbody.innerHTML = rows;
    } catch (err) {
        console.error(err);
        els.summary.textContent = "เกิดข้อผิดพลาดระหว่างดึงข้อมูล (ดู console เพิ่มเติม)";
        els.tbody.innerHTML = `
            <tr>
                <td colspan="5" class="muted">ไม่สามารถดึงข้อมูลได้</td>
            </tr>`;
    } finally {
        setLoading(false);
    }
}

function renderRow(item) {
    const mode = (item.chat_mode || "").toUpperCase();
    const isAdmin = mode === "ADMIN";
    const badgeClass = isAdmin ? "badge admin" : "badge bot";
    const badgeText = isAdmin ? "ADMIN (คุยกับเจ้าหน้าที่)" : "BOT (คุยกับบอท)";
    const updated = item.mode_updated_at
        ? new Date(item.mode_updated_at).toLocaleString()
        : "-";

    const targetMode = isAdmin ? "BOT" : "ADMIN";
    const buttonLabel = isAdmin ? "สลับเป็น BOT" : "สลับเป็น ADMIN";

    const safeUserId = escapeHtml(item.line_user_id || "");
    const safeName = escapeHtml(item.line_name || "");
    const safePictureUrl = escapeHtml(item.picture_url || "");

    const avatarHtml = safePictureUrl
        ? `<img src="${safePictureUrl}" alt="${safeName || "profile"}"
                style="width:40px;height:40px;border-radius:9999px;object-fit:cover;margin-right:8px;vertical-align:middle;" />`
        : "";

    return `
        <tr data-line-user-id="${safeUserId}">
            <td>
                <div>${safeUserId || "-"}</div>
            </td>
            <td>
                <div class="user-cell">
                    ${avatarHtml}
                    <span>${safeName || "<span class='muted'>(ไม่ทราบชื่อ)</span>"}</span>
                </div>
            </td>
            <td>
                <span class="${badgeClass}">${badgeText}</span>
            </td>
            <td>
                <span class="muted">${updated}</span>
            </td>
            <td>
                <select class="mode-select" data-mode-select>
                    <option value="ADMIN" ${isAdmin ? "selected" : ""}>ADMIN</option>
                    <option value="BOT" ${!isAdmin ? "selected" : ""}>BOT</option>
                </select>
                <button
                    class="btn small outline"
                    data-update-btn
                    data-target-mode="${targetMode}">
                    บันทึก
                </button>
                <button
                    class="btn small"
                    data-feedback-btn>
                    ส่งฟอร์ม Feedback
                </button>
            </td>
        </tr>
    `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function handleTableClick(event) {
    const updateBtn = event.target.closest("[data-update-btn]");
    const feedbackBtn = event.target.closest("[data-feedback-btn]");

    if (!updateBtn && !feedbackBtn) return;

    const row = event.target.closest("tr");
    if (!row) return;

    const lineUserId = row.getAttribute("data-line-user-id");
    const nameCell = row.children[1];
    const lineName = nameCell ? nameCell.textContent.trim() : "";

    // กดปุ่มส่งฟอร์ม Feedback
    if (feedbackBtn) {
        if (!lineUserId) {
            alert("ไม่พบ line_user_id ของลูกค้า");
            return;
        }

        if (!confirm(`ต้องการส่งฟอร์ม Feedback ให้ลูกค้า\n${lineName || lineUserId}\nใช่หรือไม่?`)) {
            return;
        }

        feedbackBtn.disabled = true;
        feedbackBtn.textContent = "กำลังส่งฟอร์ม...";

        try {
            const body = { line_user_id: lineUserId };

            const resp = await fetch(`${BASE_URL}/SendFeedbackForm`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }

            const json = await resp.json();
            console.log("SendFeedbackForm response:", json);

            const status = json.Status ?? json.status;
            const error = json.Error ?? json.error;

            if (status && status !== "Success" && status !== "success") {
                throw new Error(
                    error?.Message ||
                    error?.message ||
                    "ไม่สามารถส่งฟอร์ม Feedback ได้"
                );
            }

            alert("ส่งฟอร์ม Feedback ให้ลูกค้าเรียบร้อยแล้ว");
        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดระหว่างส่งฟอร์ม Feedback (ดู console เพิ่มเติม)");
        } finally {
            feedbackBtn.disabled = false;
            feedbackBtn.textContent = "ส่งฟอร์ม Feedback";
        }

        return;
    }

    // กดปุ่มบันทึกโหมด (เดิม)
    const btn = updateBtn;

    const select = row.querySelector("[data-mode-select]");
    const selectedMode = select ? select.value : btn.getAttribute("data-target-mode");

    if (!lineUserId || !selectedMode) {
        alert("ข้อมูลไม่ครบ ไม่สามารถอัพเดทโหมดได้");
        return;
    }

    if (!confirm(`ต้องการเปลี่ยนโหมดของลูกค้า\n${lineName || lineUserId}\nเป็น ${selectedMode} ใช่หรือไม่?`)) {
        return;
    }

    btn.disabled = true;
    btn.textContent = "กำลังบันทึก...";

    try {
        const body = {
            line_user_id: lineUserId,
            line_name: lineName,
            chat_mode: selectedMode
        };

        const resp = await fetch(`${BASE_URL}/UpdateChatMode`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }

        const json = await resp.json();

        // รองรับทั้ง Status/Data และ status/data
        const status = json.Status ?? json.status;
        const error = json.Error ?? json.error;

        if (status && status !== "Success" && status !== "success") {
            throw new Error(
                error?.Message ||
                error?.message ||
                "ไม่สามารถอัพเดทโหมดได้"
            );
        }

        // ดึงผลลัพธ์และ render ใหม่ทั้งตาราง (ง่ายและปลอดภัย)
        await searchChatMode();
    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดระหว่างอัพเดทโหมด (ดู console เพิ่มเติม)");
    } finally {
        btn.disabled = false;
        btn.textContent = "บันทึก";
    }
}

function init() {
    els.searchBtn.addEventListener("click", searchChatMode);
    els.keyword.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            searchChatMode();
        }
    });
    els.tbody.addEventListener("click", handleTableClick);
}

document.addEventListener("DOMContentLoaded", init);

