import React, { useState, useEffect, useRef, createContext, useContext, lazy, Suspense } from "react";
const AdminDashboard = lazy(() => import("./admin").then((m) => ({ default: m.AdminDashboard })));
import { AnnouncementBar, CartDrawer, ConsentBanner, CustomerCareWidget, ErrorBoundary, FeedbackBean, Footer, LoginModal, Nav, NotFoundPage, SearchModal, TranslateSuggestBanner, WishlistDrawer } from "./components";
import { AdminDataProvider, AuthProvider, CartProvider, CurrencyProvider, JournalProvider, OrdersProvider, RouteProvider, ToastProvider, WishlistProvider, useAdmin, useRoute } from "./context";
import { BREW_GUIDES, COUNTRIES, COURSES, GROWING_FACTORS, KNOWN_ROUTES, MOMENTS, PAGE_META, PRODUCTS } from "./data";
import { useDocumentMeta, useScrollReveal, useStructuredData } from "./hooks";
import { AcademyHubPage, CoursePage } from "./pages/Academy";
import { BrewGuidePage, BrewGuidesHubPage } from "./pages/BrewGuides";
import { CheckoutPage } from "./pages/Checkout";
import { CountryPage, GrowingFactorPage, GrowingHubPage, GrowingProfilePage, SeasonsPage, SoilExplorerPage } from "./pages/Growing";
import { HistoryPage } from "./pages/History";
import { HomePage } from "./pages/Home";
import { JourneyPage } from "./pages/Journey";
import { ContactPage, FaqPage, PrivacyPolicyPage, SourceLibraryPage, TermsOfServicePage } from "./pages/Misc";
import { MomentPage, MomentsHubPage } from "./pages/Moments";
import { OurPromisePage } from "./pages/Promise";
import { QuizPage } from "./pages/Quiz";
import { RitualsPage } from "./pages/Rituals";
import { OurServicesPage } from "./pages/Services";
import { GreenBeansPage } from "./pages/GreenBeans";
import { SearchResultsPage } from "./pages/Search";
import { ProductPage, ShopPage } from "./pages/Shop";
import { WorldJourneyPage } from "./pages/WorldJourney";
import { CSS } from "./styles/theme";
import { slugify } from "./utils/helpers";

// Builds the real per-page <title> / meta description for the current route — static pages
// pull straight from PAGE_META, pages with an :id (product, moment, course, etc.) look up the
// actual item so e.g. a product page's title is genuinely "SL28 — Kenya | Morning Aroma", not
// just the generic site title repeated on every page.
function getPageMeta(route) {
  const suffix = " | Morning Aroma";
  switch (route.page) {
    case "product":
    case "growingprofile": {
      const p = PRODUCTS.find((p) => p.id === route.id);
      return p
        ? { title: `${p.name} — ${p.country}${suffix}`, description: p.note }
        : PAGE_META[route.page === "product" ? "shop" : "growing"];
    }
    case "moment": {
      const m = MOMENTS.find((m) => m.id === route.id);
      return m ? { title: `${m.name}${suffix}`, description: m.benefit } : PAGE_META.moments;
    }
    case "course": {
      const c = COURSES.find((c) => slugify(c.name) === route.id);
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
  const [loginOpen, setLoginOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { route } = useRoute();
  const { settings } = useAdmin();
  const routeKey = route.page + (route.id || "");
  useScrollReveal(routeKey);
  const pageMeta = getPageMeta(route);
  useDocumentMeta(pageMeta.title, pageMeta.description);
  useStructuredData({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.businessName,
    url: "https://www.morningaroma.com/",
    logo: "https://www.morningaroma.com/logo-mark.png",
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
      <Nav onOpenLogin={() => setLoginOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
      <div key={routeKey} id="main-content" className="page-fade">
        {route.page === "home" && <HomePage />}
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
        {route.page === "admin" && (
          <Suspense fallback={<div className="admin-chunk-loading"><span className="bean-shape" /><p>Loading admin…</p></div>}>
            <AdminDashboard />
          </Suspense>
        )}
        {!KNOWN_ROUTES.has(route.page) && <NotFoundPage />}
      </div>
      <Footer />
      <FeedbackBean />
      <CustomerCareWidget />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
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
                      <JournalProvider>
                        <AppShell />
                      </JournalProvider>
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
