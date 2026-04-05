/**
 * SpeakUp Namibia — script.js (Consumer-facing)
 * Scalability: Storage calls are isolated in saveReviews/saveBusinesses.
 * In production, replace those with fetch() to a REST/GraphQL API.
 * WebSocket layer is in speakup-ws.js and calls window._SpeakUpWS.
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
let currentSearch = "",
  currentRatingFilter = "all",
  currentSort = "newest",
  currentCategoryFilter = "all";
let pendingRegData = null;

// ── Utilities ────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function escapeHtml(s) {
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
function countComments(c) {
  if (!c) return 0;
  return c.reduce((a, x) => a + 1 + countComments(x.replies), 0);
}
function openModal(id) {
  document.getElementById(id).style.display = "flex";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

// ── Storage (swap for API calls in production) ───────────────
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
  sessionStorage.setItem(
    "speakup_biz_session",
    JSON.stringify(currentBusiness)
  );
}

// ── Category dropdowns ───────────────────────────────────────
function populateCategoryDropdowns() {
  ["reviewCategory", "regBizCategory", "categoryFilter"].forEach((id) => {
    const s = document.getElementById(id);
    if (!s) return;
    s.innerHTML =
      id === "categoryFilter"
        ? '<option value="all">All Categories</option>'
        : '<option value="">Select a category…</option>';
    CATEGORIES.forEach((cat) => {
      const o = document.createElement("option");
      o.value = cat;
      o.textContent = cat;
      s.appendChild(o);
    });
  });
}
function populateRatingFilter() {
  const s = document.getElementById("ratingFilter");
  if (!s) return;
  s.innerHTML = '<option value="all">All Ratings</option>';
  for (let i = 5; i >= 1; i--)
    s.innerHTML += `<option value="${i}">${"★".repeat(i)}${"☆".repeat(
      5 - i
    )} ${i} star${i !== 1 ? "s" : ""}</option>`;
  s.value = currentRatingFilter;
}

// ── Business Session UI ──────────────────────────────────────
function updateBusinessUI() {
  const div = document.getElementById("businessSessionInfo");
  if (currentBusiness) {
    div.innerHTML = `<span class="badge-business"><i class="fas fa-building"></i> ${escapeHtml(
      currentBusiness.businessName
    )} &nbsp;|&nbsp; <a id="dashLinkBtn">Dashboard</a> &nbsp;|&nbsp; <a id="logoutHeaderBtn">Logout</a></span>`;
    document
      .getElementById("dashLinkBtn")
      ?.addEventListener("click", () => openBizPortal());
    document
      .getElementById("logoutHeaderBtn")
      ?.addEventListener("click", () => openModal("logoutConfirmModal"));
  } else {
    div.innerHTML = "";
  }
}

// ── Filter & Sort ────────────────────────────────────────────
function filterAndSort() {
  let f = [...reviewsArray];
  if (currentSearch.trim())
    f = f.filter((r) =>
      r.businessName.toLowerCase().includes(currentSearch.trim().toLowerCase())
    );
  if (currentCategoryFilter !== "all")
    f = f.filter((r) => r.category === currentCategoryFilter);
  if (currentRatingFilter !== "all")
    f = f.filter((r) => r.rating === parseInt(currentRatingFilter));
  f.sort((a, b) =>
    currentSort === "newest"
      ? new Date(b.date) - new Date(a.date)
      : b.rating - a.rating
  );
  return f;
}

// ── Render reviews grid ──────────────────────────────────────
function renderFilteredReviews(highlightId = null) {
  const filtered = filterAndSort();
  const container = document.getElementById("reviewsContainer");
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-comment-slash"></i><br>No reviews found. Be the first to speak up!</div>`;
    return;
  }
  container.innerHTML = filtered
    .map((rev) => {
      const cc = countComments(rev.comments);
      const isVerified = businessesArray.some(
        (b) => b.businessName.toLowerCase() === rev.businessName.toLowerCase()
      );
      const isNew = rev.id === highlightId;
      return `<div class="review-card${isNew ? " is-new" : ""}">
      <div class="card-top">
        <div class="business-name">${escapeHtml(rev.businessName)}${
        isVerified ? `` : ""
      }</div>
        ${renderStars(rev.rating)}
      </div>
      <div class="category-tag"><i class="fas fa-tag"></i>${escapeHtml(
        rev.category
      )}</div>
      <div class="review-title">${escapeHtml(rev.title)}</div>
      <div class="review-snippet">${escapeHtml(
        rev.content.length > 120 ? rev.content.slice(0, 120) + "…" : rev.content
      )}</div>
      <div class="review-meta">
        <span><i class="fas fa-user"></i>${escapeHtml(rev.userName)}</span>
        <span><i class="fas fa-calendar-alt"></i>${formatDate(rev.date)}</span>
        ${
          cc
            ? `<span><i class="fas fa-comment"></i>${cc} comment${
                cc !== 1 ? "s" : ""
              }</span>`
            : ""
        }
      </div>
      <button class="btn-detail" data-id="${
        rev.id
      }"><i class="fas fa-arrow-right"></i>Read &amp; Join Discussion</button>
    </div>`;
    })
    .join("");
  document
    .querySelectorAll(".btn-detail")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        openDetailModal(parseInt(btn.dataset.id))
      )
    );
}

// ── Add review ───────────────────────────────────────────────
function addNewReview(data) {
  const rev = {
    id: Date.now(),
    ...data,
    date: new Date().toISOString(),
    comments: [],
  };
  reviewsArray.unshift(rev);
  saveReviews();
  renderFilteredReviews(rev.id);
  // Broadcast via WS
  window._SpeakUpWS?.broadcast(window._SpeakUpWS.EVENTS.NEW_REVIEW, rev);
  return rev;
}

// ── Comments ─────────────────────────────────────────────────
function findComment(comments, id) {
  if (!comments) return null;
  for (const c of comments) {
    if (c.id === id) return c;
    const f = findComment(c.replies, id);
    if (f) return f;
  }
  return null;
}
function addComment(reviewId, text, authorName, parentId = null) {
  const rev = reviewsArray.find((r) => r.id === reviewId);
  if (!rev || !text.trim() || !authorName.trim()) return false;
  const isBiz =
    currentBusiness &&
    currentBusiness.businessName.toLowerCase() ===
      rev.businessName.toLowerCase();
  const c = {
    id: "c" + Date.now() + Math.random().toString(36).slice(2),
    author: authorName.trim(),
    text: text.trim(),
    date: new Date().toISOString(),
    isBusiness: !!isBiz,
    replies: [],
  };
  if (parentId) {
    const p = findComment(rev.comments, parentId);
    if (!p) return false;
    p.replies.push(c);
  } else {
    rev.comments = rev.comments || [];
    rev.comments.push(c);
  }
  saveReviews();
  window._SpeakUpWS?.broadcast(window._SpeakUpWS.EVENTS.NEW_COMMENT, {
    reviewId,
    comment: c,
  });
  return true;
}

// ── Comment tree renderer ────────────────────────────────────
function renderCommentTree(comments, reviewId, level = 0) {
  if (!comments?.length) return "";
  return comments
    .map((c) => {
      const rfId = `rf_${c.id}`;
      const isBizL = !!currentBusiness;
      const pf = isBizL ? currentBusiness.businessName : "";
      const ro = isBizL ? "readonly" : "";
      return `<div class="comment ${
        level > 0 ? "comment-reply" : ""
      }" data-cid="${c.id}">
      <div class="comment-meta"><strong>${escapeHtml(c.author)}</strong>${
        c.isBusiness ? '<span class="badge-verified">✓ VERIFIED</span>' : ""
      }<span>${formatDate(c.date)}</span></div>
      <div>${escapeHtml(c.text)}</div>
      <button class="reply-btn" data-cid="${
        c.id
      }"><i class="fas fa-reply"></i> Reply</button>
      <div id="${rfId}" class="reply-form">
        <input type="text" id="rn_${
          c.id
        }" placeholder="Your name *" value="${escapeHtml(pf)}" ${ro}>
        <input type="text" id="rt_${c.id}" placeholder="Write a reply…">
        <button class="btn-primary subReplyBtn" data-rid="${reviewId}" data-pid="${
        c.id
      }" style="margin-top:4px;font-size:.8rem;padding:.35rem .8rem;">Post Reply</button>
      </div>
      ${renderCommentTree(c.replies, reviewId, level + 1)}
    </div>`;
    })
    .join("");
}

// ── Detail modal ─────────────────────────────────────────────
function openDetailModal(reviewId) {
  const rev = reviewsArray.find((r) => r.id === reviewId);
  if (!rev) return;
  const cc = countComments(rev.comments);
  const isBizL = !!currentBusiness;
  const defName = isBizL ? currentBusiness.businessName : "";
  const ro = isBizL ? "readonly" : "";
  document.getElementById("detailModalContent").innerHTML = `
    <div class="modal-header"><span class="modal-title">${escapeHtml(
      rev.businessName
    )}</span><button class="btn-close" id="closeDetailBtn">&#x2715;</button></div>
    <div style="margin-bottom:.5rem;">${renderStars(rev.rating)}</div>
    <div class="category-tag" style="margin-bottom:.8rem;"><i class="fas fa-tag"></i>${escapeHtml(
      rev.category
    )}</div>
    <h3 style="font-family:'Playfair Display',serif;font-size:1.2rem;margin-bottom:.5rem;">${escapeHtml(
      rev.title
    )}</h3>
    <div style="background:var(--cream);padding:1rem;margin-bottom:1rem;line-height:1.7;border-radius:5px;">${escapeHtml(
      rev.content
    )}</div>
    <div style="font-size:.75rem;color:var(--muted);margin-bottom:1.2rem;display:flex;gap:1rem;">
      <span><i class="fas fa-user"></i> ${escapeHtml(rev.userName)}</span>
      <span><i class="fas fa-calendar-alt"></i> ${formatDate(rev.date)}</span>
    </div>
    <hr style="border-top:1px solid var(--border);margin-bottom:1.2rem;">
    <div class="comment-section">
      <h4>Comments | ${cc}</h4>
      ${
        renderCommentTree(rev.comments || [], rev.id) ||
        '<p style="color:var(--muted);font-size:.85rem;">No comments yet — be the first!</p>'
      }
    </div>
    <div style="margin-top:1.4rem;padding-top:1.2rem;border-top:1px solid var(--border);">
      <h4 style="margin-bottom:.8rem;color:var(--forest);font-family:'Playfair Display',sans-serif;">Join the Conversation</h4>
      <input type="text" id="newCmtName" placeholder="Your name *" value="${escapeHtml(
        defName
      )}" ${ro} style="margin-bottom:8px;">
      <textarea id="newCmtText" rows="3" placeholder="Write your comment…" style="margin-bottom:8px;"></textarea>
      <button id="submitCmtBtn" class="btn-primary"><i class="fas fa-paper-plane"></i> Post Comment</button>
    </div>`;
  openModal("detailModal");
  document.getElementById("closeDetailBtn").onclick = () =>
    closeModal("detailModal");
  document.getElementById("submitCmtBtn").onclick = () => {
    let name = document.getElementById("newCmtName").value.trim();
    const text = document.getElementById("newCmtText").value.trim();
    if (isBizL) name = currentBusiness.businessName;
    if (!name) {
      alert("Please enter your name.");
      return;
    }
    if (!text) {
      alert("Please write a comment.");
      return;
    }
    if (addComment(rev.id, text, name, null)) openDetailModal(rev.id);
    else alert("Failed.");
  };
  document.querySelectorAll(".reply-btn").forEach((btn) => {
    btn.onclick = () => {
      const f = document.getElementById(`rf_${btn.dataset.cid}`);
      if (f) f.style.display = f.style.display === "block" ? "none" : "block";
    };
  });
  document.querySelectorAll(".subReplyBtn").forEach((btn) => {
    btn.onclick = () => {
      const pid = btn.dataset.pid;
      let rn = document.getElementById(`rn_${pid}`)?.value.trim();
      const rt = document.getElementById(`rt_${pid}`)?.value.trim();
      if (isBizL) rn = currentBusiness.businessName;
      if (!rn) {
        alert("Enter your name.");
        return;
      }
      if (!rt) {
        alert("Enter reply.");
        return;
      }
      if (addComment(parseInt(btn.dataset.rid), rt, rn, pid))
        openDetailModal(parseInt(btn.dataset.rid));
      else alert("Failed.");
    };
  });
}

// ── Business portal (redirects to business.html) ─────────────
function openBizPortal() {
  if (!currentBusiness) return;
  window.location.href = "business.html";
}

// ── Load data ─────────────────────────────────────────────────
function loadData() {
  try {
    reviewsArray = JSON.parse(localStorage.getItem("speakup_reviews_v2")) || [];
  } catch (e) {
    reviewsArray = [];
  }
  if (!reviewsArray.length) {
    reviewsArray = [
      {
        id: 1001,
        businessName: "MTC Namibia",
        category: "Telecommunications",
        rating: 4,
        title: "Fast data but slow support",
        content:
          "Network coverage is excellent but billing issue took weeks to resolve.",
        userName: "Helena K.",
        date: "2025-02-18T09:24:00Z",
        comments: [
          {
            id: "c1",
            author: "MTC Care Team",
            text: "Apologies, we are working hard to improve our support response times.",
            date: "2025-02-20T14:30:00Z",
            isBusiness: true,
            replies: [],
          },
        ],
      },
      {
        id: 1002,
        businessName: "FNB Namibia",
        category: "Banking & Finance",
        rating: 5,
        title: "Excellent banking experience",
        content:
          "Best bank in Namibia. Staff are professional and the app works flawlessly.",
        userName: "Tomas S.",
        date: "2025-02-10T11:05:00Z",
        comments: [],
      },
      {
        id: 1003,
        businessName: "NamPower",
        category: "Utilities",
        rating: 3,
        title: "Reliable but tariffs are high",
        content:
          "Power is mostly reliable in my area but tariff increases every year are hard to justify.",
        userName: "Lavinia M.",
        date: "2025-01-25T18:20:00Z",
        comments: [],
      },
      {
        id: 1004,
        businessName: "Shoprite Namibia",
        category: "Retail & Supermarkets",
        rating: 2,
        title: "Long queues every weekend",
        content:
          "Severely understaffed on weekends. Management needs to address this urgently.",
        userName: "Patricia N.",
        date: "2025-02-01T13:45:00Z",
        comments: [],
      },
    ];
    saveReviews();
  }
  try {
    businessesArray =
      JSON.parse(localStorage.getItem("speakup_businesses_v2")) || [];
  } catch (e) {
    businessesArray = [];
  }
  try {
    currentBusiness =
      JSON.parse(sessionStorage.getItem("speakup_biz_session")) || null;
  } catch (e) {
    currentBusiness = null;
  }
  updateBusinessUI();
  populateCategoryDropdowns();
  populateRatingFilter();
  renderFilteredReviews();
  document.getElementById("currentYear").textContent = new Date().getFullYear();
}

// ── WebSocket listeners ───────────────────────────────────────
function initWSListeners() {
  if (!window._SpeakUpWS) return;
  const WS = window._SpeakUpWS;
  WS.on(WS.EVENTS.NEW_REVIEW, (data) => {
    if (reviewsArray.find((r) => r.id === data.id)) return; // dedup
    reviewsArray.unshift(data);
    saveReviews();
    renderFilteredReviews(data.id);
    showLiveToast(
      `New review for <strong>${escapeHtml(data.businessName)}</strong>`
    );
  });
  WS.on(WS.EVENTS.NEW_COMMENT, ({ reviewId, comment }) => {
    const rev = reviewsArray.find((r) => r.id === reviewId);
    if (!rev) return;
    const exists = findComment(rev.comments, comment.id);
    if (exists) return;
    rev.comments = rev.comments || [];
    rev.comments.push(comment);
    saveReviews();
    renderFilteredReviews();
  });
}
function showLiveToast(html) {
  const t = document.getElementById("liveToast");
  if (!t) return;
  t.innerHTML = `<i class="fas fa-bolt" style="color:var(--amber);"></i> ${html} — just posted`;
  t.style.display = "flex";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.display = "none";
  }, 5000);
}

// ══════════════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════════════

// Help
document.getElementById("openHelpBtn").onclick = () => openModal("helpModal");

// Write Review
document.getElementById("openWriteReviewBtnNav").onclick = () => {
  resetForm();
  openModal("newReviewModal");
};
document.getElementById("closeNewModalBtn").onclick = () =>
  closeModal("newReviewModal");
document.getElementById("closeNewModalBtnFooter").onclick = () =>
  closeModal("newReviewModal");

let currentStarRating = 0;
const starIcons = document.querySelectorAll("#ratingStarsInput i");
function updateStarUI(r) {
  starIcons.forEach((s) => {
    const v = parseInt(s.dataset.value);
    s.className = v <= r ? "fas fa-star" : "far fa-star";
    s.style.color = v <= r ? "var(--amber)" : "#cbd5e1";
  });
  document.getElementById("selectedRating").value = r;
  currentStarRating = r;
}
starIcons.forEach((s) =>
  s.addEventListener("click", () => updateStarUI(parseInt(s.dataset.value)))
);
function resetForm() {
  ["businessName", "reviewTitle", "reviewContent", "userName"].forEach((id) => {
    const e = document.getElementById(id);
    if (e) e.value = "";
  });
  document.getElementById("reviewCategory").value = "";
  updateStarUI(0);
}

document.getElementById("reviewForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const business = document.getElementById("businessName").value.trim(),
    category = document.getElementById("reviewCategory").value,
    title = document.getElementById("reviewTitle").value.trim(),
    content = document.getElementById("reviewContent").value.trim(),
    rating = currentStarRating,
    userName = document.getElementById("userName").value.trim();
  if (
    !business ||
    !category ||
    !title ||
    !content ||
    rating === 0 ||
    !userName
  ) {
    alert("All fields are required, including your name and star rating.");
    return;
  }
  addNewReview({
    businessName: business,
    category,
    rating,
    title,
    content,
    userName,
  });
  closeModal("newReviewModal");
  resetForm();
});

// Filters
document.getElementById("searchBusiness").addEventListener("input", (e) => {
  currentSearch = e.target.value;
  renderFilteredReviews();
});
document.getElementById("ratingFilter").addEventListener("change", (e) => {
  currentRatingFilter = e.target.value;
  renderFilteredReviews();
});
document.getElementById("sortBy").addEventListener("change", (e) => {
  currentSort = e.target.value;
  renderFilteredReviews();
});
document.getElementById("categoryFilter").addEventListener("change", (e) => {
  currentCategoryFilter = e.target.value;
  renderFilteredReviews();
});

// Business auth
document.getElementById("openBusinessAuthBtn").onclick = () =>
  openModal("businessAuthModal");
document.getElementById("closeAuthModalBtn").onclick = () =>
  closeModal("businessAuthModal");
document.getElementById("showLoginTab").onclick = () => {
  document.getElementById("showLoginTab").classList.add("active");
  document.getElementById("showRegisterTab").classList.remove("active");
  document.getElementById("loginPanel").style.display = "block";
  document.getElementById("registerPanel").style.display = "none";
};
document.getElementById("showRegisterTab").onclick = () => {
  document.getElementById("showRegisterTab").classList.add("active");
  document.getElementById("showLoginTab").classList.remove("active");
  document.getElementById("loginPanel").style.display = "none";
  document.getElementById("registerPanel").style.display = "block";
};

// Register — validate then show subscription paywall
document.getElementById("doRegisterBtn").onclick = () => {
  const bizName = document.getElementById("regBizName").value.trim(),
    category = document.getElementById("regBizCategory").value,
    email = document.getElementById("regEmail").value.trim().toLowerCase(),
    pwd = document.getElementById("regPassword").value,
    errEl = document.getElementById("regError");
  errEl.textContent = "";
  if (!bizName || !category || !email || !pwd) {
    errEl.textContent = "All fields are required.";
    return;
  }
  if (pwd.length < 6) {
    errEl.textContent = "Password must be at least 6 characters.";
    return;
  }
  if (
    businessesArray.some(
      (b) => b.businessName.toLowerCase() === bizName.toLowerCase()
    )
  ) {
    errEl.textContent = "Business name already taken.";
    return;
  }
  if (businessesArray.some((b) => b.email === email)) {
    errEl.textContent = "Email already in use.";
    return;
  }
  pendingRegData = { bizName, category, email, pwd };
  closeModal("businessAuthModal");
  openModal("subscriptionModal");
};

// ── PayFast Integration ──────────────────────────────────────
// Replace with your actual PayFast Merchant ID and Key from payfast.co.za
const PAYFAST_MERCHANT_ID = "10042465"; // sandbox merchant id
const PAYFAST_MERCHANT_KEY = "ylo9fatwu9xyj"; // sandbox merchant key
const PAYFAST_SANDBOX = true; // set to false in production
const SUB_AMOUNT = "200.00"; // N$200

/**
 * launchPayFast — opens PayFast in a popup window.
 * Polls for the return URL to detect successful vs cancelled payments.
 * Production: implement a server-side ITN (Instant Transaction Notification)
 * handler at your notify_url to securely verify payment completion.
 */
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

  // Build and submit form in popup
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

  // Poll popup location for return/cancel
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
    } catch (e) {
      // Cross-origin during PayFast page load — keep polling
    }
  }, 600);
}

// Subscription modal
document.getElementById("closeSubModal").onclick = () => {
  closeModal("subscriptionModal");
  pendingRegData = null;
};
document.getElementById("cancelSubBtn").onclick = () => {
  closeModal("subscriptionModal");
  openModal("businessAuthModal");
};
document.getElementById("confirmPayBtn").onclick = () => {
  if (!pendingRegData) return;
  const { bizName, category, email, pwd } = pendingRegData;
  // Launch PayFast — only register account on successful payment
  launchPayFast({
    email,
    itemName: `SpeakUp Namibia – Business Registration (${bizName})`,
    onSuccess: (ref) => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      const newBiz = {
        id: Date.now(),
        businessName: bizName,
        category,
        email,
        password: pwd,
        subscriptionExpiry: expiry.toISOString(),
        registeredOn: new Date().toISOString(),
        lastPaymentRef: ref,
        lastPaymentDate: new Date().toISOString(),
      };
      businessesArray.push(newBiz);
      saveBusinesses();
      currentBusiness = {
        id: newBiz.id,
        businessName: newBiz.businessName,
        email: newBiz.email,
        category: newBiz.category,
      };
      saveSession();
      updateBusinessUI();
      renderFilteredReviews();
      pendingRegData = null;
      closeModal("subscriptionModal");
      setTimeout(() => {
        window.location.href = "business.html";
      }, 150);
    },
  });
};

// Login
document.getElementById("doLoginBtn").onclick = () => {
  const email = document
      .getElementById("loginEmail")
      .value.trim()
      .toLowerCase(),
    pwd = document.getElementById("loginPassword").value,
    errEl = document.getElementById("loginError");
  errEl.textContent = "";
  const biz = businessesArray.find(
    (b) => b.email === email && b.password === pwd
  );
  if (!biz) {
    errEl.textContent = "Invalid email or password.";
    return;
  }
  currentBusiness = {
    id: biz.id,
    businessName: biz.businessName,
    email: biz.email,
    category: biz.category,
  };
  saveSession();
  updateBusinessUI();
  closeModal("businessAuthModal");
  renderFilteredReviews();
  setTimeout(() => {
    window.location.href = "business.html";
  }, 150);
};

// Logout confirm
document.getElementById("confirmLogoutBtn").onclick = () => {
  currentBusiness = null;
  sessionStorage.removeItem("speakup_biz_session");
  updateBusinessUI();
  renderFilteredReviews();
  closeModal("logoutConfirmModal");
};

// Close modal on backdrop click
window.addEventListener("click", (e) => {
  [
    "helpModal",
    "newReviewModal",
    "businessAuthModal",
    "subscriptionModal",
    "logoutConfirmModal",
    "detailModal",
  ].forEach((id) => {
    const m = document.getElementById(id);
    if (m && e.target === m) m.style.display = "none";
  });
});

// ── Init ───────────────────────────────────────────────────────
loadData();
initWSListeners();

// ── Consumer Mobile Sidebar (Hamburger) ───────────────────────
(function () {
  function openConsumerSidebar() {
    document.getElementById("consumerSidebar")?.classList.add("open");
    document.getElementById("consumerSidebarOverlay")?.classList.add("active");
    document.body.style.overflow = "hidden";
  }
  function closeConsumerSidebar() {
    document.getElementById("consumerSidebar")?.classList.remove("open");
    document
      .getElementById("consumerSidebarOverlay")
      ?.classList.remove("active");
    document.body.style.overflow = "";
  }

  document
    .getElementById("consumerHamburger")
    ?.addEventListener("click", openConsumerSidebar);
  document
    .getElementById("consumerSidebarClose")
    ?.addEventListener("click", closeConsumerSidebar);
  document
    .getElementById("consumerSidebarOverlay")
    ?.addEventListener("click", closeConsumerSidebar);

  // Wire sidebar nav buttons to the same actions as the top-nav
  document
    .getElementById("sidebarWriteReviewBtn")
    ?.addEventListener("click", () => {
      closeConsumerSidebar();
      openModal("newReviewModal");
    });
  document
    .getElementById("sidebarBizPortalBtn")
    ?.addEventListener("click", () => {
      closeConsumerSidebar();
      openModal("businessAuthModal");
    });
  document.getElementById("sidebarHelpBtn")?.addEventListener("click", () => {
    closeConsumerSidebar();
    openModal("helpModal");
  });

  // Keep sidebar biz info in sync with top-nav biz info
  const origUpdateBizUI = window.updateBusinessUI;
  function updateSidebarBizInfo() {
    const div = document.getElementById("consumerSidebarBizInfo");
    if (!div) return;
    if (currentBusiness) {
      div.innerHTML = `<div class="consumer-sidebar-biz-block">
        <i class="fas fa-building"></i>
        <span>${escapeHtml(currentBusiness.businessName)}</span>
        <button id="sidebarDashBtn" class="consumer-snav-btn" style="margin-top:6px;"><i class="fas fa-gauge-high"></i> Dashboard</button>
        <button id="sidebarLogoutBtn" class="consumer-snav-btn danger"><i class="fas fa-right-from-bracket"></i> Logout</button>
      </div>`;
      document
        .getElementById("sidebarDashBtn")
        ?.addEventListener("click", () => {
          closeConsumerSidebar();
          openBizPortal?.();
        });
      document
        .getElementById("sidebarLogoutBtn")
        ?.addEventListener("click", () => {
          closeConsumerSidebar();
          openModal("logoutConfirmModal");
        });
    } else {
      div.innerHTML = "";
    }
  }
  // Patch updateBusinessUI to also update sidebar
  const _orig = window.updateBusinessUI;
  window.updateBusinessUI = function () {
    if (_orig) _orig();
    updateSidebarBizInfo();
  };
})();
