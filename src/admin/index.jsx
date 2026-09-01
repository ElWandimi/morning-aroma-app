import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { SignInModal, SignUpModal, ShareButtons } from "../components";
import { useAdmin, useAuth, useCurrency, useRoute, useToast } from "../context";
import { ADMIN_SECTIONS, COUNTRIES, FILTER_DEFS, GREEN_BEANS, MOMENTS, PRODUCTS } from "../data";
import { exportToCSV, fmtPrice, resizeImageFile, storage } from "../utils/helpers";
import { useClickOutside, useEscapeKey } from "../hooks";
import { generateInvoicePDF } from "../utils/pdf";
import { api } from "../utils/api";

export function CountUp({ text }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState(typeof text === "string" && /^[\d.]/.test(text) ? "0" : text);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const match = String(text).match(/^([$]?)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!match) { setDisplay(text); return; }
    const [, prefix, numStr, suffix] = match;
    const target = parseFloat(numStr.replace(/,/g, ""));
    if (isNaN(target)) { setDisplay(text); return; }
    const duration = 700;
    const start = performance.now();
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      setDisplay(`${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [visible, text]);
  return <span ref={ref}>{display}</span>;
}

// Shared search + CSV export bar, reused across every admin table below rather than each
// building its own. `onExport` is optional — omit it for tables where a CSV wouldn't add much
// (e.g. Feedback, which is prose rather than tabular).
export function AdminTableToolbar({ query, setQuery, onExport, placeholder = "Search…" }) {
  return (
    <div className="admin-table-toolbar">
      <input type="search" className="admin-search-input" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      {onExport && <button className="btn-outline small" onClick={onExport}>Export CSV</button>}
    </div>
  );
}

// Paginates a (usually already-filtered) list client-side -- everything's in memory already, no
// fetch needed. Resets to page 1 whenever the underlying item count changes (e.g. a search
// narrows the results), so a stale "page 4 of 1" state can't happen after filtering.
export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [items.length, totalPages]);
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
  return { page, setPage, pageItems, totalPages };
}

export function AdminPager({ page, setPage, totalPages }) {
  if (totalPages <= 1) return null;
  return (
    <div className="admin-pager">
      <button className="link-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
      <span className="hint" style={{ margin: 0 }}>Page {page} of {totalPages}</span>
      <button className="link-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
    </div>
  );
}

export function AdminOverview() {
  const { quotations, feedbackList, greenOrders, serviceInquiries, getAllProducts, realUsers: users, realOrders: orders } = useAdmin();
  const retailRevenueCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const greenRevenueCents = greenOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const consultingRevenueCents = serviceInquiries.reduce((sum, s) => sum + (s.agreedFeeCents || 0), 0);
  const revenueCents = retailRevenueCents + greenRevenueCents + consultingRevenueCents;
  const avgRating = feedbackList.length ? (feedbackList.reduce((s, f) => s + f.rating, 0) / feedbackList.length).toFixed(1) : "—";
  const byStatus = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
  const qtyByProduct = orders.reduce((acc, o) => {
    o.items.forEach((it) => { acc[it.id] = (acc[it.id] || 0) + it.qty; });
    return acc;
  }, {});
  const allProductsForTop = getAllProducts();
  const topProducts = Object.entries(qtyByProduct)
    .map(([id, qty]) => ({ product: allProductsForTop.find((p) => p.id === id), qty }))
    .filter((x) => x.product)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  const maxQty = topProducts[0]?.qty || 1;

  const kpis = [
    { label: "Total revenue", value: fmtPrice(revenueCents) },
    { label: "Orders", value: orders.length },
    { label: "Customers", value: users.length },
    { label: "Open quotations", value: quotations.filter((q) => q.status !== "Closed").length },
    { label: "New feedback", value: feedbackList.filter((f) => !f.reviewed).length },
    { label: "Avg. bean rating", value: avgRating === "—" ? "—" : `${avgRating}/5` },
  ];

  return (
    <div>
      <div className="admin-kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className="admin-kpi-card">
            <p className="filter-label">{k.label}</p>
            <p className="admin-kpi-value"><CountUp text={String(k.value)} /></p>
          </div>
        ))}
      </div>
      <p className="hint" style={{ marginTop: -8, marginBottom: 20 }}>
        Total revenue = retail orders ({fmtPrice(retailRevenueCents)}) + green coffee wholesale ({fmtPrice(greenRevenueCents)}) + consultations with an agreed fee ({fmtPrice(consultingRevenueCents)}).
      </p>
      <h3 className="matched-head">Orders by status</h3>
      <div className="admin-status-bars">
        {Object.keys(byStatus).length === 0 ? (
          <p className="hint">No orders yet.</p>
        ) : (
          Object.entries(byStatus).map(([status, n]) => (
            <div key={status} className="admin-status-row">
              <span>{status}</span>
              <div className="admin-status-track"><div className="admin-status-fill" style={{ width: `${(n / orders.length) * 100}%` }} /></div>
              <span>{n}</span>
            </div>
          ))
        )}
      </div>

      <h3 className="matched-head">Top products by units sold</h3>
      <div className="admin-status-bars">
        {topProducts.length === 0 ? (
          <p className="hint">No sales data yet.</p>
        ) : (
          topProducts.map(({ product, qty }) => (
            <div key={product.id} className="admin-status-row">
              <span>{product.name}</span>
              <div className="admin-status-track"><div className="admin-status-fill" style={{ width: `${(qty / maxQty) * 100}%` }} /></div>
              <span>{qty}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AdminAnalytics() {
  const { greenOrders, serviceInquiries, getAllProducts, realUsers: users, realOrders: orders } = useAdmin();

  const revenueByDate = {};
  orders.forEach((o) => {
    // Real orders return a full ISO timestamp (createdAt), not the old fake data's bare
    // YYYY-MM-DD string -- truncate to the date portion here, at the one place this actually
    // gets grouped by day, same fix already applied to signupsByDate below for the same reason.
    const day = o.createdAt.slice(0, 10);
    revenueByDate[day] = (revenueByDate[day] || 0) + o.totalCents;
  });
  greenOrders.forEach((o) => { revenueByDate[o.date] = (revenueByDate[o.date] || 0) + o.totalCents; });
  const revenueDates = Object.keys(revenueByDate).sort();
  const maxRevenue = Math.max(...revenueDates.map((d) => revenueByDate[d]), 1);

  const signupsByDate = {};
  users.forEach((u) => { if (u.createdAt) { const day = u.createdAt.slice(0, 10); signupsByDate[day] = (signupsByDate[day] || 0) + 1; } });
  const signupDates = Object.keys(signupsByDate).sort();
  const maxSignups = Math.max(...signupDates.map((d) => signupsByDate[d]), 1);

  const retailRevenueCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const greenRevenueCents = greenOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const consultingRevenueCents = serviceInquiries.reduce((sum, s) => sum + (s.agreedFeeCents || 0), 0);
  const totalRevenueCents = retailRevenueCents + greenRevenueCents + consultingRevenueCents || 1;
  const revenueBySource = [
    ["Retail orders", retailRevenueCents], ["Green wholesale", greenRevenueCents], ["Consultations", consultingRevenueCents],
  ];

  const qtyByProduct = orders.reduce((acc, o) => {
    o.items.forEach((it) => { acc[it.id] = (acc[it.id] || 0) + it.qty; });
    return acc;
  }, {});
  const allProducts = getAllProducts();
  const topProducts = Object.entries(qtyByProduct)
    .map(([id, qty]) => ({ product: allProducts.find((p) => p.id === id), qty }))
    .filter((x) => x.product)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);
  const maxQty = topProducts[0]?.qty || 1;

  // Real page views from this browser only -- there's no backend here to aggregate traffic across
  // every visitor, so this can't be site-wide analytics the way Google Analytics would show it.
  // What it can honestly show: actual navigation that happened in this browser, tracked the moment
  // each page loads, respecting the same storage consent gate as cart/wishlist persistence.
  const pageViewsByDate = storage.get("ma_pageviews", {});
  const viewDates = Object.keys(pageViewsByDate).sort();
  const totalViews = viewDates.reduce((sum, d) => sum + Object.values(pageViewsByDate[d]).reduce((s, n) => s + n, 0), 0);
  const viewsByDateTotal = {};
  viewDates.forEach((d) => { viewsByDateTotal[d] = Object.values(pageViewsByDate[d]).reduce((s, n) => s + n, 0); });
  const maxViewsPerDay = Math.max(...viewDates.map((d) => viewsByDateTotal[d]), 1);
  const viewsByPage = {};
  viewDates.forEach((d) => {
    Object.entries(pageViewsByDate[d]).forEach(([page, count]) => { viewsByPage[page] = (viewsByPage[page] || 0) + count; });
  });
  const topPages = Object.entries(viewsByPage).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxPageViews = topPages[0]?.[1] || 1;

  return (
    <div>
      <h3 className="matched-head">Analytics</h3>
      <p className="hint" style={{ marginTop: -6 }}>
        Built entirely from real orders, signups, and sales already tracked in this session — not sample data. One honest limit worth
        knowing: this is a frontend prototype with no backend, so there's no visitor or page-view tracking here (that needs a real
        analytics service or server-side logging, neither of which exists yet). Everything below reflects what people actually did,
        not how many people looked.
      </p>

      <h4 className="admin-subhead">Revenue by day</h4>
      {revenueDates.length === 0 ? (
        <p className="hint">No orders yet — this fills in as orders come through.</p>
      ) : (
        <div className="analytics-bar-chart">
          {revenueDates.map((d) => (
            <div key={d} className="analytics-bar-col">
              <div className="analytics-bar" style={{ height: `${Math.max(6, (revenueByDate[d] / maxRevenue) * 100)}%` }} title={`${d}: ${fmtPrice(revenueByDate[d])}`} />
              <span className="analytics-bar-label">{d.slice(5)}</span>
            </div>
          ))}
        </div>
      )}

      <h4 className="admin-subhead">Revenue by source</h4>
      <div className="admin-status-bars">
        {revenueBySource.map(([label, cents]) => (
          <div key={label} className="admin-status-row admin-status-row-wide">
            <span>{label}</span>
            <div className="admin-status-track"><div className="admin-status-fill" style={{ width: `${(cents / totalRevenueCents) * 100}%` }} /></div>
            <span>{fmtPrice(cents)}</span>
          </div>
        ))}
      </div>

      <h4 className="admin-subhead">New customers by day</h4>
      {signupDates.length === 0 ? (
        <p className="hint">No signups yet.</p>
      ) : (
        <div className="analytics-bar-chart">
          {signupDates.map((d) => (
            <div key={d} className="analytics-bar-col">
              <div className="analytics-bar green" style={{ height: `${Math.max(6, (signupsByDate[d] / maxSignups) * 100)}%` }} title={`${d}: ${signupsByDate[d]} signup${signupsByDate[d] === 1 ? "" : "s"}`} />
              <span className="analytics-bar-label">{d.slice(5)}</span>
            </div>
          ))}
        </div>
      )}

      <h4 className="admin-subhead">Top products (all-time units sold)</h4>
      {topProducts.length === 0 ? (
        <p className="hint">No sales yet.</p>
      ) : (
        <div className="admin-status-bars">
          {topProducts.map(({ product, qty }) => (
            <div key={product.id} className="admin-status-row admin-status-row-wide">
              <span>{product.name}</span>
              <div className="admin-status-track"><div className="admin-status-fill" style={{ width: `${(qty / maxQty) * 100}%` }} /></div>
              <span>{qty} sold</span>
            </div>
          ))}
        </div>
      )}

      <h4 className="admin-subhead">Site views — {totalViews} total</h4>
      <p className="hint" style={{ marginTop: -6 }}>
        From this browser only, not every visitor to the site — that needs a real analytics service or server-side logging, which
        this prototype doesn't have. Recorded the moment each page loads, only if cookie/storage consent was accepted.
      </p>
      {viewDates.length === 0 ? (
        <p className="hint">No page views recorded yet in this browser (or storage consent wasn't accepted).</p>
      ) : (
        <>
          <div className="analytics-bar-chart">
            {viewDates.map((d) => (
              <div key={d} className="analytics-bar-col">
                <div className="analytics-bar" style={{ height: `${Math.max(6, (viewsByDateTotal[d] / maxViewsPerDay) * 100)}%` }} title={`${d}: ${viewsByDateTotal[d]} view${viewsByDateTotal[d] === 1 ? "" : "s"}`} />
                <span className="analytics-bar-label">{d.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="admin-status-bars">
            {topPages.map(([page, count]) => (
              <div key={page} className="admin-status-row admin-status-row-wide">
                <span style={{ textTransform: "capitalize" }}>{page}</span>
                <div className="admin-status-track"><div className="admin-status-fill" style={{ width: `${(count / maxPageViews) * 100}%` }} /></div>
                <span>{count} view{count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AdminOrders() {
  const { realOrders: allOrdersSorted, realOrdersLoading: loading, realOrdersError: loadError, refetchRealOrders, updateOrderStatus, refundOrder } = useAdmin();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [refunding, setRefunding] = useState(null);
  const filtered = allOrdersSorted.filter((o) => {
    const q = query.toLowerCase();
    return !q || o.orderNumber.toLowerCase().includes(q) || o.customerEmail.toLowerCase().includes(q) || o.status.toLowerCase().includes(q);
  });
  // totalCents is now captured server-side at order time (locked-in pricing), not recomputed
  // from current catalog prices the way the old in-memory version had to.
  const toggleSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir(field === "date" ? "desc" : "desc"); }
  };
  const orders = [...filtered].sort((a, b) => {
    const av = sortBy === "total" ? a.totalCents : a.createdAt;
    const bv = sortBy === "total" ? b.totalCents : b.createdAt;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });
  const { page, setPage, pageItems, totalPages } = usePagination(orders, 10);
  const STATUSES = ["Processing", "Roasting", "Shipped", "Delivered", "Cancelled", "Refunded"];
  const exportOrders = () => exportToCSV("orders", ["Order", "Customer", "Date", "Items", "Total (USD)", "Payment", "Mode", "Status"], orders.map((o) => [
    o.orderNumber, o.customerEmail, o.createdAt.slice(0, 10), o.items.reduce((s, it) => s + it.qty, 0),
    (o.totalCents / 100).toFixed(2), o.paymentStatus, o.paymentMode || "", o.status,
  ]));
  const sortArrow = (field) => (sortBy === field ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  const changeStatus = async (o, status) => {
    const result = await updateOrderStatus(o.id, status);
    if (!result.ok) window.alert(result.error); // a plain alert, not a toast -- this component has no useToast() wired in, and adding one just for this single error path isn't worth it given how rare a failure here should be
  };

  const handleRefund = async (o) => {
    if (!window.confirm(`Process a real refund for ${o.orderNumber} via Paystack? This calls Paystack's real refund API -- it can take up to 10 business days for the customer to actually receive the funds.`)) return;
    setRefunding(o.id);
    const result = await refundOrder(o.id);
    setRefunding(null);
    if (!result.ok) window.alert(result.error);
  };

  if (loading) return <p className="hint">Loading orders…</p>;
  if (loadError) {
    return (
      <div>
        <p className="form-error">Couldn't load orders: {loadError}</p>
        <button className="btn-outline" onClick={refetchRealOrders}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="matched-head">All orders ({orders.length}{query ? ` of ${allOrdersSorted.length}` : ""})</h3>
      <AdminTableToolbar query={query} setQuery={setQuery} onExport={allOrdersSorted.length > 0 ? exportOrders : null} placeholder="Search by order, customer, or status…" />
      {allOrdersSorted.length === 0 ? (
        <p className="hint">No orders have been placed yet.</p>
      ) : orders.length === 0 ? (
        <p className="hint">No orders match "{query}".</p>
      ) : (
        <div className="admin-table admin-table-orders">
          <div className="admin-row admin-header">
            <span>Order</span><span>Customer</span>
            <span className="admin-sortable" onClick={() => toggleSort("date")}>Date{sortArrow("date")}</span>
            <span>Items</span>
            <span className="admin-sortable" onClick={() => toggleSort("total")}>Total{sortArrow("total")}</span>
            <span>Payment</span>
            <span>Status</span>
          </div>
          {pageItems.map((o) => (
            <div key={o.id} className="admin-row">
              <span>{o.orderNumber}</span>
              <span>{o.customerEmail}</span>
              <span>{o.createdAt.slice(0, 10)}</span>
              <span>{o.items.reduce((s, it) => s + it.qty, 0)} items</span>
              <span>{fmtPrice(o.totalCents)}</span>
              <span className={`payment-badge ${o.paymentStatus}`}>
                {o.paymentStatus === "refund_pending" ? "refund pending" : o.paymentStatus}
                {o.paymentMode === "test" && <span className="payment-mode-badge" title="Paid with a Paystack test key — not real money">TEST</span>}
              </span>
              <span className="admin-inline-edit">
                <select value={o.status} onChange={(e) => changeStatus(o, e.target.value)}>
                  {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                {o.paymentStatus === "refund_pending" && (
                  <button className="link-btn" onClick={() => handleRefund(o)} disabled={refunding === o.id}>
                    {refunding === o.id ? "Processing…" : "Process refund"}
                  </button>
                )}
              </span>
            </div>
          ))}
          <AdminPager page={page} setPage={setPage} totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}

export function AdminSubscriptions() {
  const { realSubscriptions: allSubsSorted, realSubscriptionsLoading: loading, realSubscriptionsError: loadError, refetchRealSubscriptions } = useAdmin();
  const [query, setQuery] = useState("");
  const filtered = allSubsSorted.filter((s) => {
    const q = query.toLowerCase();
    return !q || s.userEmail.toLowerCase().includes(q) || s.userName.toLowerCase().includes(q) || s.targetName.toLowerCase().includes(q) || s.status.toLowerCase().includes(q);
  });
  const subscriptions = [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const { page, setPage, pageItems, totalPages } = usePagination(subscriptions, 10);
  const exportSubscriptions = () => exportToCSV("subscriptions", ["Customer", "Email", "Type", "Item", "Interval", "Amount (USD)", "Status", "Next payment", "Started"], subscriptions.map((s) => [
    s.userName, s.userEmail, s.targetType, s.targetName, s.interval, (s.amountUsdCents / 100).toFixed(2), s.status,
    s.nextPaymentDate ? s.nextPaymentDate.slice(0, 10) : "", s.createdAt.slice(0, 10),
  ]));

  if (loading) return <p className="hint">Loading subscriptions…</p>;
  if (loadError) {
    return (
      <div>
        <p className="form-error">Couldn't load subscriptions: {loadError}</p>
        <button className="btn-outline" onClick={refetchRealSubscriptions}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="matched-head">All subscriptions ({subscriptions.length}{query ? ` of ${allSubsSorted.length}` : ""})</h3>
      <p className="hint">
        Read-only — customers manage their own subscriptions (pause, resume, cancel) from My Aroma Journey. This is for
        support visibility only.
      </p>
      <AdminTableToolbar query={query} setQuery={setQuery} onExport={allSubsSorted.length > 0 ? exportSubscriptions : null} placeholder="Search by customer, item, or status…" />
      {allSubsSorted.length === 0 ? (
        <p className="hint">No subscriptions yet.</p>
      ) : subscriptions.length === 0 ? (
        <p className="hint">No subscriptions match "{query}".</p>
      ) : (
        <div className="admin-table admin-table-orders">
          <div className="admin-row admin-header">
            <span>Customer</span><span>Item</span><span>Interval</span><span>Amount</span><span>Next payment</span><span>Status</span>
          </div>
          {pageItems.map((s) => (
            <div key={s.id} className="admin-row">
              <span>{s.userName} <span className="hint">({s.userEmail})</span></span>
              <span>{s.targetName} <span className="hint">({s.targetType})</span></span>
              <span>{s.interval === "monthly" ? "Monthly" : "Annually"}</span>
              <span>{fmtPrice(s.amountUsdCents)}</span>
              <span>{s.nextPaymentDate ? s.nextPaymentDate.slice(0, 10) : "—"}</span>
              <span className={`payment-badge ${s.status === "active" ? "paid" : s.status === "cancelled" ? "refunded" : s.status === "past_due" ? "unpaid" : "refund_pending"}`}>{s.status.replace("_", " ")}</span>
            </div>
          ))}
          <AdminPager page={page} setPage={setPage} totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}

export function AdminAcademyLifetimeAccess() {
  const { realLifetimeAccess, realLifetimeAccessLoading, realLifetimeAccessError, refetchRealLifetimeAccess } = useAdmin();
  const [query, setQuery] = useState("");
  const filtered = realLifetimeAccess.filter((l) => {
    const q = query.toLowerCase();
    return !q || l.userEmail.toLowerCase().includes(q) || l.userName.toLowerCase().includes(q);
  });

  if (realLifetimeAccessLoading) return <p className="hint">Loading lifetime access purchases…</p>;
  if (realLifetimeAccessError) {
    return (
      <div>
        <p className="form-error">Couldn't load lifetime access purchases: {realLifetimeAccessError}</p>
        <button className="btn-outline" onClick={refetchRealLifetimeAccess}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="matched-head">Academy lifetime access ({filtered.length}{query ? ` of ${realLifetimeAccess.length}` : ""})</h3>
      <AdminTableToolbar query={query} setQuery={setQuery} placeholder="Search by customer…" />
      {realLifetimeAccess.length === 0 ? (
        <p className="hint">Nobody has purchased lifetime access yet.</p>
      ) : (
        <div className="admin-table admin-table-orders">
          <div className="admin-row admin-header">
            <span>Customer</span><span>Amount paid</span><span>Purchased</span>
          </div>
          {filtered.map((l) => (
            <div key={l.id} className="admin-row">
              <span>{l.userName} <span className="hint">({l.userEmail})</span></span>
              <span>{fmtPrice(l.amountUsdCents)}</span>
              <span>{l.purchasedAt.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminInvoices() {
  const { realOrders: orders, greenOrders, serviceInquiries, settings, setServiceInquiryFee, getAllProducts } = useAdmin();
  const { addToast } = useToast();
  const [feeDrafts, setFeeDrafts] = useState({});
  const business = {
    name: settings.businessName, address: settings.businessAddress, email: settings.contactEmail,
    taxId: settings.taxId, taxRatePercent: settings.taxRatePercent, invoiceNotes: settings.invoiceNotes,
  };
  // Shows a local typing draft if one exists, otherwise falls back to whatever fee was already
  // agreed and persisted on the inquiry itself, so it survives switching sections and back
  // instead of reverting to blank.
  const feeDraftFor = (s) => (feeDrafts[s.id] !== undefined ? feeDrafts[s.id] : (s.agreedFeeCents ? (s.agreedFeeCents / 100).toFixed(2) : ""));
  const commitFee = (s) => {
    const raw = feeDraftFor(s);
    const cents = Math.round(parseFloat(raw || "0") * 100);
    if (cents > 0) setServiceInquiryFee(s.id, cents);
  };

  const downloadOrderInvoice = (o) => {
    const allProducts = getAllProducts();
    const lineItems = o.items.map((it) => {
      const p = allProducts.find((prod) => prod.id === it.id);
      // Uses the price actually locked in at order time (it.unitPriceCents), not whatever the
      // product costs right now -- an invoice for a past order should reflect what was actually
      // charged, even if the catalog price has since changed.
      return { description: p ? `${p.name} — ${p.country}` : it.id, qty: it.qty, unitPriceCents: it.unitPriceCents, totalCents: it.unitPriceCents * it.qty };
    });
    const totalCents = lineItems.reduce((s, li) => s + li.totalCents, 0);
    generateInvoicePDF({
      invoiceNumber: o.orderNumber, date: o.createdAt.slice(0, 10),
      billTo: { name: o.customerEmail, email: o.customerEmail },
      lineItems, totalCents, notes: `Order status: ${o.status}`, business,
    });
    addToast("Invoice downloaded");
  };

  const downloadGreenInvoice = (o) => {
    generateInvoicePDF({
      invoiceNumber: o.id, date: o.date,
      billTo: { name: o.name, email: o.email, company: o.company },
      lineItems: [{ description: `${o.beanName} (green, unroasted)`, qty: o.quantityKg, unitPriceCents: o.pricePerKgCentsAtOrder, totalCents: o.totalCents }],
      totalCents: o.totalCents,
      notes: o.message || "", business,
    });
    addToast("Invoice downloaded");
  };

  const downloadServiceInvoice = (s) => {
    commitFee(s);
    const feeCents = s.agreedFeeCents || Math.round(parseFloat(feeDraftFor(s) || "0") * 100);
    if (!feeCents || feeCents <= 0) { addToast("Enter an agreed fee first"); return; }
    generateInvoicePDF({
      invoiceNumber: s.id, date: s.date,
      billTo: { name: s.name, email: s.email, company: s.company },
      lineItems: [{ description: s.interest, qty: 1, unitPriceCents: feeCents, totalCents: feeCents }],
      totalCents: feeCents,
      notes: s.message || "", business,
    });
    addToast("Invoice downloaded");
  };

  const [orderQuery, setOrderQuery] = useState("");
  const [greenQuery, setGreenQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");

  const filteredOrders = orders.filter((o) => {
    const q = orderQuery.toLowerCase();
    return !q || o.orderNumber.toLowerCase().includes(q) || o.customerEmail.toLowerCase().includes(q);
  });
  const filteredGreenOrders = greenOrders.filter((o) => {
    const q = greenQuery.toLowerCase();
    return !q || o.id.toLowerCase().includes(q) || (o.company || o.name).toLowerCase().includes(q) || o.beanName.toLowerCase().includes(q);
  });
  const filteredServiceInquiries = serviceInquiries.filter((s) => {
    const q = serviceQuery.toLowerCase();
    return !q || (s.company || s.name).toLowerCase().includes(q) || s.interest.toLowerCase().includes(q);
  });

  const exportOrderInvoicesList = () => exportToCSV("order-invoices", ["Order", "Customer", "Date", "Total (USD)"], filteredOrders.map((o) => [
    o.orderNumber, o.customerEmail, o.createdAt.slice(0, 10), (o.totalCents / 100).toFixed(2),
  ]));
  const exportGreenInvoicesList = () => exportToCSV("green-order-invoices", ["Order", "Buyer", "Date", "Total (USD)"], filteredGreenOrders.map((o) => [
    o.id, o.company || o.name, o.date, (o.totalCents / 100).toFixed(2),
  ]));
  const exportServiceInvoicesList = () => exportToCSV("consultation-invoices", ["Client", "Service", "Date", "Agreed Fee (USD)"], filteredServiceInquiries.map((s) => [
    s.company || s.name, s.interest, s.date, s.agreedFeeCents ? (s.agreedFeeCents / 100).toFixed(2) : "",
  ]));

  return (
    <div>
      <h3 className="matched-head">Invoices</h3>
      <p className="hint" style={{ marginTop: -6 }}>Generates a real, downloadable PDF invoice from live data. Customer order invoices reflect the price actually charged at order time; consultation invoices use the agreed fee entered below.</p>

      <h4 className="admin-subhead">Customer orders ({filteredOrders.length}{orderQuery ? ` of ${orders.length}` : ""})</h4>
      {orders.length > 0 && <AdminTableToolbar query={orderQuery} setQuery={setOrderQuery} onExport={exportOrderInvoicesList} placeholder="Search by order or customer…" />}
      {orders.length === 0 ? (
        <p className="hint">No orders yet.</p>
      ) : filteredOrders.length === 0 ? (
        <p className="hint">No orders match "{orderQuery}".</p>
      ) : (
        <div className="admin-table admin-table-invoices">
          <div className="admin-row admin-header"><span>Order</span><span>Customer</span><span>Date</span><span>Total</span><span></span></div>
          {filteredOrders.map((o) => (
            <div key={o.id} className="admin-row">
              <span>{o.orderNumber}</span><span>{o.customerEmail}</span><span>{o.createdAt.slice(0, 10)}</span><span>{fmtPrice(o.totalCents)}</span>
              <span><button className="link-btn" onClick={() => downloadOrderInvoice(o)}>Download PDF</button></span>
            </div>
          ))}
        </div>
      )}

      <h4 className="admin-subhead">Green coffee wholesale orders ({filteredGreenOrders.length}{greenQuery ? ` of ${greenOrders.length}` : ""})</h4>
      {greenOrders.length > 0 && <AdminTableToolbar query={greenQuery} setQuery={setGreenQuery} onExport={exportGreenInvoicesList} placeholder="Search by order, buyer, or lot…" />}
      {greenOrders.length === 0 ? (
        <p className="hint">No wholesale orders yet.</p>
      ) : filteredGreenOrders.length === 0 ? (
        <p className="hint">No orders match "{greenQuery}".</p>
      ) : (
        <div className="admin-table admin-table-invoices">
          <div className="admin-row admin-header"><span>Order</span><span>Buyer</span><span>Date</span><span>Total</span><span></span></div>
          {filteredGreenOrders.map((o) => (
            <div key={o.id} className="admin-row">
              <span>{o.id}</span><span>{o.company || o.name}</span><span>{o.date}</span><span>{fmtPrice(o.totalCents)}</span>
              <span><button className="link-btn" onClick={() => downloadGreenInvoice(o)}>Download PDF</button></span>
            </div>
          ))}
        </div>
      )}

      <h4 className="admin-subhead">Consultations ({filteredServiceInquiries.length}{serviceQuery ? ` of ${serviceInquiries.length}` : ""})</h4>
      <p className="hint" style={{ marginTop: -6 }}>Consulting fees are individually quoted — enter the agreed amount before downloading.</p>
      {serviceInquiries.length > 0 && <AdminTableToolbar query={serviceQuery} setQuery={setServiceQuery} onExport={exportServiceInvoicesList} placeholder="Search by client or service…" />}
      {serviceInquiries.length === 0 ? (
        <p className="hint">No service inquiries yet.</p>
      ) : filteredServiceInquiries.length === 0 ? (
        <p className="hint">No consultations match "{serviceQuery}".</p>
      ) : (
        <div className="admin-table admin-table-invoices-service">
          <div className="admin-row admin-header"><span>Client</span><span>Service</span><span>Date</span><span>Fee (USD)</span><span></span></div>
          {filteredServiceInquiries.map((s) => (
            <div key={s.id} className="admin-row">
              <span>{s.company || s.name}</span><span>{s.interest}</span><span>{s.date}</span>
              <span>
                <input
                  className="admin-price-input"
                  placeholder="0.00"
                  value={feeDraftFor(s)}
                  onChange={(e) => setFeeDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  onBlur={() => commitFee(s)}
                  inputMode="decimal"
                />
              </span>
              <span><button className="link-btn" onClick={() => downloadServiceInvoice(s)}>Download PDF</button></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STAFF_PERMISSIONS = ADMIN_SECTIONS.filter((s) => s !== "Overview");

export function AdminCustomers() {
  const { token } = useAuth();
  const { realUsers: users, realUsersLoading: loading, realUsersError: loadError, refetchRealUsers, realOrders } = useAdmin();
  const { addToast } = useToast();
  const [query, setQuery] = useState("");
  const [editingPermsFor, setEditingPermsFor] = useState(null);
  const [viewingOrdersFor, setViewingOrdersFor] = useState(null);
  const [pendingId, setPendingId] = useState(null); // which row's PATCH is currently in flight, to disable its own buttons and prevent a double-submit

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });
  const { page, setPage, pageItems, totalPages } = usePagination(filtered, 10);
  const exportCustomers = () => exportToCSV("customers", ["Name", "Email", "Role", "Permissions"], filtered.map((u) => [u.name, u.email, u.role, (u.permissions || []).join("; ")]));

  // Every role/permission change goes through this -- re-fetches the shared realUsers list on
  // success (rather than optimistically patching local state) specifically so Overview and
  // Analytics, which read the exact same centralized list, never show a stale customer count or
  // signup chart relative to what Customers just changed. Surfaces the real backend error on
  // failure instead of pretending it worked -- concretely, the backend refuses to demote the last
  // remaining admin, and that specific, helpful message needs to actually reach the person who
  // clicked the button, not get swallowed.
  const updateUser = async (u, updates, successMessage) => {
    setPendingId(u.id);
    try {
      await api.updateUser(token, u.id, updates);
      refetchRealUsers();
      if (successMessage) addToast(successMessage);
    } catch (e) {
      addToast(e.message);
    } finally {
      setPendingId(null);
    }
  };

  const togglePermission = (u, section) => {
    const current = u.permissions || [];
    const next = current.includes(section) ? current.filter((s) => s !== section) : [...current, section];
    updateUser(u, { permissions: next });
  };

  if (loading) return <p className="hint">Loading customers…</p>;
  if (loadError) {
    return (
      <div>
        <p className="form-error">Couldn't load customers: {loadError}</p>
        <button className="btn-outline" onClick={refetchRealUsers}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="matched-head">Customers ({filtered.length}{query ? ` of ${users.length}` : ""})</h3>
      <AdminTableToolbar query={query} setQuery={setQuery} onExport={users.length > 0 ? exportCustomers : null} placeholder="Search by name, email, or role…" />
      {filtered.length === 0 ? (
        <p className="hint">{query ? `No customers match "${query}".` : "No customers yet."}</p>
      ) : (
        <div className="admin-table">
          <div className="admin-row admin-header">
            <span>Name</span><span>Email</span><span>Role</span><span>Actions</span>
          </div>
          {pageItems.map((u) => (
            <React.Fragment key={u.id}>
              <div className="admin-row">
                <span>{u.name}</span>
                <span>{u.email}</span>
                <span className={`role-badge ${u.role}`}>{u.role.replace("_", " ")}{u.role === "staff" ? ` (${(u.permissions || []).length})` : ""}</span>
                <span className="admin-inline-edit">
                  <button className="link-btn" onClick={() => setViewingOrdersFor(viewingOrdersFor === u.email ? null : u.email)}>
                    {viewingOrdersFor === u.email ? "Hide orders" : "View orders"}
                  </button>
                  {u.role === "super_admin" ? (
                    <button className="link-btn" disabled={pendingId === u.id} onClick={() => updateUser(u, { role: "customer" }, `${u.name} is no longer an admin`)}>Revoke admin</button>
                  ) : u.role === "staff" ? (
                    <>
                      <button className="link-btn" disabled={pendingId === u.id} onClick={() => setEditingPermsFor(editingPermsFor === u.email ? null : u.email)}>Edit access</button>
                      <button className="link-btn" disabled={pendingId === u.id} onClick={() => updateUser(u, { role: "customer" }, `${u.name} is no longer staff`)}>Revoke staff</button>
                    </>
                  ) : (
                    <>
                      <button className="link-btn" disabled={pendingId === u.id} onClick={() => { updateUser(u, { role: "staff", permissions: [] }); setEditingPermsFor(u.email); }}>Make staff</button>
                      <button className="link-btn" disabled={pendingId === u.id} onClick={() => updateUser(u, { role: "super_admin" }, `${u.name} is now an admin`)}>Make admin</button>
                    </>
                  )}
                </span>
              </div>
              {editingPermsFor === u.email && u.role === "staff" && (
                <div className="admin-permissions-row">
                  <p className="hint" style={{ margin: "0 0 8px" }}>{u.name} can access these sections (plus Overview, always included):</p>
                  <div className="admin-tag-checks">
                    {STAFF_PERMISSIONS.map((section) => (
                      <label key={section} className={`chip ${(u.permissions || []).includes(section) ? "chip-active" : ""}`}>
                        <input type="checkbox" checked={(u.permissions || []).includes(section)} onChange={() => togglePermission(u, section)} className="visually-hidden" />
                        {section}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {viewingOrdersFor === u.email && (
                <div className="admin-permissions-row">
                  {(() => {
                    const custOrders = realOrders.filter((o) => o.customerEmail === u.email);
                    if (custOrders.length === 0) return <p className="hint" style={{ margin: 0 }}>{u.name} hasn't placed any orders yet.</p>;
                    const lifetimeCents = custOrders.reduce((sum, o) => sum + o.totalCents, 0);
                    return (
                      <>
                        <p className="hint" style={{ margin: "0 0 8px" }}>{custOrders.length} order{custOrders.length === 1 ? "" : "s"} · {fmtPrice(lifetimeCents)} lifetime</p>
                        {custOrders.map((o) => (
                          <p key={o.id} className="hint" style={{ margin: "4px 0" }}>
                            <strong>{o.orderNumber}</strong> · {o.createdAt.slice(0, 10)} · {o.items.reduce((s, it) => s + it.qty, 0)} items · {fmtPrice(o.totalCents)} · {o.status}
                          </p>
                        ))}
                      </>
                    );
                  })()}
                </div>
              )}
            </React.Fragment>
          ))}
          <AdminPager page={page} setPage={setPage} totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}

const BODY_RATING = { light: 3, medium: 5, full: 7 };
const ACIDITY_RATING = { low: 3, medium: 5, high: 8 };
const emptyProductForm = { name: "", country: COUNTRIES[0].name, tier: "everyday", price: "", stock: "", note: "", growing: "", aroma: [], body: "light", acidity: "medium", roast: "light", brew: [] };

export function AdminProducts() {
  const { getPrice, setPrice, getTier, getStock, setStock, getAllProducts, addProduct, removeProduct, setProductPhoto, updateProductDetails, realProductsLoading: loading, realProductsError: loadError, refetchRealProducts } = useAdmin();
  const { addToast } = useToast();
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [editingStock, setEditingStock] = useState(null);
  const [stockDraft, setStockDraft] = useState("");
  const [query, setQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  // Holds the full real product row being edited, not just its id -- needed so submitEditProduct
  // can safely preserve fields the edit form has no direct control over (tags.moment, profile,
  // brewGuide, momentMatch, course), rather than silently blanking them the way a from-scratch
  // reconstruction (matching how the "add new product" flow already builds these) would.
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyProductForm);
  const [formError, setFormError] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState(null);
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState(null);
  const [sharingFor, setSharingFor] = useState(null);

  const allProducts = getAllProducts();
  const filtered = allProducts.filter((p) => {
    const q = query.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q) || getTier(p.id).includes(q);
  });

  const startEdit = (p) => { setEditing(p.id); setDraft((getPrice(p.id) / 100).toFixed(2)); };
  const save = async (id) => {
    const cents = Math.round(parseFloat(draft) * 100);
    if (!isNaN(cents) && cents > 0) {
      const result = await setPrice(id, cents);
      addToast(result.ok ? "Price updated" : result.error);
    }
    setEditing(null);
  };

  const startStockEdit = (p) => { setEditingStock(p.id); setStockDraft(String(getStock(p.id))); };
  const saveStock = async (id) => {
    const qty = parseInt(stockDraft, 10);
    if (!isNaN(qty)) {
      const result = await setStock(id, qty);
      addToast(result.ok ? "Stock updated" : result.error);
    }
    setEditingStock(null);
  };

  const toggleFormTag = (key, tag) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(tag) ? f[key].filter((t) => t !== tag) : [...f[key], tag] }));

  const handleNewProductPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoUploadError("");
    try {
      const dataUrl = await resizeImageFile(file);
      setFormPhotoUrl(dataUrl);
    } catch (err) {
      setPhotoUploadError(err.message);
    }
  };

  const handleExistingPhotoChange = async (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhotoFor(id);
    try {
      const dataUrl = await resizeImageFile(file);
      const result = await setProductPhoto(id, dataUrl);
      addToast(result.ok ? "Photo updated" : result.error);
    } catch (err) {
      addToast(err.message);
    }
    setUploadingPhotoFor(null);
  };

  const submitNewProduct = async (e) => {
    e.preventDefault();
    setFormError("");
    const priceCents = Math.round(parseFloat(form.price) * 100);
    const stock = parseInt(form.stock, 10);
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (isNaN(priceCents) || priceCents <= 0) { setFormError("Enter a valid price."); return; }
    if (isNaN(stock) || stock < 0) { setFormError("Enter a valid stock quantity."); return; }
    if (form.aroma.length === 0) { setFormError("Select at least one aroma tag."); return; }
    if (form.brew.length === 0) { setFormError("Select at least one brew method."); return; }

    const result = await addProduct({
      name: form.name.trim(), country: form.country, tier: form.tier,
      priceCents, stock,
      note: form.note.trim() || "A new addition to the catalog.",
      growing: form.growing.trim() || `Sourced from ${form.country}.`,
      tags: { aroma: form.aroma, body: form.body, acidity: form.acidity, roast: form.roast, moment: "", brew: form.brew },
      profile: { aroma: 6, body: BODY_RATING[form.body], acidity: ACIDITY_RATING[form.acidity], sweetness: 6, finish: 6 },
      brewGuide: form.brew[0], momentMatch: "", course: "Home Brewing",
      photoUrl: formPhotoUrl || undefined,
    });
    if (result.error) { setFormError(result.error); return; }
    addToast(`${form.name} added to the catalog`);
    setFormPhotoUrl(null);
    setForm(emptyProductForm);
    setShowAddForm(false);
  };

  // Opens the same rich form used for "+ Add new product", pre-filled with this product's real
  // current values -- previously the only editable fields on an existing product were price,
  // stock, and photo; there was no way to fix a typo in the name, correct the country, or move a
  // product between tiers without discontinuing it and starting over from scratch.
  const startEditDetails = (p) => {
    setShowAddForm(false);
    setEditingProduct(p);
    setForm({
      name: p.name,
      country: p.country,
      tier: getTier(p.id),
      price: (getPrice(p.id) / 100).toFixed(2),
      stock: String(getStock(p.id)),
      note: p.note || "",
      growing: p.growing || "",
      aroma: (p.tags && p.tags.aroma) || [],
      body: (p.tags && p.tags.body) || "light",
      acidity: (p.tags && p.tags.acidity) || "medium",
      roast: (p.tags && p.tags.roast) || "light",
      brew: (p.tags && p.tags.brew) || [],
    });
    setFormPhotoUrl(null); // a fresh upload slot -- leaving this untouched keeps the existing real photo, only replaced if the admin deliberately picks a new one
    setPhotoUploadError("");
    setFormError("");
  };

  const cancelEditDetails = () => {
    setEditingProduct(null);
    setForm(emptyProductForm);
    setFormPhotoUrl(null);
    setFormError("");
  };

  const submitEditProduct = async (e) => {
    e.preventDefault();
    setFormError("");
    const priceCents = Math.round(parseFloat(form.price) * 100);
    const stock = parseInt(form.stock, 10);
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (isNaN(priceCents) || priceCents <= 0) { setFormError("Enter a valid price."); return; }
    if (isNaN(stock) || stock < 0) { setFormError("Enter a valid stock quantity."); return; }
    if (form.aroma.length === 0) { setFormError("Select at least one aroma tag."); return; }
    if (form.brew.length === 0) { setFormError("Select at least one brew method."); return; }

    // Deliberately does NOT touch profile, brewGuide, momentMatch, or course -- this form has no
    // real control over any of them (same true of the "add" form above; a from-scratch rebuild
    // there is fine since a new product has no prior curated data to lose, but doing the same on
    // an EDIT would silently blank out real, hand-tuned values on an existing product just from
    // fixing an unrelated typo). tags is spread from the existing product first, then only the
    // fields this form genuinely controls are overridden, preserving tags.moment either way.
    const patch = {
      name: form.name.trim(), country: form.country, tier: form.tier,
      priceCents, stock,
      note: form.note.trim() || editingProduct.note,
      growing: form.growing.trim() || editingProduct.growing,
      tags: { ...editingProduct.tags, aroma: form.aroma, body: form.body, acidity: form.acidity, roast: form.roast, brew: form.brew },
    };
    if (formPhotoUrl) patch.photoUrl = formPhotoUrl; // only sent if a genuinely new photo was chosen

    const result = await updateProductDetails(editingProduct.id, patch);
    if (!result.ok) { setFormError(result.error); return; }
    addToast(`${form.name} updated`);
    cancelEditDetails();
  };

  // No more "Custom" column -- once every product is a real, uniform database row, there's no
  // longer a meaningful distinction between the original 9 and anything admin has added since,
  // the way there was when the original 9 came from static frontend data and admin additions were
  // a separate in-memory list layered on top.
  const exportProducts = () => exportToCSV("products", ["Name", "Country", "Tier", "Price (USD)", "Stock"], filtered.map((p) => [
    p.name, p.country, getTier(p.id), (getPrice(p.id) / 100).toFixed(2), getStock(p.id),
  ]));

  if (loading) return <p className="hint">Loading products…</p>;
  if (loadError) {
    return (
      <div>
        <p className="form-error">Couldn't load products: {loadError}</p>
        <button className="btn-outline" onClick={refetchRealProducts}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="matched-head">Product catalog ({filtered.length}{query ? ` of ${allProducts.length}` : ""})</h3>
      <AdminTableToolbar query={query} setQuery={setQuery} onExport={exportProducts} placeholder="Search by name, country, or tier…" />
      <button className="btn-outline small" style={{ marginBottom: 14 }} onClick={() => { setShowAddForm((v) => !v); cancelEditDetails(); }}>
        {showAddForm ? "Cancel" : "+ Add new product"}
      </button>

      {(showAddForm || editingProduct) && (
        <form className="admin-add-form" onSubmit={editingProduct ? submitEditProduct : submitNewProduct}>
          {editingProduct && <p className="eyebrow" style={{ marginTop: 0 }}>Editing {editingProduct.name}</p>}
          <div className="admin-form-grid">
            <div>
              <label className="filter-label" htmlFor="np-name">Name</label>
              <input id="np-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="e.g. Bourbon Pointu" />
            </div>
            <div>
              <label className="filter-label" htmlFor="np-country">Country</label>
              <select id="np-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                {COUNTRIES.map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}
              </select>
            </div>
            <div>
              <label className="filter-label" htmlFor="np-tier">Tier</label>
              <select id="np-tier" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
                <option value="everyday">Everyday</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <label className="filter-label" htmlFor="np-price">Price (USD)</label>
              <input id="np-price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} inputMode="decimal" placeholder="24.00" />
            </div>
            <div>
              <label className="filter-label" htmlFor="np-stock">Stock (units)</label>
              <input id="np-stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} inputMode="numeric" placeholder="60" />
            </div>
            <div>
              <label className="filter-label" htmlFor="np-body">Body</label>
              <select id="np-body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}>
                {FILTER_DEFS.body.map((b) => (<option key={b} value={b}>{b}</option>))}
              </select>
            </div>
            <div>
              <label className="filter-label" htmlFor="np-acidity">Acidity</label>
              <select id="np-acidity" value={form.acidity} onChange={(e) => setForm({ ...form, acidity: e.target.value })}>
                {FILTER_DEFS.acidity.map((a) => (<option key={a} value={a}>{a}</option>))}
              </select>
            </div>
            <div>
              <label className="filter-label" htmlFor="np-roast">Roast</label>
              <select id="np-roast" value={form.roast} onChange={(e) => setForm({ ...form, roast: e.target.value })}>
                {FILTER_DEFS.roast.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
          </div>

          <label className="filter-label" style={{ marginTop: 14 }}>Aroma tags (select at least one)</label>
          <div className="admin-tag-checks">
            {FILTER_DEFS.aroma.map((tag) => (
              <label key={tag} className={`chip ${form.aroma.includes(tag) ? "chip-active" : ""}`}>
                <input type="checkbox" checked={form.aroma.includes(tag)} onChange={() => toggleFormTag("aroma", tag)} className="visually-hidden" />
                {tag}
              </label>
            ))}
          </div>

          <label className="filter-label" style={{ marginTop: 14 }}>Brew methods (select at least one)</label>
          <div className="admin-tag-checks">
            {FILTER_DEFS.brew.map((tag) => (
              <label key={tag} className={`chip ${form.brew.includes(tag) ? "chip-active" : ""}`}>
                <input type="checkbox" checked={form.brew.includes(tag)} onChange={() => toggleFormTag("brew", tag)} className="visually-hidden" />
                {tag}
              </label>
            ))}
          </div>

          <label className="filter-label" htmlFor="np-note" style={{ marginTop: 14 }}>Tasting note (optional)</label>
          <input id="np-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={100} placeholder="e.g. Dark chocolate, cherry, long finish" />

          <label className="filter-label" htmlFor="np-growing" style={{ marginTop: 14 }}>Growing description (optional)</label>
          <textarea id="np-growing" value={form.growing} onChange={(e) => setForm({ ...form, growing: e.target.value })} rows={2} maxLength={300} placeholder="Altitude, soil, process…" />

          <label className="filter-label" htmlFor="np-photo" style={{ marginTop: 14 }}>Product photo {editingProduct ? "(leave blank to keep the current one)" : "(optional)"}</label>
          <div className="admin-photo-upload-row">
            {formPhotoUrl ? (
              <img src={formPhotoUrl} alt="" className="admin-photo-preview" />
            ) : editingProduct && editingProduct.photoUrl ? (
              <img src={editingProduct.photoUrl} alt="" className="admin-photo-preview" />
            ) : null}
            <div>
              <input id="np-photo" type="file" accept="image/*" onChange={handleNewProductPhoto} />
              {!editingProduct && <p className="hint" style={{ marginTop: 4 }}>Without one, the product shows its origin's landscape photo instead.</p>}
              {photoUploadError && <p className="form-error">{photoUploadError}</p>}
            </div>
          </div>

          {formError && <p className="form-error">{formError}</p>}
          {!editingProduct && <p className="hint" style={{ marginTop: 8 }}>Appears immediately on Shop, its own product page, and can be added to cart — but not on Home's featured tiers or Moments/Brew Guides suggestions, which stay curated.</p>}
          <button className="btn-primary" type="submit" style={{ marginTop: 10 }}>{editingProduct ? "Save changes" : "Add product"}</button>
          {editingProduct && <button type="button" className="link-btn" onClick={cancelEditDetails}>Cancel</button>}
        </form>
      )}

      <div className="admin-table admin-table-products admin-table-products-stock">
        <div className="admin-row admin-header">
          <span>Variety</span><span>Country</span><span>Tier</span><span>Price</span><span>Stock</span><span></span>
        </div>
        {filtered.map((p) => {
          const stock = getStock(p.id);
          return (
            <React.Fragment key={p.id}>
            <div className="admin-row">
              <span>{p.name}</span>
              <span>{p.country}</span>
              <span className={`role-badge ${getTier(p.id)}`}>{getTier(p.id)}</span>
              {editing === p.id ? (
                <span>
                  <input className="admin-price-input" value={draft} onChange={(e) => setDraft(e.target.value)} inputMode="decimal" />
                </span>
              ) : (
                <span>{fmtPrice(getPrice(p.id))}</span>
              )}
              {editingStock === p.id ? (
                <span>
                  <input className="admin-price-input" value={stockDraft} onChange={(e) => setStockDraft(e.target.value)} inputMode="numeric" />
                </span>
              ) : (
                <span className={stock === 0 ? "stock-badge out" : stock <= 8 ? "stock-badge low" : "stock-badge"}>
                  {stock === 0 ? "Sold out" : `${stock} units`}
                </span>
              )}
              <span>
                {editing === p.id ? (
                  <>
                    <button className="link-btn" onClick={() => save(p.id)}>Save</button>
                    <button className="link-btn" onClick={() => setEditing(null)}>Cancel</button>
                  </>
                ) : editingStock === p.id ? (
                  <>
                    <button className="link-btn" onClick={() => saveStock(p.id)}>Save</button>
                    <button className="link-btn" onClick={() => setEditingStock(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="link-btn" onClick={() => startEdit(p)}>Edit price</button>
                    <button className="link-btn" onClick={() => startStockEdit(p)}>Edit stock</button>
                    <button className="link-btn" onClick={() => startEditDetails(p)}>Edit details</button>
                    <label className="link-btn admin-photo-label">
                      {uploadingPhotoFor === p.id ? "Uploading…" : "Change photo"}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleExistingPhotoChange(p.id, e)} disabled={uploadingPhotoFor === p.id} />
                    </label>
                    <button className="link-btn" onClick={() => setSharingFor(sharingFor === p.id ? null : p.id)}>Share</button>
                    <button className="link-btn" onClick={() => { if (window.confirm(`Discontinue ${p.name}? It will disappear from Shop but stay visible in past orders.`)) { removeProduct(p.id).then((result) => addToast(result.ok ? `${p.name} discontinued` : result.error)); } }}>Discontinue</button>
                  </>
                )}
              </span>
            </div>
            {sharingFor === p.id && (
              <div className="admin-permissions-row">
                <ShareButtons path={`/product/${p.id}`} text={`${p.name} — ${p.country}. ${p.note} Morning Aroma:`} label="Announce this product:" />
              </div>
            )}
            </React.Fragment>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 14 }}>Price and stock changes apply live across the storefront — shop, product pages, cart, and checkout.</p>
    </div>
  );
}

const emptyGreenForm = { name: "", country: COUNTRIES[0].name, price: "", stock: "", minOrder: "5", cuppingScore: "84", process: "Washed", notes: "" };

export function AdminInventory() {
  const {
    getStock, setStock, getPrice, getGreenPrice, getAllProducts, getAllGreenBeans, removeProduct, removeGreenBean, addGreenBean,
    realProductsLoading, realProductsError, refetchRealProducts,
    realGreenBeansLoading, realGreenBeansError, refetchRealGreenBeans,
  } = useAdmin();
  const { addToast } = useToast();
  const [editingStock, setEditingStock] = useState(null);
  const [stockDraft, setStockDraft] = useState("");
  const [query, setQuery] = useState("");
  const [showGreenForm, setShowGreenForm] = useState(false);
  const [greenForm, setGreenForm] = useState(emptyGreenForm);
  const [greenFormError, setGreenFormError] = useState("");

  const startStockEdit = (id, current) => { setEditingStock(id); setStockDraft(String(current)); };
  const saveStock = async (id) => {
    const qty = parseInt(stockDraft, 10);
    if (!isNaN(qty)) {
      const result = await setStock(id, qty);
      addToast(result.ok ? "Stock updated" : result.error);
    }
    setEditingStock(null);
  };

  // This component shows both retail products and green beans together, so it genuinely depends
  // on both real data sources being ready -- guarding on only one would let it render with the
  // other still loading (an incomplete list) or having failed (a masked error).
  if (realProductsLoading || realGreenBeansLoading) return <p className="hint">Loading inventory…</p>;
  if (realProductsError || realGreenBeansError) {
    return (
      <div>
        <p className="form-error">Couldn't load inventory: {realProductsError || realGreenBeansError}</p>
        <button className="btn-outline" onClick={() => { refetchRealProducts(); refetchRealGreenBeans(); }}>Try again</button>
      </div>
    );
  }

  const allProducts = getAllProducts();
  const allGreenBeans = getAllGreenBeans();
  const q = query.toLowerCase();
  const products = allProducts.filter((p) => !q || p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q));
  const greenBeans = allGreenBeans.filter((g) => !q || g.name.toLowerCase().includes(q) || g.country.toLowerCase().includes(q));

  const roastedLowCount = allProducts.filter((p) => getStock(p.id) <= 8).length;
  const greenLowCount = allGreenBeans.filter((g) => getStock(g.id) < 100).length;
  const roastedValueCents = allProducts.reduce((sum, p) => sum + getStock(p.id) * getPrice(p.id), 0);
  const greenValueCents = allGreenBeans.reduce((sum, g) => sum + getStock(g.id) * getGreenPrice(g.id), 0);

  const exportInventory = () => exportToCSV("inventory", ["Type", "Name", "Country", "Stock", "Unit"], [
    ...products.map((p) => ["Roasted", p.name, p.country, getStock(p.id), "bags"]),
    ...greenBeans.map((g) => ["Green", g.name, g.country, getStock(g.id), "kg"]),
  ]);

  const submitGreenLot = async (e) => {
    e.preventDefault();
    setGreenFormError("");
    const pricePerKgCents = Math.round(parseFloat(greenForm.price) * 100);
    const stockKg = parseInt(greenForm.stock, 10);
    const minOrderKg = parseInt(greenForm.minOrder, 10);
    const cuppingScore = parseInt(greenForm.cuppingScore, 10);
    if (!greenForm.name.trim()) { setGreenFormError("Name is required."); return; }
    if (isNaN(pricePerKgCents) || pricePerKgCents <= 0) { setGreenFormError("Enter a valid price per kg."); return; }
    if (isNaN(stockKg) || stockKg < 0) { setGreenFormError("Enter a valid stock quantity."); return; }
    if (isNaN(minOrderKg) || minOrderKg <= 0) { setGreenFormError("Enter a valid minimum order quantity."); return; }
    if (minOrderKg > stockKg) { setGreenFormError("Minimum order can't exceed available stock."); return; }

    const result = await addGreenBean({
      name: greenForm.name.trim(), country: greenForm.country,
      pricePerKgCents, stockKg, minOrderKg,
      cuppingScore: isNaN(cuppingScore) ? 82 : cuppingScore,
      moisture: "11.0%", grade: "—", process: greenForm.process,
      notes: greenForm.notes.trim() || `A new green lot from ${greenForm.country}.`,
    });
    if (result.error) { setGreenFormError(result.error); return; }
    addToast(`${greenForm.name} added to the green coffee catalog`);
    setGreenForm(emptyGreenForm);
    setShowGreenForm(false);
  };

  const StockCell = ({ id, unit }) => {
    const current = getStock(id);
    return editingStock === id ? (
      <span className="admin-inline-edit">
        <input className="admin-price-input" value={stockDraft} onChange={(e) => setStockDraft(e.target.value)} inputMode="numeric" />
        <button className="link-btn" onClick={() => saveStock(id)}>Save</button>
      </span>
    ) : (
      <span onClick={() => startStockEdit(id, current)} style={{ cursor: "pointer" }} title="Click to edit">
        {current}{unit} {current === 0 && <span className="role-badge admin-badge-sold-out">sold out</span>}
      </span>
    );
  };

  return (
    <div>
      <h3 className="matched-head">Inventory — roasted &amp; green coffee</h3>
      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <p className="admin-stat-label">Roasted stock value</p>
          <p className="admin-stat-value">{fmtPrice(roastedValueCents)}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Green stock value</p>
          <p className="admin-stat-value">{fmtPrice(greenValueCents)}</p>
        </div>
        <div className={`admin-stat-card ${roastedLowCount + greenLowCount > 0 ? "admin-stat-alert" : ""}`}>
          <p className="admin-stat-label">Low-stock lots</p>
          <p className="admin-stat-value">{roastedLowCount + greenLowCount}</p>
        </div>
      </div>
      <AdminTableToolbar query={query} setQuery={setQuery} onExport={exportInventory} placeholder="Search by name or country…" />

      <h4 className="admin-subhead">Roasted coffee (retail bags) — {products.length}{query ? ` of ${allProducts.length}` : ""}</h4>
      <div className="admin-table admin-table-inventory">
        <div className="admin-row admin-header">
          <span>Variety</span><span>Country</span><span>Stock</span><span>Status</span>
        </div>
        {products.map((p) => {
          const stock = getStock(p.id);
          return (
            <div key={p.id} className="admin-row">
              <span>{p.name}</span>
              <span>{p.country}</span>
              <span><StockCell id={p.id} unit=" bags" /></span>
              <span className="admin-inline-edit">
                <span className={stock === 0 ? "inv-status out" : stock <= 8 ? "inv-status low" : "inv-status ok"}>
                  {stock === 0 ? "Sold out" : stock <= 8 ? "Low" : "In stock"}
                </span>
                <button className="link-btn" onClick={() => { if (window.confirm(`Discontinue ${p.name}?`)) { removeProduct(p.id).then((result) => addToast(result.ok ? `${p.name} discontinued` : result.error)); } }}>Discontinue</button>
              </span>
            </div>
          );
        })}
      </div>

      <h4 className="admin-subhead">Green coffee (wholesale, by the kg) — {greenBeans.length}{query ? ` of ${allGreenBeans.length}` : ""}</h4>
      <button className="btn-outline small" style={{ marginBottom: 14 }} onClick={() => setShowGreenForm((v) => !v)}>
        {showGreenForm ? "Cancel" : "+ Add green lot"}
      </button>
      {showGreenForm && (
        <form className="admin-add-form" onSubmit={submitGreenLot}>
          <div className="admin-form-grid">
            <div>
              <label className="filter-label" htmlFor="ng-name">Name</label>
              <input id="ng-name" value={greenForm.name} onChange={(e) => setGreenForm({ ...greenForm, name: e.target.value })} maxLength={60} placeholder="e.g. Green Peru — Cajamarca" />
            </div>
            <div>
              <label className="filter-label" htmlFor="ng-country">Country</label>
              <select id="ng-country" value={greenForm.country} onChange={(e) => setGreenForm({ ...greenForm, country: e.target.value })}>
                {COUNTRIES.map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}
              </select>
            </div>
            <div>
              <label className="filter-label" htmlFor="ng-price">Price per kg (USD)</label>
              <input id="ng-price" value={greenForm.price} onChange={(e) => setGreenForm({ ...greenForm, price: e.target.value })} inputMode="decimal" placeholder="7.50" />
            </div>
            <div>
              <label className="filter-label" htmlFor="ng-stock">Stock (kg)</label>
              <input id="ng-stock" value={greenForm.stock} onChange={(e) => setGreenForm({ ...greenForm, stock: e.target.value })} inputMode="numeric" placeholder="200" />
            </div>
            <div>
              <label className="filter-label" htmlFor="ng-minorder">Minimum order (kg)</label>
              <input id="ng-minorder" value={greenForm.minOrder} onChange={(e) => setGreenForm({ ...greenForm, minOrder: e.target.value })} inputMode="numeric" />
            </div>
            <div>
              <label className="filter-label" htmlFor="ng-cupping">Cupping score</label>
              <input id="ng-cupping" value={greenForm.cuppingScore} onChange={(e) => setGreenForm({ ...greenForm, cuppingScore: e.target.value })} inputMode="numeric" placeholder="84" />
            </div>
            <div>
              <label className="filter-label" htmlFor="ng-process">Process</label>
              <select id="ng-process" value={greenForm.process} onChange={(e) => setGreenForm({ ...greenForm, process: e.target.value })}>
                <option>Washed</option>
                <option>Natural</option>
                <option>Honey</option>
              </select>
            </div>
          </div>
          <label className="filter-label" htmlFor="ng-notes" style={{ marginTop: 14 }}>Notes (optional)</label>
          <textarea id="ng-notes" value={greenForm.notes} onChange={(e) => setGreenForm({ ...greenForm, notes: e.target.value })} rows={2} maxLength={300} />
          {greenFormError && <p className="form-error">{greenFormError}</p>}
          <p className="hint" style={{ marginTop: 8 }}>Appears immediately on the public Green Coffee page, ready to order.</p>
          <button className="btn-primary" type="submit" style={{ marginTop: 10 }}>Add green lot</button>
        </form>
      )}
      <div className="admin-table admin-table-inventory">
        <div className="admin-row admin-header">
          <span>Lot</span><span>Country</span><span>Stock</span><span>Status</span>
        </div>
        {greenBeans.map((g) => {
          const stock = getStock(g.id);
          return (
            <div key={g.id} className="admin-row">
              <span>{g.name}</span>
              <span>{g.country}</span>
              <span><StockCell id={g.id} unit="kg" /></span>
              <span className="admin-inline-edit">
                <span className={stock === 0 ? "inv-status out" : stock < 100 ? "inv-status low" : "inv-status ok"}>
                  {stock === 0 ? "Sold out" : stock < 100 ? "Low" : "In stock"}
                </span>
                <button className="link-btn" onClick={() => { if (window.confirm(`Discontinue ${g.name}?`)) { removeGreenBean(g.id).then((result) => addToast(result.ok ? `${g.name} discontinued` : result.error)); } }}>Discontinue</button>
              </span>
            </div>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 14 }}>Click any stock number to edit it directly — changes apply live across the storefront and Green Coffee page.</p>
    </div>

  );
}

export function AdminQuotations() {
  const { quotations, updateQuotationStatus } = useAdmin();
  const { addToast } = useToast();
  const STATUSES = ["New", "Contacted", "Closed"];
  return (
    <div>
      <h3 className="matched-head">Quotation requests ({quotations.length})</h3>
      {quotations.length === 0 ? (
        <p className="hint">No quotation requests yet — they'll appear here when the footer form is submitted.</p>
      ) : (
        <div className="admin-card-list">
          {quotations.map((q) => (
            <div key={q.id} className="admin-card">
              <div className="admin-card-head">
                <strong>{q.name}</strong>
                <select value={q.status} onChange={(e) => { updateQuotationStatus(q.id, e.target.value); addToast(`Marked ${e.target.value}`); }}>
                  {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <p className="hint">{q.email} · {q.date}</p>
              <p>{q.variety}{q.quantity ? ` — ${q.quantity}` : ""}</p>
              {q.message && <p className="journal-note">"{q.message}"</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminServiceInquiries() {
  const { serviceInquiries, updateServiceInquiryStatus } = useAdmin();
  const { addToast } = useToast();
  const STATUSES = ["New", "Discovery Call Booked", "In Progress", "Closed"];
  return (
    <div>
      <h3 className="matched-head">Service inquiries ({serviceInquiries.length})</h3>
      {serviceInquiries.length === 0 ? (
        <p className="hint">No service inquiries yet — they'll appear here when the Our Services form is submitted.</p>
      ) : (
        <div className="admin-card-list">
          {serviceInquiries.map((s) => (
            <div key={s.id} className="admin-card">
              <div className="admin-card-head">
                <strong>{s.name}{s.company ? ` — ${s.company}` : ""}</strong>
                <select value={s.status} onChange={(e) => { updateServiceInquiryStatus(s.id, e.target.value); addToast(`Marked ${e.target.value}`); }}>
                  {STATUSES.map((st) => (<option key={st} value={st}>{st}</option>))}
                </select>
              </div>
              <p className="hint">{s.email} · {s.date}</p>
              <p><span className="chip chip-active">{s.interest}</span></p>
              {s.message && <p className="journal-note">"{s.message}"</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminGreenOrders() {
  const { greenOrders, updateGreenOrderStatus, settings } = useAdmin();
  const { addToast } = useToast();
  const [query, setQuery] = useState("");
  const STATUSES = ["New", "Quoted", "Invoiced", "Shipped", "Fulfilled"];
  const business = {
    name: settings.businessName, address: settings.businessAddress, email: settings.contactEmail,
    taxId: settings.taxId, taxRatePercent: settings.taxRatePercent, invoiceNotes: settings.invoiceNotes,
  };
  const downloadInvoice = (o) => {
    generateInvoicePDF({
      invoiceNumber: o.id, date: o.date,
      billTo: { name: o.name, email: o.email, company: o.company },
      lineItems: [{ description: `${o.beanName} (green, unroasted)`, qty: o.quantityKg, unitPriceCents: o.pricePerKgCentsAtOrder, totalCents: o.totalCents }],
      totalCents: o.totalCents,
      notes: o.message || "", business,
    });
    addToast("Invoice downloaded");
  };
  const filtered = greenOrders.filter((o) => {
    const q = query.toLowerCase();
    return !q || o.name.toLowerCase().includes(q) || (o.company || "").toLowerCase().includes(q) || o.beanName.toLowerCase().includes(q) || o.status.toLowerCase().includes(q);
  });
  const exportGreenOrders = () => exportToCSV("green-coffee-orders", ["ID", "Name", "Company", "Email", "Date", "Lot", "Qty (kg)", "Total (USD)", "Status"], filtered.map((o) => [
    o.id, o.name, o.company || "", o.email, o.date, o.beanName, o.quantityKg, (o.totalCents / 100).toFixed(2), o.status,
  ]));
  return (
    <div>
      <h3 className="matched-head">Green coffee wholesale orders ({filtered.length}{query ? ` of ${greenOrders.length}` : ""})</h3>
      {greenOrders.length > 0 && (
        <AdminTableToolbar query={query} setQuery={setQuery} onExport={exportGreenOrders} placeholder="Search by buyer, lot, or status…" />
      )}
      {greenOrders.length === 0 ? (
        <p className="hint">No wholesale order requests yet — they'll appear here when the Green Coffee page's order form is submitted.</p>
      ) : filtered.length === 0 ? (
        <p className="hint">No orders match "{query}".</p>
      ) : (
        <div className="admin-card-list">
          {filtered.map((o) => (
            <div key={o.id} className="admin-card">
              <div className="admin-card-head">
                <strong>{o.name}{o.company ? ` — ${o.company}` : ""}</strong>
                <select value={o.status} onChange={(e) => { updateGreenOrderStatus(o.id, e.target.value); addToast(e.target.value === "Invoiced" ? "Marked Invoiced — download the PDF below" : `Marked ${e.target.value}`); }}>
                  {STATUSES.map((st) => (<option key={st} value={st}>{st}</option>))}
                </select>
              </div>
              <p className="hint">{o.email} · {o.date}</p>
              <p><span className="chip chip-active">{o.beanName}</span> {o.quantityKg}kg — {fmtPrice(o.totalCents)} <button className="link-btn" onClick={() => downloadInvoice(o)}>Download invoice</button></p>
              {o.message && <p className="journal-note">"{o.message}"</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminLiveChat() {
  const { liveChats, updateChatStatus } = useAdmin();
  const { addToast } = useToast();
  const [expanded, setExpanded] = useState(null);
  const STATUSES = ["Open", "Resolved"];
  const fmtTime = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <h3 className="matched-head">Live chat conversations ({liveChats.length})</h3>
      {liveChats.length === 0 ? (
        <p className="hint">No live chats yet — they'll appear here as visitors start conversations from the customer care widget.</p>
      ) : (
        <div className="admin-card-list">
          {liveChats.map((c) => {
            const isOpen = expanded === c.id;
            const lastMsg = c.messages[c.messages.length - 1];
            return (
              <div key={c.id} className="admin-card">
                <div className="admin-card-head">
                  <strong>{c.customerName}</strong>
                  <select value={c.status} onChange={(e) => { updateChatStatus(c.id, e.target.value); addToast(`Marked ${e.target.value}`); }}>
                    {STATUSES.map((st) => (<option key={st} value={st}>{st}</option>))}
                  </select>
                </div>
                <p className="hint">{c.customerEmail} · started {fmtTime(c.startedAt)} · {c.messages.length} messages</p>
                {lastMsg && !isOpen && <p className="journal-note">"{lastMsg.text}"</p>}
                <button className="link-btn" onClick={() => setExpanded(isOpen ? null : c.id)}>
                  {isOpen ? "Hide transcript" : "View full transcript"}
                </button>
                {isOpen && (
                  <div className="chat-transcript">
                    {c.messages.map((m, i) => (
                      <div key={i} className={`chat-transcript-line ${m.sender === "user" ? "from-user" : "from-agent"}`}>
                        <strong>{m.sender === "user" ? c.customerName : "Agent"}:</strong> {m.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminFeedback() {
  const { feedbackList, feedbackListLoading, feedbackListError, refetchFeedbackList, toggleFeedbackReviewed, getAllProducts } = useAdmin();
  const { addToast } = useToast();
  const allProducts = getAllProducts();

  if (feedbackListLoading) return <p className="hint">Loading feedback…</p>;
  if (feedbackListError) {
    return (
      <div>
        <p className="form-error">Couldn't load feedback: {feedbackListError}</p>
        <button className="btn-outline" onClick={refetchFeedbackList}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="matched-head">Feedback ({feedbackList.length})</h3>
      <p className="hint" style={{ marginTop: -6 }}>Marking a review "Reviewed" publishes it to that product's Reviews tab on the storefront — this is a real moderation gate, not just a label.</p>
      {feedbackList.length === 0 ? (
        <p className="hint">No reviews yet — they'll appear here from the "Leave Your Aroma" button.</p>
      ) : (
        <div className="admin-card-list">
          {feedbackList.map((f) => {
            const p = allProducts.find((p) => p.id === f.productId);
            return (
              <div key={f.id} className="admin-card">
                <div className="admin-card-head">
                  <strong>{"●".repeat(f.rating)}{"○".repeat(5 - f.rating)}</strong>
                  <label className="reviewed-toggle">
                    <input
                      type="checkbox"
                      checked={f.reviewed}
                      onChange={async () => {
                        const result = await toggleFeedbackReviewed(f.id);
                        if (!result.ok) addToast(result.error);
                      }}
                    /> Reviewed
                  </label>
                </div>
                <p className="hint">{p ? `${p.name} — ${p.country}` : "General feedback"} · {f.date}</p>
                <p className="hint">Aroma {f.aroma}/10 · Texture {f.texture}/10</p>
                {f.tags?.length > 0 && (
                  <div className="chip-row">
                    {f.tags.map((t) => (<span key={t} className="chip chip-active">{t}</span>))}
                  </div>
                )}
                {f.note && <p className="journal-note">"{f.note}"</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminLiveMessages() {
  const { kenyaMessages, addKenyaMessage, updateKenyaMessage, removeKenyaMessage } = useAdmin();
  const { addToast } = useToast();
  const [draft, setDraft] = useState("");
  // Typing only updates this local draft -- updateKenyaMessage is a real, backend-persisted call
  // now (see ROADMAP.md), so it only actually fires once, on Save, not on every keystroke the way
  // a direct onChange={() => updateKenyaMessage(...)} would (which would mean one real API call
  // per character typed, and a real risk of an older keystroke's request resolving after a newer
  // one and briefly reverting the visible text).
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (i, current) => { setEditingIndex(i); setEditDraft(current); };
  const saveEdit = async (i) => {
    setSaving(true);
    const result = await updateKenyaMessage(i, editDraft);
    setSaving(false);
    setEditingIndex(null);
    addToast(result && result.ok === false ? result.error : "Live message updated");
  };

  return (
    <div>
      <h3 className="matched-head">Kenya "Auction Beat" — live on homepage &amp; Kenya's country page</h3>
      <div className="admin-card-list">
        {kenyaMessages.map((m, i) => (
          <div key={i} className="admin-card">
            {editingIndex === i ? (
              <>
                <textarea className="admin-message-edit" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={2} maxLength={200} autoFocus />
                <button className="link-btn" onClick={() => saveEdit(i)} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                <button className="link-btn" onClick={() => setEditingIndex(null)} disabled={saving}>Cancel</button>
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.88rem", color: "#6b5647" }}>{m}</p>
                <button className="link-btn" onClick={() => startEdit(i, m)}>Edit</button>
                <button
                  className="link-btn"
                  onClick={async () => {
                    const result = await removeKenyaMessage(i);
                    addToast(result && result.ok === false ? result.error : "Message removed");
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="admin-add-message">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="New live message…" maxLength={200} />
        <button
          className="btn-outline small"
          onClick={async () => {
            if (!draft.trim()) return;
            const result = await addKenyaMessage(draft.trim());
            setDraft("");
            addToast(result && result.ok === false ? result.error : "Live message added");
          }}
        >
          Add message
        </button>
      </div>
    </div>
  );
}

export function AdminAuditLog() {
  const { auditLog } = useAdmin();
  const fmtTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  return (
    <div>
      <h3 className="matched-head">Admin activity ({auditLog.length})</h3>
      <p className="hint" style={{ marginBottom: 16 }}>Every price, stock, content, and settings change made from this dashboard, most recent first. Kept in memory for this session only — the last 200 actions.</p>
      {auditLog.length === 0 ? (
        <p className="hint">No admin actions yet this session.</p>
      ) : (
        <div className="admin-table">
          <div className="admin-row admin-header audit-row">
            <span>When</span><span>Who</span><span>Action</span><span>Detail</span>
          </div>
          {auditLog.map((e) => (
            <div key={e.id} className="admin-row audit-row">
              <span className="hint" style={{ margin: 0 }}>{fmtTime(e.timestamp)}</span>
              <span>{e.actor}</span>
              <span>{e.action}</span>
              <span className="hint" style={{ margin: 0 }}>{e.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminContent() {
  const { getMomentContent, setMomentContent, getAllCourses, updateCourseDetails, realCoursesLoading, getCountryHistory, setCountryHistory } = useAdmin();
  const { format } = useCurrency();
  const { addToast } = useToast();
  const [tab, setTab] = useState("Moments");
  const [editingMoment, setEditingMoment] = useState(null);
  const [momentDraft, setMomentDraft] = useState({ benefit: "", description: "" });
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseDraft, setCourseDraft] = useState({ blurb: "", monthlyPriceCents: 0, instructor: "", lessons: 1 });
  const [editingCountry, setEditingCountry] = useState(null);
  const [countryDraft, setCountryDraft] = useState("");

  const startMomentEdit = (m) => { setEditingMoment(m.id); setMomentDraft({ benefit: m.benefit, description: m.description }); };
  const saveMoment = (id) => { setMomentContent(id, momentDraft); setEditingMoment(null); addToast("Moment content updated"); };

  const startCourseEdit = (c) => { setEditingCourse(c.id); setCourseDraft({ blurb: c.blurb, monthlyPriceCents: c.monthlyPriceCents, instructor: c.instructor, lessons: c.lessons }); };
  const saveCourse = async (id) => {
    const result = await updateCourseDetails(id, courseDraft);
    setEditingCourse(null);
    addToast(result.ok ? "Course updated" : result.error);
  };

  const startCountryEdit = (name) => { setEditingCountry(name); setCountryDraft(getCountryHistory(name)); };
  const saveCountry = (name) => { setCountryHistory(name, countryDraft); setEditingCountry(null); addToast("Country history updated"); };

  return (
    <div>
      <div className="cat-tabs">
        {["Moments", "Courses", "Countries"].map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "Moments" && (
        <div className="admin-card-list">
          {MOMENTS.map((raw) => {
            const m = getMomentContent(raw);
            const editing = editingMoment === m.id;
            return (
              <div key={m.id} className="admin-card">
                <div className="admin-card-head"><strong>{m.icon} {m.name}</strong></div>
                {editing ? (
                  <>
                    <label className="filter-label">Benefit line</label>
                    <input className="admin-content-input" value={momentDraft.benefit} onChange={(e) => setMomentDraft({ ...momentDraft, benefit: e.target.value })} maxLength={120} />
                    <label className="filter-label">Description</label>
                    <textarea className="admin-message-edit" rows={4} value={momentDraft.description} onChange={(e) => setMomentDraft({ ...momentDraft, description: e.target.value })} maxLength={800} />
                    <button className="link-btn" onClick={() => saveMoment(m.id)}>Save</button>
                    <button className="link-btn" onClick={() => setEditingMoment(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <p className="hint">{m.benefit}</p>
                    <p style={{ fontSize: "0.88rem", color: "#6b5647" }}>{m.description}</p>
                    <button className="link-btn" onClick={() => startMomentEdit(m)}>Edit</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "Courses" && (
        realCoursesLoading ? (
          <p className="hint">Loading courses…</p>
        ) : (
          <div className="admin-card-list">
            {getAllCourses().map((c) => {
              const editing = editingCourse === c.id;
              return (
                <div key={c.id} className="admin-card">
                  <div className="admin-card-head"><strong>{c.name}</strong><span className="hint">{c.category}</span></div>
                  {editing ? (
                    <>
                      <label className="filter-label">Instructor</label>
                      <input className="admin-content-input" value={courseDraft.instructor} onChange={(e) => setCourseDraft({ ...courseDraft, instructor: e.target.value })} maxLength={200} />
                      <label className="filter-label">Lessons</label>
                      <input className="admin-content-input" type="number" min={1} value={courseDraft.lessons} onChange={(e) => setCourseDraft({ ...courseDraft, lessons: Number(e.target.value) })} />
                      <label className="filter-label">Monthly price (USD cents) — annual is always 20% off 12 months, computed automatically</label>
                      <input className="admin-content-input" type="number" min={0} value={courseDraft.monthlyPriceCents} onChange={(e) => setCourseDraft({ ...courseDraft, monthlyPriceCents: Number(e.target.value) })} />
                      <label className="filter-label">Blurb</label>
                      <textarea className="admin-message-edit" rows={3} value={courseDraft.blurb} onChange={(e) => setCourseDraft({ ...courseDraft, blurb: e.target.value })} maxLength={400} />
                      <button className="link-btn" onClick={() => saveCourse(c.id)}>Save</button>
                      <button className="link-btn" onClick={() => setEditingCourse(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: "0.88rem", color: "#6b5647" }}>{c.blurb}</p>
                      <p className="hint">{c.instructor} · {c.lessons} lessons · {format(c.monthlyPriceCents)}/mo · {format(c.annualPriceCents)}/yr</p>
                      <button className="link-btn" onClick={() => startCourseEdit(c)}>Edit</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "Countries" && (
        <div className="admin-card-list">
          {COUNTRIES.map((c) => {
            const editing = editingCountry === c.name;
            return (
              <div key={c.name} className="admin-card">
                <div className="admin-card-head"><strong>{c.flag} {c.name}</strong></div>
                {editing ? (
                  <>
                    <label className="filter-label">World Journey history</label>
                    <textarea className="admin-message-edit" rows={4} value={countryDraft} onChange={(e) => setCountryDraft(e.target.value)} maxLength={800} />
                    <button className="link-btn" onClick={() => saveCountry(c.name)}>Save</button>
                    <button className="link-btn" onClick={() => setEditingCountry(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: "0.88rem", color: "#6b5647" }}>{getCountryHistory(c.name)}</p>
                    <button className="link-btn" onClick={() => startCountryEdit(c.name)}>Edit</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="hint" style={{ marginTop: 14 }}>Content changes apply live across the storefront — hub pages and detail pages both update instantly.</p>
    </div>
  );
}

export function AdminSettings() {
  const { settingsLoading, settingsError, refetchSettings } = useAdmin();

  // Deliberately gates on a separate component boundary, not just an early return inside one
  // component -- useState(settings) below needs to only ever run its FIRST render (the only time
  // its initial value is actually used) once settings has genuinely finished loading. An early
  // return in the same component wouldn't prevent that hook from having already captured a stale
  // fallback value on an earlier render before loading finished, since useState's initial value
  // is never re-evaluated on subsequent renders even after the real data arrives.
  if (settingsLoading) return <p className="hint">Loading settings…</p>;
  if (settingsError) {
    return (
      <div>
        <p className="form-error">Couldn't load settings: {settingsError}</p>
        <button className="btn-outline" onClick={refetchSettings}>Try again</button>
      </div>
    );
  }
  return <AdminSettingsForm />;
}

function AdminSettingsForm() {
  const { settings, setSettings, exportAdminData, restoreAdminData } = useAdmin();
  const { exportUsers, restoreUsers } = useAuth();
  const { addToast } = useToast();
  const [draft, setDraft] = useState(settings);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);

  const save = async () => {
    const result = await setSettings(draft);
    addToast(result.ok ? "Settings saved" : result.error);
  };

  // Covers only what's still genuinely in-memory (catalog/admin overrides, the vestigial demo
  // users list). Orders and real customer accounts live in Postgres now and aren't part of this
  // app-level JSON backup at all -- a real database needs a real backup strategy (e.g. Railway's
  // own database backups), not an ad-hoc download, same reasoning already applied when users
  // moved to the real backend.
  const downloadBackup = () => {
    const backup = { version: 1, exportedAt: new Date().toISOString(), admin: exportAdminData(), users: exportUsers() };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `morning-aroma-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast("Backup downloaded");
  };

  const handleRestoreFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm("Restore from this backup? This replaces current catalog changes and the demo customer list with what's in the file — not merged, replaced. Real orders and real customer accounts (in Postgres) aren't affected by this.")) {
      e.target.value = "";
      return;
    }
    setRestoring(true);
    const reader = new FileReader();
    reader.onerror = () => { addToast("Couldn't read that file"); setRestoring(false); };
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.admin) restoreAdminData(parsed.admin);
        if (parsed.users) restoreUsers(parsed.users);
        addToast("Backup restored");
      } catch {
        addToast("That file isn't a valid backup");
      }
      setRestoring(false);
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="admin-settings-form">
      <label className="filter-label" htmlFor="set-tagline">Site tagline (footer)</label>
      <input id="set-tagline" value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} maxLength={120} />

      <label className="filter-label" htmlFor="set-email" style={{ marginTop: 16 }}>Contact email</label>
      <input id="set-email" type="email" value={draft.contactEmail} onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })} maxLength={254} />

      <label className="filter-label" htmlFor="set-phone" style={{ marginTop: 16 }}>Phone number (customer care)</label>
      <input id="set-phone" type="tel" value={draft.phoneNumber} onChange={(e) => setDraft({ ...draft, phoneNumber: e.target.value })} maxLength={30} placeholder="+254 712 345 678" />

      <label className="filter-label" htmlFor="set-whatsapp" style={{ marginTop: 16 }}>WhatsApp number (customer care)</label>
      <input id="set-whatsapp" type="tel" value={draft.whatsappNumber} onChange={(e) => setDraft({ ...draft, whatsappNumber: e.target.value })} maxLength={30} placeholder="+254712345678" />
      <p className="hint" style={{ marginTop: 4 }}>Include the country code. Used to build the "Chat on WhatsApp" link in the customer care widget.</p>

      <label className="filter-label" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={draft.announcementEnabled} onChange={(e) => setDraft({ ...draft, announcementEnabled: e.target.checked })} />
        Show announcement bar site-wide
      </label>
      <label className="filter-label" htmlFor="set-announcement" style={{ marginTop: 10 }}>Announcement text</label>
      <input id="set-announcement" value={draft.announcementText} onChange={(e) => setDraft({ ...draft, announcementText: e.target.value })} disabled={!draft.announcementEnabled} maxLength={140} />

      <h4 className="admin-subhead">Business &amp; invoicing</h4>
      <p className="hint" style={{ marginTop: -4 }}>Used on every downloaded invoice PDF (Orders, Green Coffee, and Consultations).</p>
      <label className="filter-label" htmlFor="set-bizname">Legal business name</label>
      <input id="set-bizname" value={draft.businessName} onChange={(e) => setDraft({ ...draft, businessName: e.target.value })} maxLength={120} />

      <label className="filter-label" htmlFor="set-bizaddr" style={{ marginTop: 16 }}>Business address</label>
      <input id="set-bizaddr" value={draft.businessAddress} onChange={(e) => setDraft({ ...draft, businessAddress: e.target.value })} maxLength={160} />

      <label className="filter-label" htmlFor="set-taxid" style={{ marginTop: 16 }}>Tax / VAT ID (optional)</label>
      <input id="set-taxid" value={draft.taxId} onChange={(e) => setDraft({ ...draft, taxId: e.target.value })} maxLength={60} placeholder="Leave blank to omit from invoices" />

      <label className="filter-label" htmlFor="set-taxrate" style={{ marginTop: 16 }}>Tax rate applied to invoices (%)</label>
      <input id="set-taxrate" type="number" min="0" max="100" step="0.5" value={draft.taxRatePercent} onChange={(e) => setDraft({ ...draft, taxRatePercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} style={{ maxWidth: 120 }} />
      <p className="hint" style={{ marginTop: 4 }}>Set to 0 to omit tax entirely — the subtotal/tax breakdown only appears on invoices when this is above 0.</p>

      <label className="filter-label" htmlFor="set-invoicenotes" style={{ marginTop: 16 }}>Default invoice notes</label>
      <textarea id="set-invoicenotes" value={draft.invoiceNotes} onChange={(e) => setDraft({ ...draft, invoiceNotes: e.target.value })} rows={3} maxLength={400} />
      <p className="hint" style={{ marginTop: 4 }}>Shown at the bottom of an invoice only when that specific order/inquiry has no note of its own.</p>

      <label className="filter-label" htmlFor="set-lifetimeprice" style={{ marginTop: 16 }}>Academy lifetime access price (USD cents)</label>
      <input id="set-lifetimeprice" type="number" min="0" value={draft.academyLifetimePriceCents} onChange={(e) => setDraft({ ...draft, academyLifetimePriceCents: Math.max(0, Number(e.target.value) || 0) })} style={{ maxWidth: 160 }} />
      <p className="hint" style={{ marginTop: 4 }}>One-time payment for permanent access to every Academy course, including ones added later. Individual course monthly/annual prices are set per-course under Content → Courses.</p>

      <h4 className="admin-subhead">Social links</h4>
      <label className="filter-label" htmlFor="set-instagram">Instagram handle (optional)</label>
      <input id="set-instagram" value={draft.instagramHandle} onChange={(e) => setDraft({ ...draft, instagramHandle: e.target.value.replace(/^@/, "") })} maxLength={60} placeholder="morningaroma (without the @)" />

      <label className="filter-label" htmlFor="set-facebook" style={{ marginTop: 16 }}>Facebook page URL (optional)</label>
      <input id="set-facebook" type="url" value={draft.facebookUrl} onChange={(e) => setDraft({ ...draft, facebookUrl: e.target.value })} maxLength={200} placeholder="https://facebook.com/…" />
      <p className="hint" style={{ marginTop: 4 }}>Leave either blank to hide that icon from the footer.</p>

      <h4 className="admin-subhead">Notifications</h4>
      <p className="hint" style={{ marginTop: -4 }}>Which pending-item types show up in the notification bell (top right of any admin page). A section's sidebar badge is unaffected by this — muting a type here only controls the bell.</p>
      <div className="admin-tag-checks">
        {["Orders", "Quotations", "Service Inquiries", "Green Orders", "Feedback", "Live Chat"].map((type) => (
          <label key={type} className={`chip ${draft.notificationTypes.includes(type) ? "chip-active" : ""}`}>
            <input
              type="checkbox"
              className="visually-hidden"
              checked={draft.notificationTypes.includes(type)}
              onChange={() => setDraft({
                ...draft,
                notificationTypes: draft.notificationTypes.includes(type)
                  ? draft.notificationTypes.filter((t) => t !== type)
                  : [...draft.notificationTypes, type],
              })}
            />
            {type}
          </label>
        ))}
      </div>

      <button className="btn-primary" style={{ marginTop: 20 }} onClick={save}>Save settings</button>

      <h4 className="admin-subhead">Backup</h4>
      <p className="hint" style={{ marginTop: -6 }}>
        There's no real database here to back up — this is the client-side equivalent: a downloadable snapshot of everything that
        would be genuinely painful to lose (catalog changes, orders, wholesale orders, quotations, service inquiries, feedback,
        customer accounts, and settings), not a live, automatic backup service.
      </p>
      <div className="admin-backup-actions">
        <button className="btn-primary" onClick={downloadBackup}>Download backup</button>
        <button className="btn-outline" onClick={() => fileInputRef.current?.click()} disabled={restoring}>
          {restoring ? "Restoring…" : "Restore from backup"}
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" className="visually-hidden" onChange={handleRestoreFile} />
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Restoring replaces current data with what's in the file — it doesn't merge the two. Passwords are never included in a backup either way.</p>
    </div>
  );
}

// Consolidates every section's own pendingCount into one dropdown, rather than making admin check
// each sidebar badge individually. Respects settings.notificationTypes -- a section muted there
// simply never appears here, even if it has pending items (its sidebar badge is unaffected; muting
// only controls what surfaces in the bell).
function NotificationBell({ pendingCount, visibleSections, notificationTypes, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, open, () => setOpen(false));
  useEscapeKey(open, () => setOpen(false));

  const items = visibleSections
    .filter((s) => notificationTypes.includes(s))
    .map((s) => ({ section: s, count: pendingCount(s) }))
    .filter((i) => i.count > 0);
  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="notification-bell-wrap" ref={ref}>
      <button className="notification-bell-btn" onClick={() => setOpen((o) => !o)} aria-label={total > 0 ? `${total} notifications need attention` : "Notifications"} aria-expanded={open}>
        🔔
        {total > 0 && <span className="notification-bell-badge">{total}</span>}
      </button>
      {open && (
        <div className="notification-bell-panel" role="menu">
          <p className="notification-bell-title">Needs attention</p>
          {items.length === 0 ? (
            <p className="hint" style={{ padding: "4px 16px 14px", margin: 0 }}>All caught up — nothing needs attention right now.</p>
          ) : (
            items.map(({ section, count }) => (
              <button key={section} className="notification-bell-item" role="menuitem" onClick={() => { onNavigate(section); setOpen(false); }}>
                <span>{section}</span>
                <span className="admin-nav-badge">{count}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const { go } = useRoute();
  const { quotations, serviceInquiries, greenOrders, feedbackList, liveChats, settings, realOrders } = useAdmin();
  const [section, setSection] = useState("Overview");
  const [authView, setAuthView] = useState(null); // null | "signin" | "signup"

  // Pending-item counts shown as a small badge next to each sidebar section — only for sections
  // that track something genuinely actionable (a "New" status, an unreviewed item), not just any
  // list with rows in it.
  const pendingCount = (s) => {
    switch (s) {
      case "Orders": return realOrders.filter((o) => o.status === "Processing").length;
      case "Quotations": return quotations.filter((q) => q.status !== "Closed").length;
      case "Service Inquiries": return serviceInquiries.filter((si) => si.status === "New").length;
      case "Green Orders": return greenOrders.filter((o) => o.status === "New").length;
      case "Feedback": return feedbackList.filter((f) => !f.reviewed).length;
      case "Live Chat": return liveChats.filter((c) => c.status === "Open").length;
      default: return 0;
    }
  };

  // Super admins see every section. Staff only see Overview (a safe, read-only landing page,
  // always available regardless of what else they're granted) plus whatever sections they've
  // been explicitly given access to. Computed and the effect below run unconditionally, before
  // any early return -- calling a hook only on some renders (e.g. only once `user` is populated)
  // violates React's Rules of Hooks and throws "rendered more hooks than during the previous
  // render". This used to be harmless when auth was synchronous/fake and `user` was always
  // immediately available one way or the other; real, async session restoration means there's
  // now a genuine render where `user` is still null followed by one where it's populated, which
  // is exactly the transition that exposes this class of bug.
  const baseSections = user && user.role === "super_admin" ? ADMIN_SECTIONS : ["Overview", ...((user && user.permissions) || [])];
  // Not its own independently-grantable staff permission -- bundled with Orders access, matching
  // the backend's own requirePermission("Orders") decision for GET /subscriptions (subscriptions
  // are treated as a kind of recurring order, not a separate admin capability).
  const visibleSections = baseSections.includes("Orders") ? [...baseSections, "Subscriptions", "Academy Lifetime"] : baseSections;
  useEffect(() => {
    // Guards against a staff member's permission being revoked while a restricted section was
    // still selected — falls back to Overview instead of rendering a section they can no longer see.
    if (user && !visibleSections.includes(section)) setSection("Overview");
  }, [user, section, visibleSections.join(",")]);

  if (!user || (user.role !== "super_admin" && user.role !== "staff")) {
    return (
      <div className="journey-locked">
        <span className="bean-shape" style={{ width: 36, height: 46, margin: "0 auto 16px" }} />
        <h2>Admin access only</h2>
        <p>This dashboard is restricted to the Morning Aroma team. Sign in with an admin account to continue.</p>
        <button className="btn-primary" onClick={() => setAuthView("signin")}>Sign in</button>
        <SignInModal open={authView === "signin"} onClose={() => setAuthView(null)} onSwitchToSignUp={() => setAuthView("signup")} />
        <SignUpModal open={authView === "signup"} onClose={() => setAuthView(null)} onSwitchToSignIn={() => setAuthView("signin")} />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <p className="eyebrow" style={{ padding: "0 20px" }}>admin</p>
        {visibleSections.map((s) => {
          const count = pendingCount(s);
          return (
            <button key={s} className={`admin-nav-item ${section === s ? "active" : ""}`} onClick={() => setSection(s)}>
              {s}
              {count > 0 && <span className="admin-nav-badge">{count}</span>}
            </button>
          );
        })}
        <button className="admin-nav-item" onClick={() => go("home")}>← Back to site</button>
      </aside>
      <div className="admin-content">
        <div className="admin-content-head admin-content-head-row">
          <div>
            <p className="eyebrow">signed in as {user.name}</p>
            <h1>{section}</h1>
          </div>
          <NotificationBell pendingCount={pendingCount} visibleSections={visibleSections} notificationTypes={settings.notificationTypes} onNavigate={setSection} />
        </div>
        {section === "Overview" && <AdminOverview />}
        {section === "Analytics" && <AdminAnalytics />}
        {section === "Orders" && <AdminOrders />}
        {section === "Subscriptions" && <AdminSubscriptions />}
        {section === "Academy Lifetime" && <AdminAcademyLifetimeAccess />}
        {section === "Invoices" && <AdminInvoices />}
        {section === "Customers" && <AdminCustomers />}
        {section === "Products" && <AdminProducts />}
        {section === "Inventory" && <AdminInventory />}
        {section === "Content" && <AdminContent />}
        {section === "Quotations" && <AdminQuotations />}
        {section === "Service Inquiries" && <AdminServiceInquiries />}
        {section === "Green Orders" && <AdminGreenOrders />}
        {section === "Live Chat" && <AdminLiveChat />}
        {section === "Feedback" && <AdminFeedback />}
        {section === "Live Messages" && <AdminLiveMessages />}
        {section === "Audit Log" && <AdminAuditLog />}
        {section === "Settings" && <AdminSettings />}
      </div>
    </div>
  );
}
