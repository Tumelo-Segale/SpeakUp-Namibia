/**
 * SpeakUp Namibia — business.js
 * Business Portal: Dashboard, Reviews & Replies, Settings, Avatar Upload, Business-to-Business Reviews
 * WebSocket live updates via speakup-ws.js
 */

const CATEGORIES = [
  "Banking & Finance",
  "Telecommunications",
  "Retail & Supermarkets",
  "Utilities",
  "Hospitality",
  "Healthcare",
  "Education",
  "Transport",
  "Car Dealers",
  "Online Sellers",
  "Government Services",
  "Contractors",
  "Landlords",
  "Software & Technology",
  "Other",
];

let reviewsArray = [],
  businessesArray = [],
  currentBusiness = null;

// ── Utilities ────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function esc(s) {
  if (!s) return "";
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}
function renderStars(r) {
  let s = "";
  for (let i = 1; i <= 5; i++)
    s += `<i class="${i <= r ? "fas" : "far"} fa-star"></i>`;
  return `<span class="stars">${s}</span>`;
}
function countCmts(c) {
  if (!c) return 0;
  return c.reduce((a, x) => a + 1 + countCmts(x.replies), 0);
}
function openModal(id) {
  document.getElementById(id).style.display = "flex";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}
window.closeModal = closeModal;

// ── Storage ──────────────────────────────────────────────────
function saveReviews() {
  localStorage.setItem("speakup_reviews_v2", JSON.stringify(reviewsArray));
}
function saveBusinesses() {
  localStorage.setItem(
    "speakup_businesses_v2",
    JSON.stringify(businessesArray)
  );
}
function saveSession() {
  if (currentBusiness) {
    const sessionCopy = { ...currentBusiness };
    sessionStorage.setItem("speakup_biz_session", JSON.stringify(sessionCopy));
  }
}

// ── Avatar handling ──────────────────────────────────────────
function updateSidebarAvatar() {
  const avatarImg = document.getElementById("sidebarAvatarImg");
  const avatarIcon = document.getElementById("sidebarAvatarIcon");
  if (currentBusiness && currentBusiness.avatar) {
    avatarImg.src = currentBusiness.avatar;
    avatarImg.style.display = "block";
    avatarIcon.style.display = "none";
  } else {
    avatarImg.style.display = "none";
    avatarIcon.style.display = "flex";
  }
}
function updateAvatarPreview(base64) {
  const previewDiv = document.getElementById("avatarPreviewImg");
  if (previewDiv) {
    previewDiv.innerHTML = base64
      ? `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : '<i class="fas fa-store" style="font-size:2rem; color:var(--forest);"></i>';
  }
}
function setupAvatarUpload() {
  const fileInput = document.getElementById("avatarUpload");
  const removeBtn = document.getElementById("removeAvatarBtn");
  if (!fileInput) return;
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const base64 = ev.target.result;
      // update current business and businesses array
      currentBusiness.avatar = base64;
      const idx = businessesArray.findIndex((b) => b.id === currentBusiness.id);
      if (idx !== -1) businessesArray[idx].avatar = base64;
      saveBusinesses();
      saveSession();
      updateSidebarAvatar();
      updateAvatarPreview(base64);
    };
    reader.readAsDataURL(file);
  });
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      if (currentBusiness) {
        delete currentBusiness.avatar;
        const idx = businessesArray.findIndex(
          (b) => b.id === currentBusiness.id
        );
        if (idx !== -1) delete businessesArray[idx].avatar;
        saveBusinesses();
        saveSession();
        updateSidebarAvatar();
        updateAvatarPreview(null);
      }
    });
  }
}

// ── Load data & session ──────────────────────────────────────
function loadData() {
  try {
    reviewsArray = JSON.parse(localStorage.getItem("speakup_reviews_v2")) || [];
  } catch (e) {
    reviewsArray = [];
  }
  try {
    businessesArray =
      JSON.parse(localStorage.getItem("speakup_businesses_v2")) || [];
  } catch (e) {
    businessesArray = [];
  }
  try {
    const sess = JSON.parse(sessionStorage.getItem("speakup_biz_session"));
    if (sess && sess.id) {
      // merge with full business data to get avatar, etc.
      const fullBiz = businessesArray.find((b) => b.id === sess.id);
      if (fullBiz) {
        currentBusiness = { ...fullBiz };
      } else {
        currentBusiness = sess;
      }
    } else {
      currentBusiness = null;
    }
  } catch (e) {
    currentBusiness = null;
  }
  if (!currentBusiness) {
    window.location.href = "index.html";
    return;
  }
  initUI();
}

function initUI() {
  document.getElementById("sidebarBizName").textContent =
    currentBusiness.businessName;
  document.getElementById("bizTopInfo").textContent = currentBusiness.email;
  populateCategoryDropdowns();
  renderDashboard();
  renderReviews();
  prefillSettings();
  initWSListeners();
  updateSidebarAvatar();
  setupAvatarUpload();
  // Preview avatar in settings
  if (currentBusiness.avatar) updateAvatarPreview(currentBusiness.avatar);

  // Delete account button
  const deleteBtn = document.getElementById("deleteAccountBtn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () =>
      openModal("deleteAccountConfirmModal")
    );
  }
  const confirmDeleteBtn = document.getElementById("confirmDeleteAccountBtn");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = () => {
      const idx = businessesArray.findIndex((b) => b.id === currentBusiness.id);
      if (idx !== -1) {
        businessesArray.splice(idx, 1);
        saveBusinesses();
      }
      sessionStorage.removeItem("speakup_biz_session");
      window.location.href = "index.html";
    };
  }
}

function populateCategoryDropdowns() {
  const sel = document.getElementById("settingsCategory");
  if (!sel) return;
  sel.innerHTML = '<option value="">Select a category…</option>';
  CATEGORIES.forEach((cat) => {
    const o = document.createElement("option");
    o.value = cat;
    o.textContent = cat;
    sel.appendChild(o);
  });
  sel.value = currentBusiness.category;

  // also populate review modal category dropdown
  const bizCat = document.getElementById("bizReviewCategory");
  if (bizCat) {
    bizCat.innerHTML = '<option value="">Select a category…</option>';
    CATEGORIES.forEach((cat) => {
      const o = document.createElement("option");
      o.value = cat;
      o.textContent = cat;
      bizCat.appendChild(o);
    });
  }
}

// ── Tab navigation ────────────────────────────────────────────
function switchTab(name) {
  document
    .querySelectorAll(".biz-tab")
    .forEach((t) => (t.style.display = "none"));
  document
    .querySelectorAll(".biz-nav-btn")
    .forEach((b) => b.classList.remove("active"));
  const tab = document.getElementById(`tab-${name}`);
  if (tab) tab.style.display = "block";
  document
    .querySelector(`.biz-nav-btn[data-tab="${name}"]`)
    ?.classList.add("active");
  if (name === "consumer") renderConsumerSite();
  closeSidebar();
}
document.querySelectorAll(".biz-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ── Hamburger / Sidebar toggle ────────────────────────────────
function closeSidebar() {
  document.getElementById("bizSidebar")?.classList.remove("open");
  document.getElementById("bizSidebarOverlay")?.classList.remove("active");
}
document.getElementById("bizHamburger")?.addEventListener("click", () => {
  document.getElementById("bizSidebar")?.classList.toggle("open");
  document.getElementById("bizSidebarOverlay")?.classList.toggle("active");
});
document
  .getElementById("bizSidebarOverlay")
  ?.addEventListener("click", closeSidebar);

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  const biz = currentBusiness.businessName;
  const bizRevs = reviewsArray.filter(
    (r) => r.businessName.toLowerCase() === biz.toLowerCase()
  );
  const total = bizRevs.length;
  const avg = total
    ? (bizRevs.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
    : "—";
  const totalCmts = bizRevs.reduce((a, r) => a + countCmts(r.comments), 0);
  const responseRate = total
    ? Math.round(
        (bizRevs.filter((r) => r.comments?.some((c) => c.isBusiness)).length /
          total) *
          100
      )
    : 0;

  // Stats
  document.getElementById("dashboardStats").innerHTML = `
    <div class="biz-stat-card"><i class="fas fa-star"></i><strong>${avg}</strong><span>Avg Rating</span></div>
    <div class="biz-stat-card"><i class="fas fa-chart-simple"></i><strong>${total}</strong><span>Total Reviews</span></div>
    <div class="biz-stat-card"><i class="fas fa-comments"></i><strong>${totalCmts}</strong><span>All Comments</span></div>
    <div class="biz-stat-card"><i class="fas fa-percent"></i><strong>${responseRate}%</strong><span>Response Rate</span></div>`;

  // Sub badge
  const bizRec = businessesArray.find((b) => b.id === currentBusiness.id);
  const expiry = bizRec?.subscriptionExpiry
    ? new Date(bizRec.subscriptionExpiry)
    : null;
  const daysLeft = expiry
    ? Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  document.getElementById("dashSubBadge").innerHTML = expiry
    ? `<span class="sub-status-badge ${
        daysLeft > 0 ? "active" : "expired"
      }"><i class="fas fa-${
        daysLeft > 0 ? "circle-check" : "triangle-exclamation"
      }"></i> Subscription ${
        daysLeft > 0 ? `active · ${daysLeft} days left` : "Expired"
      }</span>`
    : "";

  // Rating breakdown
  const rbDiv = document.getElementById("ratingBreakdown");
  rbDiv.innerHTML =
    [5, 4, 3, 2, 1]
      .map((star) => {
        const count = bizRevs.filter((r) => r.rating === star).length;
        const pct = total ? Math.round((count / total) * 100) : 0;
        return `<div class="rb-row"><span class="rb-label">${star} ★</span><div class="rb-bar-bg"><div class="rb-bar" style="width:${pct}%"></div></div><span class="rb-count">${count}</span></div>`;
      })
      .join("") ||
    '<p style="color:var(--muted);font-size:.85rem;">No reviews yet.</p>';

  // Recent activity
  const recent = [...bizRevs]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);
  const actDiv = document.getElementById("recentActivity");
  actDiv.innerHTML = recent.length
    ? recent
        .map(
          (r) => `
    <div class="activity-item">
      <div class="activity-dot rev"><i class="fas fa-star"></i></div>
      <div class="activity-text">
        <strong>${esc(r.title)}</strong> ${renderStars(r.rating)}<br>
        <small>by ${esc(r.userName)} · ${fmtDate(r.date)}</small>
      </div>
    </div>`
        )
        .join("")
    : '<p style="color:var(--muted);font-size:.85rem;">No recent activity.</p>';
}

// ── Reviews & Replies ─────────────────────────────────────────
function renderReviews() {
  const biz = currentBusiness.businessName;
  const bizRevs = reviewsArray.filter(
    (r) => r.businessName.toLowerCase() === biz.toLowerCase()
  );
  const container = document.getElementById("dashboardReviewsList");
  if (!bizRevs.length) {
    container.innerHTML =
      '<p style="color:var(--muted);">No reviews yet for your business.</p>';
    return;
  }
  container.innerHTML = bizRevs
    .map((rev) => {
      const allCmts = renderBizCommentTree(rev.comments || [], 0);
      const totalComments = countCmts(rev.comments || []);
      const bizReply = rev.comments?.find((c) => c.isBusiness);
      return `<div class="biz-review-item">
      <div class="biz-review-top">
        <div class="biz-review-title-row">${esc(rev.title)}</div>
        ${renderStars(rev.rating)}
      </div>
      <div class="biz-review-meta-row"><i class="fas fa-user"></i> ${esc(
        rev.userName
      )} &nbsp;·&nbsp; <i class="fas fa-calendar-alt"></i> ${fmtDate(
        rev.date
      )}</div>
      <div class="biz-review-content">${esc(
        rev.content.length > 200 ? rev.content.slice(0, 200) + "…" : rev.content
      )}</div>
      ${
        bizReply
          ? `<div class="biz-existing-reply"><strong><i class="fas fa-building"></i> Your reply:</strong>${esc(
              bizReply.text
            )}</div>`
          : ""
      }
      ${
        allCmts
          ? `<div class="biz-comments-tree"><div class="biz-panel-title" style="font-size:.78rem;"><i class="fas fa-comments"></i> All Comments (${totalComments})</div>${allCmts}</div>`
          : `<div class="biz-comments-tree"><div class="biz-panel-title" style="font-size:.78rem;"><i class="fas fa-comments"></i> Comments (0)</div></div>`
      }
      <div class="biz-reply-area" style="margin-top:.8rem;">
        <textarea id="dc_${
          rev.id
        }" rows="2" placeholder="Reply publicly as ${esc(biz)}…"></textarea>
        <button class="btn-primary dReplyBtn" data-id="${
          rev.id
        }" style="margin-top:4px;font-size:.82rem;padding:.38rem .9rem;"><i class="fas fa-reply"></i> Post Reply</button>
      </div>
    </div>`;
    })
    .join("");
  document.querySelectorAll(".dReplyBtn").forEach((btn) => {
    btn.onclick = () => {
      const txt = document.getElementById(`dc_${btn.dataset.id}`)?.value.trim();
      if (!txt) {
        alert("Enter reply text.");
        return;
      }
      addCommentAsBiz(parseInt(btn.dataset.id), txt);
    };
  });
}

function renderBizCommentTree(comments, level) {
  if (!comments?.length) return "";
  return comments
    .map(
      (c) => `
    <div class="biz-cmt ${level > 0 ? "biz-cmt-reply" : ""}">
      <div class="biz-cmt-meta">
        <strong>${esc(c.author)}</strong>
        ${
          c.isBusiness
            ? '<span class="badge-verified" style="font-size:.55rem;">✓ VERIFIED</span>'
            : ""
        }
        <span>${fmtDate(c.date)}</span>
      </div>
      <div style="font-size:.83rem;">${esc(c.text)}</div>
      ${renderBizCommentTree(c.replies || [], level + 1)}
    </div>`
    )
    .join("");
}

function addCommentAsBiz(reviewId, text) {
  const rev = reviewsArray.find((r) => r.id === reviewId);
  if (!rev) return;
  const c = {
    id: "c" + Date.now() + Math.random().toString(36).slice(2),
    author: currentBusiness.businessName,
    text,
    date: new Date().toISOString(),
    isBusiness: true,
    replies: [],
  };
  rev.comments = rev.comments || [];
  rev.comments.push(c);
  saveReviews();
  window._SpeakUpWS?.broadcast(window._SpeakUpWS.EVENTS.BIZ_REPLY, {
    reviewId,
    comment: c,
  });
  renderDashboard();
  renderReviews();
}

// ── Business reviews other businesses (Write Review) ─────────
let bizReviewStarRating = 0;
function initBizReviewModal() {
  const stars = document.querySelectorAll("#bizRatingStarsInput i");
  stars.forEach((s) => {
    s.addEventListener("click", () => {
      bizReviewStarRating = parseInt(s.dataset.value);
      stars.forEach((star) => {
        const v = parseInt(star.dataset.value);
        star.className =
          v <= bizReviewStarRating ? "fas fa-star" : "far fa-star";
        star.style.color =
          v <= bizReviewStarRating ? "var(--amber)" : "#cbd5e1";
      });
      document.getElementById("bizSelectedRating").value = bizReviewStarRating;
    });
  });

  document
    .getElementById("bizWriteReviewBtn")
    ?.addEventListener("click", () => {
      document.getElementById("bizReviewForm").reset();
      // auto-fill and lock business name
      const userNameField = document.getElementById("bizReviewUserName");
      if (userNameField && currentBusiness) {
        userNameField.value = currentBusiness.businessName;
        userNameField.readOnly = true;
        userNameField.style.background = "#f0ebe0";
        userNameField.style.cursor = "not-allowed";
      }
      bizReviewStarRating = 0;
      stars.forEach((s) => {
        s.className = "far fa-star";
        s.style.color = "#cbd5e1";
      });
      document.getElementById("bizSelectedRating").value = 0;
      openModal("bizReviewModal");
    });
  document
    .getElementById("closeBizReviewModalBtn")
    ?.addEventListener("click", () => closeModal("bizReviewModal"));
  document
    .getElementById("closeBizReviewModalFooter")
    ?.addEventListener("click", () => closeModal("bizReviewModal"));

  document.getElementById("bizReviewForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const businessName = document
      .getElementById("bizReviewBusinessName")
      .value.trim();
    const category = document.getElementById("bizReviewCategory").value;
    const title = document.getElementById("bizReviewTitle").value.trim();
    const content = document.getElementById("bizReviewContent").value.trim();
    const rating = bizReviewStarRating;
    const userName = document.getElementById("bizReviewUserName").value.trim();
    if (
      !businessName ||
      !category ||
      !title ||
      !content ||
      rating === 0 ||
      !userName
    ) {
      alert("All fields are required.");
      return;
    }
    const newReview = {
      id: Date.now(),
      businessName,
      category,
      rating,
      title,
      content,
      userName,
      date: new Date().toISOString(),
      comments: [],
    };
    reviewsArray.unshift(newReview);
    saveReviews();
    window._SpeakUpWS?.broadcast(
      window._SpeakUpWS.EVENTS.NEW_REVIEW,
      newReview
    );
    closeModal("bizReviewModal");
    alert("Review published successfully!");
    // if consumer tab is active, refresh it
    if (document.getElementById("tab-consumer").style.display !== "none")
      renderConsumerSite();
    renderDashboard(); // refresh dashboard stats (not needed but safe)
  });
}

// ── Settings ──────────────────────────────────────────────────
function prefillSettings() {
  document.getElementById("settingsBizName").value =
    currentBusiness.businessName;
  document.getElementById("settingsEmail").value = currentBusiness.email;
  setTimeout(() => {
    document.getElementById("settingsCategory").value =
      currentBusiness.category;
  }, 50);
}
document.getElementById("saveSettingsBtn").addEventListener("click", () => {
  const name = document.getElementById("settingsBizName").value.trim();
  const cat = document.getElementById("settingsCategory").value;
  const email = document
    .getElementById("settingsEmail")
    .value.trim()
    .toLowerCase();
  const pwd = document.getElementById("settingsPassword").value;
  const pwdC = document.getElementById("settingsPasswordConfirm").value;
  const errEl = document.getElementById("settingsError");
  const sucEl = document.getElementById("settingsSuccess");
  errEl.textContent = "";
  sucEl.textContent = "";
  if (!name || !cat || !email) {
    errEl.textContent = "Name, category and email are required.";
    return;
  }
  if (pwd && pwd !== pwdC) {
    errEl.textContent = "Passwords do not match.";
    return;
  }
  if (
    businessesArray.some(
      (b) =>
        b.id !== currentBusiness.id &&
        b.businessName.toLowerCase() === name.toLowerCase()
    )
  ) {
    errEl.textContent = "Business name already taken.";
    return;
  }
  if (
    businessesArray.some(
      (b) => b.id !== currentBusiness.id && b.email === email
    )
  ) {
    errEl.textContent = "Email already in use.";
    return;
  }
  const idx = businessesArray.findIndex((b) => b.id === currentBusiness.id);
  if (idx === -1) {
    errEl.textContent = "Session error. Please re-login.";
    return;
  }
  businessesArray[idx].businessName = name;
  businessesArray[idx].category = cat;
  businessesArray[idx].email = email;
  if (pwd) businessesArray[idx].password = pwd;
  saveBusinesses();
  currentBusiness = {
    ...currentBusiness,
    businessName: name,
    email,
    category: cat,
  };
  saveSession();
  document.getElementById("sidebarBizName").textContent = name;
  document.getElementById("bizTopInfo").textContent = email;
  sucEl.textContent = "Settings saved successfully!";
  document.getElementById("settingsPassword").value = "";
  document.getElementById("settingsPasswordConfirm").value = "";
  renderDashboard();
});

// ── Subscription Status ──────────────────────────────────────
document.getElementById("subCheckBtn").addEventListener("click", () => {
  const bizRec = businessesArray.find((b) => b.id === currentBusiness.id);
  const expiry = bizRec?.subscriptionExpiry
    ? new Date(bizRec.subscriptionExpiry)
    : null;
  const daysLeft = expiry
    ? Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  const isActive = daysLeft > 0;
  document.getElementById("subStatusContent").innerHTML = `
    <div class="sub-status-badge ${isActive ? "active" : "expired"}">
      <i class="fas fa-${
        isActive ? "circle-check" : "triangle-exclamation"
      }"></i>
      ${
        isActive
          ? `Active — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`
          : "Subscription Expired"
      }
    </div>
    <p style="font-size:.875rem;color:var(--ink-mid);margin-bottom:1.2rem;line-height:1.6;">
      ${
        isActive
          ? `Your subscription renews on <strong>${fmtDate(
              expiry.toISOString()
            )}</strong>. Renewing now extends by another 30 days.`
          : "Your subscription has lapsed. Renew to restore your Verified Badge and portal features."
      }
    </p>
    <div class="sub-renew-box">
      <strong style="display:block;margin-bottom:.6rem;font-size:.88rem;">Renewal: N$200/month includes:</strong>
      <ul class="sub-renew-features">
        <li><i class="fas fa-check"></i> Verified Business Badge</li>
        <li><i class="fas fa-check"></i> Dashboard &amp; Analytics</li>
        <li><i class="fas fa-check"></i> Reply to Reviews</li>
        <li><i class="fas fa-check"></i> Profile Management</li>
      </ul>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn-outline-dark" onclick="closeModal('subStatusModal')">Close</button>
      <button class="btn-primary" id="doRenewBtn" style="flex:1;justify-content:center;"><i class="fas fa-credit-card"></i> Pay N$200 to Renew</button>
    </div>`;
  openModal("subStatusModal");
  document.getElementById("doRenewBtn").onclick = () => {
    closeModal("subStatusModal");
    launchPayFast({
      email: currentBusiness.email,
      itemName: `SpeakUp Namibia – Subscription Renewal (${currentBusiness.businessName})`,
      onSuccess: (ref) => {
        const idx = businessesArray.findIndex(
          (b) => b.id === currentBusiness.id
        );
        if (idx === -1) return;
        const base =
          isActive && expiry ? new Date(expiry.getTime()) : new Date();
        base.setDate(base.getDate() + 30);
        businessesArray[idx].subscriptionExpiry = base.toISOString();
        businessesArray[idx].lastPaymentRef = ref;
        businessesArray[idx].lastPaymentDate = new Date().toISOString();
        saveBusinesses();
        alert(
          `✅ Payment successful!\nReference: ${ref}\nSubscription extended to: ${fmtDate(
            base.toISOString()
          )}`
        );
        renderDashboard();
      },
    });
  };
});

// ── Logout ────────────────────────────────────────────────────
document
  .getElementById("bizLogoutBtn")
  .addEventListener("click", () => openModal("logoutConfirmModal"));
document.getElementById("confirmLogoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("speakup_biz_session");
  window.location.href = "index.html";
});

// ── Consumer Site Embed ───────────────────────────────────────
function renderConsumerSite() {
  let csSearch = "",
    csCat = "all",
    csRating = "all",
    csSort = "newest";
  const wrap = document.getElementById("consumerSiteContent");

  function fmtD(iso) {
    return iso
      ? new Date(iso).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";
  }
  function stars(r) {
    let s = "";
    for (let i = 1; i <= 5; i++)
      s += `<i class="${i <= r ? "fas" : "far"} fa-star"></i>`;
    return `<span class="stars">${s}</span>`;
  }
  function countC(c) {
    if (!c) return 0;
    return c.reduce((a, x) => a + 1 + countC(x.replies), 0);
  }

  function filtered() {
    let f = [...reviewsArray];
    if (csSearch.trim())
      f = f.filter((r) =>
        r.businessName.toLowerCase().includes(csSearch.trim().toLowerCase())
      );
    if (csCat !== "all") f = f.filter((r) => r.category === csCat);
    if (csRating !== "all")
      f = f.filter((r) => r.rating === parseInt(csRating));
    f.sort((a, b) =>
      csSort === "newest"
        ? new Date(b.date) - new Date(a.date)
        : b.rating - a.rating
    );
    return f;
  }

  function renderGrid() {
    const list = filtered();
    if (!list.length)
      return '<div class="empty-state"><i class="fas fa-comment-slash"></i><br>No reviews found.</div>';
    return `<div class="consumer-reviews-grid">${list
      .map((rev) => {
        const cc = countC(rev.comments);
        const isV = businessesArray.some(
          (b) => b.businessName.toLowerCase() === rev.businessName.toLowerCase()
        );
        return `<div class="review-card">
        <div class="card-top">
          <div class="business-name">${esc(rev.businessName)}${
          isV ? ` <span class="badge-verified">✓ Verified</span>` : ""
        }</div>
          ${stars(rev.rating)}
        </div>
        <div class="category-tag"><i class="fas fa-tag"></i>${esc(
          rev.category
        )}</div>
        <div class="review-title">${esc(rev.title)}</div>
        <div class="review-snippet">${esc(
          rev.content.length > 110
            ? rev.content.slice(0, 110) + "…"
            : rev.content
        )}</div>
        <div class="review-meta">
          <span><i class="fas fa-user"></i>${esc(rev.userName)}</span>
          <span><i class="fas fa-calendar-alt"></i>${fmtD(rev.date)}</span>
          ${
            cc
              ? `<span><i class="fas fa-comment"></i>${cc} comment${
                  cc !== 1 ? "s" : ""
                }</span>`
              : ""
          }
        </div>
      </div>`;
      })
      .join("")}</div>`;
  }

  function renderAll() {
    let catOpts =
      '<option value="all">All Categories</option>' +
      CATEGORIES.map(
        (c) =>
          `<option value="${c}"${csCat === c ? " selected" : ""}>${c}</option>`
      ).join("");
    let ratOpts = '<option value="all">All Ratings</option>';
    for (let i = 5; i >= 1; i--)
      ratOpts += `<option value="${i}"${
        csRating == i ? " selected" : ""
      }>${"★".repeat(i)}${"☆".repeat(5 - i)} ${i} star${
        i !== 1 ? "s" : ""
      }</option>`;
    wrap.innerHTML = `
      <div class="consumer-controls controls-bar" style="margin-bottom:1.2rem;">
        <div class="control-input"><i class="fas fa-search"></i><input type="text" id="cs_search" placeholder="Search by business name…" value="${esc(
          csSearch
        )}"></div>
        <div class="control-input"><i class="fas fa-tags"></i><select id="cs_cat">${catOpts}</select></div>
        <div class="control-input"><i class="fas fa-star"></i><select id="cs_rating">${ratOpts}</select></div>
        <div class="control-input"><i class="fas fa-sort"></i><select id="cs_sort">
          <option value="newest"${
            csSort === "newest" ? " selected" : ""
          }>Newest First</option>
          <option value="highest"${
            csSort === "highest" ? " selected" : ""
          }>Highest Rated</option>
        </select></div>
      </div>
      <div id="cs_grid">${renderGrid()}</div>`;
    document.getElementById("cs_search").addEventListener("input", (e) => {
      csSearch = e.target.value;
      document.getElementById("cs_grid").innerHTML = renderGrid();
    });
    document.getElementById("cs_cat").addEventListener("change", (e) => {
      csCat = e.target.value;
      document.getElementById("cs_grid").innerHTML = renderGrid();
    });
    document.getElementById("cs_rating").addEventListener("change", (e) => {
      csRating = e.target.value;
      document.getElementById("cs_grid").innerHTML = renderGrid();
    });
    document.getElementById("cs_sort").addEventListener("change", (e) => {
      csSort = e.target.value;
      document.getElementById("cs_grid").innerHTML = renderGrid();
    });
  }
  renderAll();
}

// ── PayFast Integration (same as consumer) ────────────────────
const PAYFAST_MERCHANT_ID = "10042465";
const PAYFAST_MERCHANT_KEY = "ylo9fatwu9xyj";
const PAYFAST_SANDBOX = true;
const SUB_AMOUNT = "200.00";

function launchPayFast({ email, itemName, onSuccess, onCancel }) {
  const baseUrl = PAYFAST_SANDBOX
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";

  const mPaymentId = "SU_" + Date.now();
  const returnBase = window.location.origin + window.location.pathname;

  const fields = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    return_url: returnBase + "?pf_status=success&ref=" + mPaymentId,
    cancel_url: returnBase + "?pf_status=cancelled",
    email_address: email,
    m_payment_id: mPaymentId,
    amount: SUB_AMOUNT,
    item_name: itemName.substring(0, 100),
  };

  const popup = window.open(
    "",
    "payfast_payment",
    "width=720,height=620,scrollbars=yes,resizable=yes"
  );
  if (!popup) {
    alert("Please allow popups for this site to complete payment.");
    return;
  }

  popup.document
    .write(`<!DOCTYPE html><html><head><title>Redirecting to PayFast…</title>
    <style>body{margin:0;background:#1a3a2a;display:flex;flex-direction:column;align-items:center;
    justify-content:center;min-height:100vh;font-family:sans-serif;color:#d4a853;}
    p{font-size:1.05rem;margin-top:1rem;}
    .spinner{width:40px;height:40px;border:4px solid rgba(212,168,83,.3);border-top-color:#d4a853;
    border-radius:50%;animation:spin 0.8s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg);}}</style></head>
    <body><div class="spinner"></div><p>Redirecting to PayFast…</p></body></html>`);
  popup.document.close();

  setTimeout(() => {
    const form = popup.document.createElement("form");
    form.method = "POST";
    form.action = baseUrl;
    Object.entries(fields).forEach(([k, v]) => {
      const inp = popup.document.createElement("input");
      inp.type = "hidden";
      inp.name = k;
      inp.value = v;
      form.appendChild(inp);
    });
    popup.document.body.appendChild(form);
    form.submit();
  }, 300);

  const poll = setInterval(() => {
    try {
      if (popup.closed) {
        clearInterval(poll);
        if (onCancel) onCancel();
        return;
      }
      const url = popup.location.href;
      if (url.includes("pf_status=success")) {
        clearInterval(poll);
        popup.close();
        const ref = new URL(url).searchParams.get("ref") || mPaymentId;
        onSuccess(ref);
      } else if (url.includes("pf_status=cancelled")) {
        clearInterval(poll);
        popup.close();
        if (onCancel) onCancel();
      }
    } catch (e) {}
  }, 600);
}

// ── WebSocket Listeners ──────────────────────────────────────
function initWSListeners() {
  if (!window._SpeakUpWS) return;
  const WS = window._SpeakUpWS;
  WS.on(WS.EVENTS.NEW_REVIEW, (data) => {
    if (reviewsArray.find((r) => r.id === data.id)) return;
    reviewsArray.unshift(data);
    saveReviews();
    if (
      data.businessName.toLowerCase() ===
      currentBusiness.businessName.toLowerCase()
    ) {
      renderDashboard();
      renderReviews();
      showBizNotif(
        `New ${data.rating}★ review: "${esc(data.title)}" by ${esc(
          data.userName
        )}`
      );
    }
    if (document.getElementById("tab-consumer").style.display !== "none")
      renderConsumerSite();
  });
  WS.on(WS.EVENTS.NEW_COMMENT, ({ reviewId, comment }) => {
    const rev = reviewsArray.find((r) => r.id === reviewId);
    if (!rev) return;
    const exists = findCmt(rev.comments, comment.id);
    if (exists) return;
    rev.comments = rev.comments || [];
    rev.comments.push(comment);
    saveReviews();
    if (
      rev.businessName.toLowerCase() ===
      currentBusiness.businessName.toLowerCase()
    ) {
      renderDashboard();
      renderReviews();
      showBizNotif(
        `New comment on "${esc(rev.title)}" by ${esc(comment.author)}`
      );
    }
  });
  WS.on(WS.EVENTS.BIZ_REPLY, ({ reviewId, comment }) => {
    const rev = reviewsArray.find((r) => r.id === reviewId);
    if (!rev) return;
    const exists = findCmt(rev.comments, comment.id);
    if (exists) return;
    rev.comments = rev.comments || [];
    rev.comments.push(comment);
    saveReviews();
  });
}
function findCmt(comments, id) {
  if (!comments) return null;
  for (const c of comments) {
    if (c.id === id) return c;
    const f = findCmt(c.replies, id);
    if (f) return f;
  }
  return null;
}
function showBizNotif(html) {
  const t = document.getElementById("liveNotifToast");
  document.getElementById("liveNotifText").innerHTML = html;
  t.style.display = "flex";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.display = "none";
  }, 7000);
}

// Backdrop close
window.addEventListener("click", (e) => {
  [
    "subStatusModal",
    "logoutConfirmModal",
    "bizReviewModal",
    "deleteAccountConfirmModal",
  ].forEach((id) => {
    const m = document.getElementById(id);
    if (m && e.target === m) m.style.display = "none";
  });
});

// ── Boot ──────────────────────────────────────────────────────
loadData();
initBizReviewModal();
