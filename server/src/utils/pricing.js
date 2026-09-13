// This exact list (id, multiplier) is deliberately duplicated from src/data/index.js's own
// PRODUCT_SIZES -- that file has the full reasoning, but in short: the frontend is a separate
// project this backend can't import from, and this backend never trusts a client-computed
// size-adjusted price (the same principle orders.js already applies to unitPriceCents in
// general -- it looks up each item's real price itself rather than trusting what the client
// sent). If you change a multiplier or add a size in src/data/index.js, update this file too.
const PRODUCT_SIZES = [
  { id: "375g", multiplier: 0.375 },
  { id: "500g", multiplier: 0.5 },
  { id: "1kg", multiplier: 1 },
];
const DEFAULT_PRODUCT_SIZE = "1kg";

// basePriceCents is a product's own price_cents column -- genuinely the 1kg price, same as the
// frontend's own priceForSize. Rounds to the nearest cent, matching the frontend's rounding
// exactly so the two never disagree by a cent on the same order.
function priceForSize(basePriceCents, sizeId) {
  const size = PRODUCT_SIZES.find((s) => s.id === sizeId) || PRODUCT_SIZES.find((s) => s.id === DEFAULT_PRODUCT_SIZE);
  return Math.round(basePriceCents * size.multiplier);
}

function isValidSize(sizeId) {
  return PRODUCT_SIZES.some((s) => s.id === sizeId);
}

module.exports = { PRODUCT_SIZES, DEFAULT_PRODUCT_SIZE, priceForSize, isValidSize };
