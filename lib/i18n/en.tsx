// English UI dictionary — the secondary language. Every key here has a
// matching key in fi.js (the primary/default language); see
// lib/i18n/index.js's getDictionary(). Keep the two files' shapes in
// sync — a key added to one belongs in the other too, even as a rough
// placeholder, so useTranslations() never has to fall back silently.

import type { ReactNode } from 'react';

const en = {
  common: {
    loading: 'Loading…',
    // SEO gap-fill, Part C — eyebrow label on the clearly-marked
    // placeholder blocks in AboutPageClient.tsx/PickupPageClient.tsx.
    placeholderLabel: 'Placeholder — needs real content',
  },

  // SEO gap-fill, Part A — visible breadcrumb trail + matching
  // BreadcrumbList JSON-LD on the category and product pages (see
  // components/Breadcrumbs.tsx). `home` is the trail's first crumb;
  // category/product labels themselves already come from the menu data
  // (category.title/title_fi, product.name/name_fi), not from here.
  breadcrumb: {
    home: 'Home',
  },

  header: {
    menu: 'Menu',
    // Audit-fixes brief, Part 6.5 — these two nav links (components/
    // Header.tsx) go to #story and #visit, but no "Offers" or "Gift
    // cards" content/feature exists anywhere on this site — traced, not
    // assumed: no coupon/offers landing section, no gift-card purchase
    // flow anywhere in app/ or components/. Renamed to describe what
    // #story/#visit actually are, matching the wording
    // components/Footer.tsx already correctly uses for these same two
    // anchors (t.footer.ourStory/findUs) rather than inventing new copy.
    ourStory: 'Our story',
    findUs: 'Find us',
    trackOrder: 'Track order',
    cartAriaLabel: 'Cart',
    openMenuAriaLabel: 'Open menu',
    storeClosedBanner: "We're temporarily closed and not taking new orders right now.",
    // Growth features batch 2 (Feature 5) — homepage banner for whichever
    // scheduled offer is active right now. `label` is plain admin-entered
    // text (see admin/dashboard's Scheduled offers section) — never a
    // hardcoded campaign name. `amountText` is a pre-formatted "10%" or
    // "2.00 €" (lib/pricing.ts's describeDiscountValue) — shared
    // discount-value pattern, part 2 of this task: an offer's discount
    // can now be either shape, so this is no longer always a percentage.
    scheduledOfferBanner: (label: string, amountText: string) => `🔥 ${label}: ${amountText} off right now!`,
  },

  footer: {
    tagline: 'Pizza, kebab and burgers, made fresh.',
    pagesHeading: 'Pages',
    ourStory: 'Our story',
    findUs: 'Find us',
    contactHeading: 'Contact',
    privacyPolicy: 'Privacy Policy',
    faq: 'FAQ',
    terms: 'Terms & Conditions',
    rights: (year: number) => `© ${year} ozy.fi. All rights reserved.`,
    demoNotice: 'Demo website.',
    // Growth features (Feature 4 — referral program).
    referralColumnHeading: 'Refer a friend',
    referralHeading: 'Get a coupon for a friend',
    referralEmailPlaceholder: 'your@email.com',
    referralSubmit: 'Get code',
    referralSubmitting: 'Sending…',
    referralError: 'Could not get a code right now. Please try again.',
    referralSuccess: 'Here\'s your code — share it with a friend!',
    referralAlreadyHad: 'You already have a code:',
    referralCopy: 'Copy code',
    referralCopied: 'Copied!',
  },

  cookieBanner: {
    dialogAriaLabel: 'Cookie consent',
    message: (privacyLink: ReactNode) => (
      <>
        We use cookies and similar technical storage to run this site and keep items in your cart while you order.
        With your permission, we may also use cookies to measure traffic and ads. See our {privacyLink} for details.
      </>
    ),
    privacyPolicyLinkText: 'Privacy Policy',
    cookieSettings: 'Cookie settings',
    necessaryOnly: 'Necessary only',
    acceptAll: 'Accept all',
    necessaryTitle: 'Necessary',
    necessaryDesc: "Required for the site to work — keeping items in your cart and logging in as admin. Always on, can't be switched off.",
    necessaryAriaLabel: 'Necessary storage — always on',
    adsTitle: 'Advertising & analytics',
    adsDesc: 'Helps us see how the site is used and measure ads (Google Analytics, Meta/TikTok, Microsoft Clarity). Off unless you choose "Accept all" below.',
    adsAriaLabel: 'Advertising and analytics — off unless Accept all is chosen',
  },

  orderBar: {
    viewOrder: 'View order',
  },

  hero: {
    eyebrow: 'Pizza, kebab & burgers',
    titleStart: 'Start your',
    titleEm: 'order',
    reviews: '· 320+ reviews',
    openNow: 'Open now',
    etaRange: '25-35 min',
    subtitle: 'Fresh dough, made to order, always hot. Pick a category or browse the full menu — delivery or pickup at checkout.',
  },

  categories: {
    pizza: 'Pizza',
    kebab: 'Kebab',
    burgers: 'Burgers',
  },

  menuTeaser: {
    eyebrow: 'HUNGRY ALREADY?',
    heading: 'Fresh pizza, kebab and burgers',
    seeFullMenu: 'See full menu',
  },

  popularNow: {
    eyebrow: 'POPULAR RIGHT NOW',
  },

  bundles: {
    heading: 'Combo deals',
  },

  featuredCard: {
    badgeNew: 'NEW',
    badgeDeal: 'DEAL',
  },

  menuSection: {
    eyebrow: 'Menu',
    heading: 'Full menu',
    description: 'Browse by category — pizzas, kebabs, burgers, salads and schnitzels, all made fresh. Tap an item to customize and add it to your order.',
    loading: 'Loading menu...',
    loadError: 'Unable to load menu. Please try again.',
    note: 'Extra toppings 2.50 €: 120 g patty, bacon, cheese, pineapple, blue cheese, onion, egg · Condiments: ketchup, yogurt sauce, pickle, lemon juice, mayonnaise, American sauce, parsley, mint, chili flakes.',
  },

  story: {
    p1: 'ozy.fi started with one oven, one recipe, and a refusal to cut corners on either.',
    p2: "We make every order the same way, every time — fresh dough, hand-portioned toppings, a hot oven — plated the moment it's ready.",
    p3: 'No shortcuts, no frozen bases. Just good ingredients and a kitchen that never really cools down.',
    stat1Label: 'Made to order',
    stat2Label: 'Items on the menu',
    stat3Label: 'Days a week',
  },

  visit: {
    addressHeading: 'Address',
    openingHoursHeading: 'Opening hours',
    contactHeading: 'Contact',
    closed: 'Closed',
    // SEO gap-fill, Part C — shared "this hasn't been configured yet"
    // placeholder for the new /about, /contact, /delivery and /pickup
    // pages (see components/PublicSettingsInfo.tsx and lib/site-settings.ts),
    // used wherever a genuinely real value (address, phone, email, delivery
    // fee, minimum order) is missing from admin_settings rather than
    // showing blank or fabricated text.
    notSet: '[Not set yet — add it in Admin → Settings]',
    days: {
      mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
      fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
    },
    fallbackRows: [
      { label: 'Mon – Thu', value: '3pm – 10pm' },
      { label: 'Fri – Sat', value: '3pm – 11pm' },
      { label: 'Sunday', value: '2pm – 9pm' },
    ],
  },

  ctaStrip: {
    heading: 'Feeling hungry?',
    text: 'Order online for delivery or pickup — ready in under 30 minutes.',
    cta: 'Browse the menu',
  },

  productPage: {
    backAriaLabel: 'Back',
    cartAriaLabel: 'Cart',
    removeOneAriaLabel: 'Remove one',
    addOneAriaLabel: 'Add one',
    size: 'Size',
    medium: 'Medium',
    large: 'Large',
    finishToppings: 'Finish — tap to add toppings',
    bottom: 'Bottom',
    change: 'change',
    select: 'select',
    fillingsHeading: 'Fillings',
    fillingsEmptyHint: 'No fillings added yet — add some from "More fillings" below.',
    moreFillings: 'More fillings',
    sauceStripesHeading: 'Finish with sauce stripes',
    dipHeading: 'Dip the edges',
    selectADip: 'Select a dip',
    productDetailsHeading: 'Product details',
    rawMaterialTitle: 'Raw material information',
    rawMaterialBody: 'All ingredients are sourced from approved suppliers and prepared fresh in-house daily. Allergen and origin information for every topping is available on request at the restaurant, and full ingredient lists are printed on the packaging.',
    nutritionTitle: 'Nutritional information',
    nutritionBody: 'Energy, fat, carbohydrate, sugar, protein and salt values are calculated per 100 g and per portion, and vary slightly depending on the size and toppings you choose. Exact values for your customised order are shown at checkout.',
    climateTitle: 'Climate calculator',
    climateBody: "This item’s estimated carbon footprint is calculated from its ingredients, packaging and preparation method. Choosing plant-based fillings and cheese generally lowers the footprint of your order.",
    loadingOptions: 'Loading options…',
    itemUnavailable: "This item isn't available right now.",
    addToOrder: (price: string) => `Add to order — ${price}`,
    addToBundle: 'Add to bundle',
    addToBundleExtra: (price: string) => `Add to bundle — +${price}`,
    largeUpchargeDetail: (price: string) => `Large (+${price})`,
  },

  bundleModal: {
    backAriaLabel: 'Back',
    backToBundle: '← back to bundle',
    chooseItem: 'Choose an item',
    added: 'added',
    included: 'Included',
    choose: 'Choose',
    remove: 'remove',
    chooseItemBtn: (label: string) => `+ Choose ${label}`,
    item: 'item',
    fillEverySlot: 'Fill every slot to continue',
    addBundleToOrder: (price: string) => `Add bundle to order — ${price}`,
  },

  drinkUpsell: {
    titleLine1: 'Pepsi or',
    titleLine2: 'Pepsi Max?',
    noThanks: 'No thanks',
  },

  checkout: {
    stepCart: 'Cart',
    stepDetails: 'Details',
    stepPayment: 'Payment',
    backAriaLabel: 'Back',
    closeAriaLabel: 'Close',
    title: 'Your order',
    itemsCount: (n: number) => `${n} item${n !== 1 ? 's' : ''} in your order`,
    emptyCart: 'Your cart is empty. Add something tasty from the menu first.',
    backToMenu: 'Back to menu',
    reviewOrder: 'Review your order',
    total: 'Total',
    remove: 'Remove',
    coldDrink: 'A cold drink on the side?',
    inCart: (n: number) => `In cart · ${n}`,
    orderDetails: 'Order details',
    fullName: 'First name and last name',
    deliveryAddress: 'Delivery address',
    deliveryAddressPlaceholder: 'Street, house number, city',
    postalCode: 'Postal code',
    postalCodePlaceholder: 'e.g. 01600',
    emailOptional: 'Email address (optional)',
    emailPlaceholder: 'you@example.com (optional)',
    phone: 'Phone',
    phonePlaceholder: '040 123 4567',
    additionalInfo: 'Additional information for the restaurant',
    additionalInfoPlaceholder: 'e.g. door code, floor, company, food allergy',
    errorName: 'Please enter your full name.',
    errorAddress: 'Please enter your delivery address.',
    errorPostalCode: 'Please enter a valid 5-digit postal code.',
    errorEmail: 'Please enter a valid email address.',
    errorPhone: 'Please enter a valid Finnish phone number (e.g. 040 123 4567).',
    couponPlaceholder: 'Coupon code',
    couponApply: 'Apply',
    couponChecking: 'Checking…',
    couponApplied: (code: string, amount: string) => `${code} applied — −${amount}`,
    couponRemove: 'Remove',
    couponGenericError: 'This coupon code is not valid.',
    couponNetworkError: 'Could not check this coupon right now. Please try again.',
    paymentMethodHeading: 'Payment method',
    cod: 'Cash on delivery',
    codDesc: 'Pay when your order arrives',
    card: 'Card',
    cardDesc: 'Card, Google Pay or Apple Pay',
    cardGenericError: 'Payment could not be completed. Please check your card details and try again.',
    cardUnavailableError: 'Card payment is temporarily unavailable. Please choose Cash on delivery, or try again shortly.',
    // Audit-fixes brief, Part 1 — once a card PaymentIntent has been
    // created, back navigation is locked (see CheckoutModal.tsx) so the
    // order/address it's tied to can't silently drift from what's shown.
    // This is the one explicit way out of that state.
    paymentLockedNotice: 'Your order is locked in while you finish paying. To change anything, cancel and start over.',
    cancelPaymentAction: 'Cancel and start over',
    cancellingPayment: 'Cancelling…',
    // Audit-fixes brief, Part 6.3 — small trust signal shown next to the
    // card form itself (components/CardPaymentStep.tsx).
    securePaymentNotice: 'Secure payment',
    continue: 'Continue',
    continueWithTotal: (total: string) => `Continue — ${total}`,
    placeOrder: (total: string) => `Place order — ${total}`,
    genericOrderError: 'Could not place order. Please try again.',
    storeClosedError: "We're temporarily closed and not taking orders right now. Please check back soon.",
    ready: 'Ready',
    allDrinks: 'All drinks',
    dipsShortcut: 'Dip the edges',
    snacks: 'Snacks',
    added: 'Added',
    // Growth features (Feature 2 — first-order welcome discount).
    // `amountText` is a pre-formatted "10%" or "2.00 €" (shared
    // discount-value pattern — see lib/pricing.ts's describeDiscountValue
    // and header.scheduledOfferBanner's comment above for why this is no
    // longer always a raw percentage).
    welcomeDiscountBanner: (amountText: string) => `🎉 First order? Enjoy ${amountText} off — applied automatically at checkout!`,
    // Growth features batch 2 (Feature 5) — shown instead of the welcome
    // banner above when a scheduled offer is active and more favorable
    // (see CheckoutModal.tsx's bestAutoDiscount). `label` is plain
    // admin-entered text, never a hardcoded campaign name.
    scheduledOfferBanner: (label: string, amountText: string) => `🔥 ${label}: ${amountText} off — applied automatically at checkout!`,
  },

  confirm: {
    eyebrow: 'Order placed',
    thanks: (name: string | undefined) => `Thanks${name ? `, ${name}` : ''}! Your order is on its way.`,
    eta: 'Estimated ready time: 25–35 minutes',
    couponApplied: (amount: string) => `Coupon applied: −${amount}`,
    // Growth features (Feature 2 — first-order welcome discount).
    welcomeDiscountApplied: (amount: string) => `First-order discount applied: −${amount}`,
    // Growth features batch 2 (Feature 5) — shown instead of
    // welcomeDiscountApplied when the applied discount was a scheduled
    // offer. `label` is the admin-entered offer name.
    scheduledOfferApplied: (label: string, amount: string) => `${label} discount applied: −${amount}`,
    // Stamp-card redesign — shown in the same top discount-message slot as
    // welcomeDiscountApplied/scheduledOfferApplied/couponApplied above,
    // when the stamp-card reward is what won this order's discount.
    stampCardApplied: (amount: string) => `Stamp-card reward applied: −${amount}`,
    codNote: (total: ReactNode) => (
      <>Pay <b>{total}</b> by cash on delivery when your order arrives.</>
    ),
    // Part A (order confirmation screen) — shown instead of codNote when
    // paymentMethod is 'card', so a customer who already paid by card
    // isn't told to pay cash on delivery.
    cardPaidNote: (total: ReactNode) => (
      <>Paid <b>{total}</b> — thank you!</>
    ),
    saveOrderNumber: (trackLink: ReactNode) => (
      <>Save your order number — you can check its status anytime on our {trackLink} page.</>
    ),
    trackLinkText: 'Track order',
    continueShopping: 'Continue shopping',
    // Growth features (Feature 3 — stamp card / loyalty), redesigned —
    // see app/api/orders/route.ts and worker/migrations/
    // 010_stamp_card_redesign_and_source_tracking.sql. The reward is now
    // applied directly (no code to show), or banked as a pending reward
    // for a future order — replaces the old loyaltyReward (which showed a
    // copyable code every Nth order).
    stampCardRewardApplied: '🎁 Your stamp-card reward was applied to this order!',
    stampCardPendingEarned: (count: number) =>
      `🎉 Congrats on your ${count}${count === 1 ? 'st' : count === 2 ? 'nd' : count === 3 ? 'rd' : 'th'} order! We'll apply your stamp-card reward automatically the next time you order an eligible item.`,
    loyaltyProgress: (count: number, remaining: number) =>
      `This is your ${count}${count === 1 ? 'st' : count === 2 ? 'nd' : count === 3 ? 'rd' : 'th'} order — ${remaining} more for a reward!`,
    copyCode: 'Copy code',
    codeCopied: 'Copied!',
    // Growth features batch 2 (Feature 6 — "Ozy Wow Moment"). Deliberately
    // distinct wording/emoji from the stamp-card messages above, and
    // rendered in its own block (see ConfirmModal.tsx) so the two can
    // never visually collide when both fire on the same order. Still
    // shows a copyable code (unlike the redesigned stamp-card reward
    // above) — Wow Moment itself is unchanged by the stamp-card redesign.
    wowMomentReward: '✨ Wow Moment! You’ve won a surprise reward for your next order:',
  },

  // Part B (Stripe return_url / redirect handling) — /checkout-return, the
  // page a customer lands on after a redirect-based payment method (some
  // Google Pay/Apple Pay flows on mobile) sends them back here instead of
  // resolving in-page. Separate from `confirm` above because the possible
  // outcomes here are different (a redirect can come back processing or
  // failed, not just succeeded) and none of this page's copy applies to
  // the ordinary in-page card flow at all.
  checkoutReturn: {
    checkingTitle: 'Checking your payment…',
    checkingMessage: 'One moment while we confirm your payment with Stripe.',
    processingTitle: 'Payment processing',
    processingMessage: 'Your payment is still being processed. We’ll update your order as soon as it’s confirmed — you can check its status anytime on the Track order page.',
    failedTitle: 'Payment not completed',
    failedMessage: 'This payment didn’t go through, so your order hasn’t been placed. Please try again.',
    errorTitle: 'Something went wrong',
    errorMessage: 'We couldn’t confirm your payment status here. If you’re not sure whether your order went through, please check the Track order page or contact us before trying again.',
    // Fallback for the rare case a successful payment's PaymentIntent
    // didn't carry an order number (should not normally happen — see
    // app/api/orders/route.ts's paymentIntents.create metadata) — still
    // confirms the charge succeeded without claiming an order number we
    // don't actually have.
    successNoOrderNumMessage: 'Your payment went through — thank you! If your order number doesn’t appear here, you can look up your order by phone number on the Track order page.',
    backToMenu: 'Back to menu',
    trackOrderLink: 'Track order',
  },

  track: {
    eyebrow: 'Order status',
    heading: 'Track your order',
    desc: 'Enter your order number (from your confirmation) and the phone number you used at checkout.',
    orderNumberLabel: 'Order number',
    orderNumberPlaceholder: 'e.g. OZY-AB123456',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'The number you used at checkout',
    trackOrderBtn: 'Track order',
    lookingUp: 'Looking up your order…',
    fillBothFields: 'Please enter both your order number and phone number.',
    notFoundError: "We couldn't find an order matching that number and phone. Double-check both and try again.",
    genericError: 'Something went wrong. Please try again in a moment.',
    dontHaveOrderNumber: "Don't have your order number?",
    backToOrderNumber: '← I have my order number',
    recentOrdersHint: 'Order from this device recently?',
    findMyOrders: 'Find my orders',
    searching: 'Searching…',
    noPhoneMatches: "We couldn't find any recent orders for that phone number.",
    recentOrdersForNumber: 'Recent orders for this number',
    placedAt: (date: string) => `Placed ${date}`,
    estimatedReadyBy: (time: string) => <>Estimated ready by <strong>{time}</strong></>,
    minutesLeftSoon: 'should be ready any moment now',
    minutesLeftOne: 'about 1 min left',
    minutesLeft: (n: number) => `about ${n} min left`,
    cancelledNotice: 'This order was cancelled of that’s unexpected, please call us.'.replace('of that', 'If that'),
    stepReceived: 'Order received',
    stepPreparing: 'Preparing',
    stepOnTheWay: 'On the way',
    stepDelivered: 'Delivered',
    deliveringTo: (addr: string, method: string) => `Delivering to ${addr} · ${method}`,
    codPaymentLabel: 'Cash on delivery',
    trackDifferentOrder: '← Track a different order',
    // Growth features (Feature 1 — reorder).
    reorderButton: 'Reorder this',
    reorderLoading: 'Preparing your reorder…',
    reorderGenericError: 'Could not reorder right now. Please try again.',
    reorderReadyNotice: (n: number) => `${n} item${n !== 1 ? 's' : ''} added to your cart at today's prices.`,
    reorderSkippedNotice: (n: number) => `${n} item${n !== 1 ? 's are' : ' is'} no longer available and ${n !== 1 ? 'were' : 'was'} skipped. The rest is ready in your cart.`,
    reorderContinue: 'Continue to checkout',
  },

  legal: {
    lastUpdated: (date: string) => `Last updated: ${date}`,
  },

  privacy: {
    title: 'Privacy Policy',
    metaTitle: 'Privacy Policy — ozy.fi',
    lastUpdated: '6 September 2026',
    intro: 'ozy.fi ("we", "us") respects your privacy. This page explains what personal data we collect when you order food through this website, why we collect it, and what rights you have under the EU General Data Protection Regulation (GDPR).',
    s1Title: '1. Who we are',
    s1CompanyPlaceholder: '[Company name / Y-tunnus — fill in]',
    s1AddressPlaceholder: '[Business address — fill in]',
    s2Title: '2. What data we collect',
    s2Intro: 'When you place an order, we collect:',
    s2Items: ['Full name', 'Delivery address', 'Email address', 'Phone number', 'Order contents and any notes you add (e.g. allergies, door code)'],
    s3Title: '3. Why we collect it',
    s3Items: ['To prepare and deliver your order', 'To contact you about your order if needed', 'To keep records required for accounting and tax purposes'],
    s3Outro: 'We do not sell your personal data to third parties.',
    s4Title: '4. How long we keep it',
    s4Body: 'Order records are kept for as long as required by Finnish accounting law (currently 6 years), after which they are deleted.',
    s5Title: '5. Your rights',
    s5Intro: 'Under GDPR, you have the right to:',
    s5Items: ['Ask what personal data we hold about you', 'Ask us to correct inaccurate data', 'Ask us to delete your data, where legally possible', 'Object to how your data is used'],
    s5Outro: 'To exercise any of these rights, email hello@ozy.fi.',
    s6Title: '6. Cookies',
    s6Body: "This site uses technical cookies/local storage needed to keep items in your cart while you order, and to remember your cookie preference. With your permission (given via the cookie banner), it may also use cookies from Google Analytics, Meta, TikTok, and Microsoft Clarity to measure site traffic and advertising performance. You can withdraw this permission at any time by clearing your browser's site data, which will show the cookie banner again.",
    s7Title: '7. Contact',
    s7Body: 'Questions about this policy? Email hello@ozy.fi.',
  },

  terms: {
    title: 'Terms & Conditions',
    metaTitle: 'Terms & Conditions — ozy.fi',
    lastUpdated: '6 September 2026',
    s1Title: '1. Orders',
    s1Body: 'By placing an order on ozy.fi, you confirm the delivery details you provide (name, address, phone, email) are correct. We prepare your order once it is placed and cannot guarantee changes after submission — please call us if something needs correcting.',
    s2Title: '2. Prices & payment',
    s2Body: 'All prices are shown in euros (€) and include VAT where applicable. Payment is currently by cash on delivery only, paid directly to the delivery driver.',
    s3Title: '3. Delivery',
    s3Body: 'Estimated delivery/ready times shown at checkout are approximate and may vary depending on order volume, weather, and traffic.',
    s4Title: '4. Allergies & food information',
    s4Body: 'Please note any allergies or dietary requirements in the "Additional information" field at checkout. While we take care with ingredients, our kitchen handles common allergens (gluten, dairy, nuts) and cannot guarantee an allergen-free environment.',
    s5Title: '5. Cancellations',
    s5Body: 'To cancel or change an order, please call us as soon as possible. Once preparation has started, we may not be able to cancel.',
    s6Title: '6. Liability',
    s6Body: 'ozy.fi is not liable for delays or issues caused by circumstances outside our reasonable control (e.g. severe weather, traffic disruption).',
    s7Title: '7. Contact',
    s7Body: 'Questions about these terms? Email hello@ozy.fi.',
  },

  // SEO gap-fill, Part C — the 4 new pages the spec's subset calls for.
  // Structure/labels only; real address/phone/email/hours/fee/minimum-
  // order/delivery-area values are never written here — they're read live
  // from admin_settings at request time (lib/site-settings.ts), with
  // `visit.notSet` shown for anything not yet configured, and the "our
  // story"/pickup-ordering blocks below are explicit, visibly-marked
  // placeholders rather than invented copy (see this feature's delivery
  // report for the full list of what still needs the business owner's
  // real content).
  about: {
    metaTitle: 'About — ozy.fi',
    title: 'About ozy.fi',
    // No separate intro string — reuses t.footer.tagline (same "Pizza,
    // kebab and burgers, made fresh." copy already published site-wide)
    // rather than a near-duplicate that could drift out of sync with it.
    storyHeading: 'Our story',
    storyPlaceholder: 'Placeholder — add ozy.fi’s real story here: how it started, what makes it different, and anything else worth sharing with customers.',
    findUsHeading: 'Find us',
  },

  contact: {
    metaTitle: 'Contact — ozy.fi',
    title: 'Contact us',
    intro: 'Questions about an order, delivery, or anything else? Here’s how to reach us.',
  },

  delivery: {
    metaTitle: 'Delivery — ozy.fi',
    title: 'Delivery',
    intro: 'Ordering for delivery? Here’s what to expect.',
    feeLabel: 'Delivery fee',
    minOrderLabel: 'Minimum order',
    areaHeading: 'Delivery area',
    // Matches what app/api/orders/route.ts actually does with
    // admin_settings.delivery_postal_codes: entries of 3 characters or
    // fewer match by prefix (e.g. "00" covers every 00xxx code), longer
    // entries match a full postal code exactly.
    areaConfiguredIntro: 'We currently deliver to these postal codes (a short entry like "00" covers every code starting with it):',
    areaUnset: 'No delivery-area restriction is currently configured — enter your address at checkout and we’ll confirm it there.',
  },

  pickup: {
    metaTitle: 'Pickup — ozy.fi',
    title: 'Pickup',
    intro: 'Prefer to collect your order yourself? Here’s where and when.',
    locationHeading: 'Pickup location',
    hoursHeading: 'Pickup hours',
    orderingPlaceholder: 'Placeholder — confirm exactly how a customer should place a pickup order today. Checkout currently only collects a delivery address, with no pickup option yet, so this needs the business owner’s input before this page can tell customers how to actually order for pickup.',
  },

  error: {
    heading: 'Something went wrong',
    body: 'That page hit a snag. Please try again — if it keeps happening, head back to the homepage.',
    tryAgain: 'Try again',
    goHome: 'Go to homepage',
  },

  faq: {
    metaTitle: 'FAQ — Delivery, Payment & Ordering | ozy.fi',
    title: 'Frequently asked questions',
    intro: 'Quick answers about delivery, payment, and ordering from ozy.fi in Helsinki. Can\'t find what you\'re looking for? Contact us directly.',
    items: [
      {
        q: 'Which areas do you deliver to?',
        a: 'We deliver to a set list of Helsinki postal codes. Enter your postal code at checkout and we\'ll let you know right away if your address is within our delivery area.',
      },
      {
        q: 'How much is delivery?',
        a: 'The delivery fee is shown clearly in your cart before you confirm the order — no surprise charges added afterward.',
      },
      {
        q: 'Is there a minimum order amount?',
        a: 'Yes, a minimum order amount applies for delivery. It\'s shown in your cart, along with how much more you\'d need to add to reach it, if anything.',
      },
      {
        // Audit-fixes brief, Part 2 — this answer (and its FAQPage JSON-LD
        // rendering, app/(site)/[locale]/faq/page.tsx) previously said card
        // payment was "coming soon", even though it's been live for a
        // while. Kept in sync with the actual payment-method picker in
        // components/CheckoutModal.tsx (exactly two options: 'cod' and
        // 'card', the latter described there as "Card, Google Pay or Apple
        // Pay") rather than assuming — if that picker ever changes, update
        // this answer to match rather than the other way around.
        q: 'How can I pay?',
        a: 'You can pay by card, Google Pay, or Apple Pay online when you check out, or choose cash on delivery and pay the driver when your order arrives.',
      },
      {
        q: 'How long does delivery take?',
        a: 'Most orders arrive within 30-45 minutes, depending on how busy we are and your distance from the restaurant. You\'ll see an estimated time when you place your order.',
      },
      {
        q: 'Can I track my order?',
        a: 'Yes — after ordering, use our order tracking page with your order number and phone number to see its current status.',
      },
      {
        q: 'Can I customize toppings, or ask about allergies?',
        a: 'Yes, every pizza, kebab, and burger can be customized with your choice of base, sauce, cheese, and toppings when you order. For specific allergy questions, please contact us directly before ordering.',
      },
      {
        q: 'Can I change or cancel my order after placing it?',
        a: 'Please call us as soon as possible — we can often make changes if your order hasn\'t started preparing yet, but we can\'t guarantee it once the kitchen has started.',
      },
    ],
  },

  notFound: {
    heading: 'Page not found',
    body: "The page you're looking for doesn't exist or has moved.",
    goHome: 'Go to homepage',
  },

  // Per-order invoice (admin panel, app/admin/orders/[id]/invoice) — the
  // one admin-panel surface that's bilingual, since unlike the rest of
  // the (deliberately English-only, internal-tool) admin UI, this page
  // can be printed/downloaded and handed straight to a customer.
  invoice: {
    documentTitle: 'Invoice',
    orderNumber: 'Order number',
    orderDate: 'Order date',
    customer: 'Customer',
    itemsHeading: 'Items',
    columnItem: 'Item',
    columnQty: 'Qty',
    columnUnitPrice: 'Unit price',
    columnLineTotal: 'Line total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    adjustment: 'Delivery / other adjustment',
    total: 'Total',
    paymentMethod: 'Payment method',
    paymentStatus: 'Payment status',
    vatNote: 'Prices include VAT where applicable.',
    printButton: 'Print / Save as PDF',
    backToOrder: '← Back to order',
    loading: 'Loading invoice…',
    notFound: 'Could not load this order.',
    forbidden: "You don't have access to invoices — ask a manager or the owner.",
    signInRequired: 'Please sign in to view this invoice.',
    discountSourceLabel: {
      manual_coupon: 'Coupon code',
      referral: 'Referral reward',
      first_order_welcome: 'First order discount',
      stamp_card: 'Stamp card reward',
      scheduled_offer: 'Special offer',
    } as Record<string, string>,
    paymentMethodLabel: {
      cod: 'Cash on delivery',
      card: 'Card',
    } as Record<string, string>,
  },

  languageSwitcher: {
    fi: 'Suomi',
    en: 'English',
    ariaLabel: 'Change language',
  },
};

export default en;
