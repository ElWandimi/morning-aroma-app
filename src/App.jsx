import React, { useState, useEffect, useRef, createContext, useContext, lazy, Suspense } from "react";
const AdminDashboard = lazy(() => import("./admin").then((m) => ({ default: m.AdminDashboard })));
import { AnnouncementBar, CartDrawer, ConsentBanner, CustomerCareWidget, ErrorBoundary, FeedbackBean, Footer, SignInModal, SignUpModal, Nav, NotFoundPage, SearchModal, TranslateSuggestBanner, WishlistDrawer } from "./components";
import { AdminDataProvider, AuthProvider, CartProvider, CurrencyProvider, JournalProvider, OrdersProvider, RouteProvider, SubscriptionsProvider, ToastProvider, WishlistProvider, useAdmin, useRoute } from "./context";
import { BREW_GUIDES, COUNTRIES, GROWING_FACTORS, KNOWN_ROUTES, MOMENTS, PAGE_META } from "./data";
import { useDocumentMeta, useScrollReveal, useStructuredData } from "./hooks";
import { HomePage } from "./pages/Home";
import { CSS } from "./styles/theme";
import { slugify } from "./utils/helpers";

// Every page below except HomePage (imported eagerly above -- it's the landing page most
// visitors see first, and lazy-loading it would add an unnecessary extra network request for the
// single most common case) is loaded on demand, the same real pattern already proven for the
// admin panel above. Someone who only ever visits the homepage and shop now downloads genuinely
// less code than before; a page they never visit (say, Green Coffee or Our Services) never loads
// at all. Multiple named exports from the same file (e.g. AcademyHubPage and CoursePage both from
// ./pages/Academy) naturally land in the same chunk together, which is fine -- they're the hub and
// detail page for the same real feature, so loading one usually means the other is coming next.
const AcademyHubPage = lazy(() => import("./pages/Academy").then((m) => ({ default: m.AcademyHubPage })));
const CoursePage = lazy(() => import("./pages/Academy").then((m) => ({ default: m.CoursePage })));
const BrewGuidePage = lazy(() => import("./pages/BrewGuides").then((m) => ({ default: m.BrewGuidePage })));
const BrewGuidesHubPage = lazy(() => import("./pages/BrewGuides").then((m) => ({ default: m.BrewGuidesHubPage })));
const CheckoutPage = lazy(() => import("./pages/Checkout").then((m) => ({ default: m.CheckoutPage })));
const CountryPage = lazy(() => import("./pages/Growing").then((m) => ({ default: m.CountryPage })));
const GrowingFactorPage = lazy(() => import("./pages/Growing").then((m) => ({ default: m.GrowingFactorPage })));
const GrowingHubPage = lazy(() => import("./pages/Growing").then((m) => ({ default: m.GrowingHubPage })));
const GrowingProfilePage = lazy(() => import("./pages/Growing").then((m) => ({ default: m.GrowingProfilePage })));
const SeasonsPage = lazy(() => import("./pages/Growing").then((m) => ({ default: m.SeasonsPage })));
const SoilExplorerPage = lazy(() => import("./pages/Growing").then((m) => ({ default: m.SoilExplorerPage })));
const HistoryPage = lazy(() => import("./pages/History").then((m) => ({ default: m.HistoryPage })));
const JourneyPage = lazy(() => import("./pages/Journey").then((m) => ({ default: m.JourneyPage })));
const ContactPage = lazy(() => import("./pages/Misc").then((m) => ({ default: m.ContactPage })));
const FaqPage = lazy(() => import("./pages/Misc").then((m) => ({ default: m.FaqPage })));
const PrivacyPolicyPage = lazy(() => import("./pages/Misc").then((m) => ({ default: m.PrivacyPolicyPage })));
const SourceLibraryPage = lazy(() => import("./pages/Misc").then((m) => ({ default: m.SourceLibraryPage })));
const TermsOfServicePage = lazy(() => import("./pages/Misc").then((m) => ({ default: m.TermsOfServicePage })));
const MomentPage = lazy(() => import("./pages/Moments").then((m) => ({ default: m.MomentPage })));
const MomentsHubPage = lazy(() => import("./pages/Moments").then((m) => ({ default: m.MomentsHubPage })));
const OurPromisePage = lazy(() => import("./pages/Promise").then((m) => ({ default: m.OurPromisePage })));
const QuizPage = lazy(() => import("./pages/Quiz").then((m) => ({ default: m.QuizPage })));
const RitualsPage = lazy(() => import("./pages/Rituals").then((m) => ({ default: m.RitualsPage })));
const OurServicesPage = lazy(() => import("./pages/Services").then((m) => ({ default: m.OurServicesPage })));
const GreenBeansPage = lazy(() => import("./pages/GreenBeans").then((m) => ({ default: m.GreenBeansPage })));
const SearchResultsPage = lazy(() => import("./pages/Search").then((m) => ({ default: m.SearchResultsPage })));
const ProductPage = lazy(() => import("./pages/Shop").then((m) => ({ default: m.ProductPage })));
const ShopPage = lazy(() => import("./pages/Shop").then((m) => ({ default: m.ShopPage })));
const WorldJourneyPage = lazy(() => import("./pages/WorldJourney").then((m) => ({ default: m.WorldJourneyPage })));

// Builds the real per-page <title> / meta description for the current route — static pages
// pull straight from PAGE_META, pages with an :id (product, moment, course, etc.) look up the
// actual item so e.g. a product page's title is genuinely "SL28 — Kenya | Morning Aroma", not
// just the generic site title repeated on every page.
//
// realProducts/realCourses are passed in rather than imported as static data (PRODUCTS/COURSES
// from ./data) -- both are now real, database-backed, admin-editable data (see ROADMAP.md), and
// reading from the static arrays here would keep showing a stale title/description after an
// admin genuinely renamed a product or changed a course's blurb, since those static arrays are
// never updated by an admin edit at all, only ever by a code change.
function getPageMeta(route, realProducts, realCourses) {
  const suffix = " | Morning Aroma";
  switch (route.page) {
    case "product":
    case "growingprofile": {
      const p = realProducts.find((p) => p.id === route.id);
      return p
        ? { title: `${p.name} — ${p.country}${suffix}`, description: p.note }
        : PAGE_META[route.page === "product" ? "shop" : "growing"];
    }
    case "moment": {
      const m = MOMENTS.find((m) => m.id === route.id);
      return m ? { title: `${m.name}${suffix}`, description: m.benefit } : PAGE_META.moments;
    }
    case "course": {
      const c = realCourses.find((c) => c.id === route.id);
      return c ? { title: `${c.name}${suffix}`, description: c.blurb } : PAGE_META.academy;
    }
    case "brewguide": {
      const b = BREW_GUIDES.find((b) => slugify(b.name) === route.id);
      return b ? { title: `${b.name} Brew Guide${suffix}`, description: b.flavor } : PAGE_META.brewguides;
    }
    case "country": {
      const c = COUNTRIES.find((c) => slugify(c.name) === route.id);
      return c ? { title: `${c.name}${suffix}`, description: c.climate } : PAGE_META.growing;
    }
    case "growingfactor": {
      const f = GROWING_FACTORS.find((f) => slugify(f.name) === route.id);
      return f ? { title: `${f.name}${suffix}`, description: f.explain } : PAGE_META.growing;
    }
    case "soilexplorer":
      return PAGE_META.growing;
    case "searchresults":
      return route.id
        ? { title: `Search: ${route.id}${suffix}`, description: `Search results for "${route.id}" on Morning Aroma.` }
        : { title: `Search${suffix}`, description: "Search Morning Aroma's shop, moments, brew guides, and origins." };
    default:
      return PAGE_META[route.page] || PAGE_META.home;
  }
}

export function AppShell() {
  // null | "signin" | "signup" -- sign-in and sign-up are two fully separate modals now, not one
  // modal with an internal tab toggle; this single piece of state just tracks which one (if
  // either) is currently open, so switching between them from inside either modal is a one-line
  // state change rather than needing two booleans kept in sync.
  const [authView, setAuthView] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { route } = useRoute();
  const { settings, getAllProducts, getAllCourses } = useAdmin();
  const routeKey = route.page + (route.id || "");
  useScrollReveal(routeKey);
  const pageMeta = getPageMeta(route, getAllProducts(), getAllCourses());
  useDocumentMeta(pageMeta.title, pageMeta.description);
  useStructuredData({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.businessName,
    url: `${window.location.origin}/`,
    logo: `${window.location.origin}/logo-mark.png`,
    description: settings.tagline,
    address: settings.businessAddress ? { "@type": "PostalAddress", addressLocality: settings.businessAddress } : undefined,
    email: settings.contactEmail,
    sameAs: [settings.instagramHandle && `https://instagram.com/${settings.instagramHandle}`, settings.facebookUrl].filter(Boolean),
  });
  return (
    <div className="ma-root">
      <style>{CSS}</style>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <AnnouncementBar />
      <TranslateSuggestBanner />
      <Nav onOpenLogin={() => setAuthView("signin")} onOpenSearch={() => setSearchOpen(true)} />
      <div key={routeKey} id="main-content" className="page-fade">
        {route.page === "home" ? (
          <HomePage />
        ) : (
          <Suspense fallback={<div className="admin-chunk-loading"><span className="bean-shape" /><p>Loading…</p></div>}>
            {route.page === "shop" && <ShopPage />}
            {route.page === "product" && <ProductPage id={route.id} />}
            {route.page === "moments" && <MomentsHubPage />}
            {route.page === "moment" && <MomentPage id={route.id} />}
            {route.page === "brewguides" && <BrewGuidesHubPage />}
            {route.page === "brewguide" && <BrewGuidePage id={route.id} />}
            {route.page === "academy" && <AcademyHubPage />}
            {route.page === "course" && <CoursePage id={route.id} />}
            {route.page === "growing" && <GrowingHubPage />}
            {route.page === "growingprofile" && <GrowingProfilePage id={route.id} />}
            {route.page === "country" && <CountryPage id={route.id} />}
            {route.page === "growingfactor" && <GrowingFactorPage id={route.id} />}
            {route.page === "soilexplorer" && <SoilExplorerPage id={route.id} />}
            {route.page === "seasons" && <SeasonsPage />}
            {route.page === "history" && <HistoryPage />}
            {route.page === "promise" && <OurPromisePage />}
            {route.page === "journey" && <JourneyPage />}
            {route.page === "checkout" && <CheckoutPage />}
            {route.page === "quiz" && <QuizPage />}
            {route.page === "rituals" && <RitualsPage />}
            {route.page === "worldjourney" && <WorldJourneyPage />}
            {route.page === "services" && <OurServicesPage />}
            {route.page === "greenbeans" && <GreenBeansPage />}
            {route.page === "searchresults" && <SearchResultsPage id={route.id} />}
            {route.page === "faq" && <FaqPage />}
            {route.page === "contact" && <ContactPage />}
            {route.page === "sourcelibrary" && <SourceLibraryPage />}
            {route.page === "privacy" && <PrivacyPolicyPage />}
            {route.page === "terms" && <TermsOfServicePage />}
            {route.page === "admin" && <AdminDashboard />}
            {!KNOWN_ROUTES.has(route.page) && <NotFoundPage />}
          </Suspense>
        )}
      </div>
      <Footer />
      <FeedbackBean />
      <CustomerCareWidget />
      <SignInModal open={authView === "signin"} onClose={() => setAuthView(null)} onSwitchToSignUp={() => setAuthView("signup")} />
      <SignUpModal open={authView === "signup"} onClose={() => setAuthView(null)} onSwitchToSignIn={() => setAuthView("signin")} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />
      <WishlistDrawer />
      <ConsentBanner />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouteProvider>
          <AdminDataProvider>
            <ToastProvider>
              <CurrencyProvider>
                <CartProvider>
                  <WishlistProvider>
                    <OrdersProvider>
                      <SubscriptionsProvider>
                        <JournalProvider>
                          <AppShell />
                        </JournalProvider>
                      </SubscriptionsProvider>
                    </OrdersProvider>
                  </WishlistProvider>
                </CartProvider>
              </CurrencyProvider>
            </ToastProvider>
          </AdminDataProvider>
        </RouteProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
