// Finnish UI dictionary — the PRIMARY/default language for this site
// (see the brief: Finnish-area customers searching in Finnish is the
// whole point of this change). Real, hand-written Finnish — not machine
// translation — but this project's assistant is not a native Finnish
// speaker, so lower-confidence strings are flagged in this feature's
// delivery summary rather than guessed silently. Keep this file's shape
// identical to en.js — every key here has a matching key there.

const fi = {
  common: {
    loading: 'Ladataan…',
  },

  header: {
    menu: 'Ruokalista',
    offers: 'Tarjoukset',
    giftCards: 'Lahjakortit',
    trackOrder: 'Seuraa tilausta',
    cartAriaLabel: 'Ostoskori',
    openMenuAriaLabel: 'Avaa valikko',
    storeClosedBanner: 'Olemme tilapäisesti suljettu emmekä ota juuri nyt vastaan uusia tilauksia.',
  },

  footer: {
    tagline: 'Pizzaa, kebabia ja hampurilaisia, tuoreena valmistettuna.',
    pagesHeading: 'Sivut',
    ourStory: 'Tarinamme',
    findUs: 'Löydä meidät',
    contactHeading: 'Yhteystiedot',
    privacyPolicy: 'Tietosuojaseloste',
    terms: 'Käyttöehdot',
    rights: (year) => `© ${year} ozy.fi. Kaikki oikeudet pidätetään.`,
    demoNotice: 'Demosivusto.',
  },

  cookieBanner: {
    dialogAriaLabel: 'Evästesuostumus',
    message: (privacyLink) => (
      <>
        Käytämme evästeitä ja vastaavaa teknistä tallennustilaa sivuston toimintaan ja ostoskorisi sisällön
        säilyttämiseen tilauksen aikana. Luvallasi voimme käyttää evästeitä myös kävijämäärän ja mainonnan
        mittaamiseen. Lisätietoja {privacyLink}ssamme.
      </>
    ),
    privacyPolicyLinkText: 'tietosuojaselosteesta',
    cookieSettings: 'Evästeasetukset',
    necessaryOnly: 'Vain välttämättömät',
    acceptAll: 'Hyväksy kaikki',
    necessaryTitle: 'Välttämättömät',
    necessaryDesc: 'Vaaditaan sivuston toimintaan — ostoskorin sisällön säilyttämiseen ja ylläpitäjänä kirjautumiseen. Aina käytössä, ei voi kytkeä pois.',
    necessaryAriaLabel: 'Välttämätön tallennustila — aina käytössä',
    adsTitle: 'Mainonta ja analytiikka',
    adsDesc: 'Auttaa meitä näkemään, miten sivustoa käytetään, ja mittaamaan mainontaa (Google Analytics, Meta/TikTok, Microsoft Clarity). Pois päältä, ellet valitse alta "Hyväksy kaikki".',
    adsAriaLabel: 'Mainonta ja analytiikka — pois päältä, ellei valita Hyväksy kaikki',
  },

  orderBar: {
    viewOrder: 'Näytä tilaus',
  },

  hero: {
    eyebrow: 'Pizzaa, kebabia ja hampurilaisia',
    titleStart: 'Aloita',
    titleEm: 'tilauksesi',
    reviews: '· yli 320 arvostelua',
    openNow: 'Avoinna nyt',
    etaRange: '25–35 min',
    subtitle: 'Tuoretta taikinaa, valmistettu tilauksesta, aina kuumana. Valitse kategoria tai selaa koko ruokalistaa — kotiinkuljetus tai nouto valitaan kassalla.',
  },

  categories: {
    pizza: 'Pizza',
    kebab: 'Kebab',
    burgers: 'Hampurilaiset',
  },

  menuTeaser: {
    eyebrow: 'JO NÄLKÄ?',
    heading: 'Tuoretta pizzaa, kebabia ja hampurilaisia',
    seeFullMenu: 'Katso koko ruokalista',
  },

  popularNow: {
    eyebrow: 'SUOSITUIMMAT JUURI NYT',
  },

  bundles: {
    heading: 'Yhdistelmätarjoukset',
  },

  featuredCard: {
    badgeNew: 'UUTTA',
    badgeDeal: 'TARJOUS',
  },

  menuSection: {
    eyebrow: 'Ruokalista',
    heading: 'Koko ruokalista',
    description: 'Selaa kategorioittain — pizzat, kebabit, hampurilaiset, salaatit ja leikkeet, kaikki tuoreena valmistettuna. Napauta tuotetta muokataksesi sitä ja lisätäksesi sen tilaukseesi.',
    loading: 'Ladataan ruokalistaa…',
    loadError: 'Ruokalistaa ei voitu ladata. Yritä uudelleen.',
    note: 'Lisätäytteet 2,50 €: 120 g pihvi, pekoni, juusto, ananas, sinihomejuusto, sipuli, kananmuna · Kastikkeet: ketsuppi, jogurttikastike, suolakurkku, sitruunamehu, majoneesi, amerikanmajoneesi, persilja, minttu, chilihiutaleet.',
  },

  story: {
    p1: 'ozy.fi sai alkunsa yhdestä uunista, yhdestä reseptistä ja periaatteesta olla tinkimättä kummastakaan.',
    p2: 'Valmistamme jokaisen tilauksen samalla tavalla, joka kerta — tuoretta taikinaa, käsin annosteltuja täytteitä, kuuma uuni — lautaselle heti kun se on valmis.',
    p3: 'Ei oikoteitä, ei pakastepohjia. Vain hyviä raaka-aineita ja keittiö, joka ei koskaan oikeastaan jäähdy.',
    stat1Label: 'Valmistetaan tilauksesta',
    stat2Label: 'Tuotetta ruokalistalla',
    stat3Label: 'Päivää viikossa',
  },

  visit: {
    addressHeading: 'Osoite',
    openingHoursHeading: 'Aukioloajat',
    contactHeading: 'Yhteystiedot',
    closed: 'Suljettu',
    days: {
      mon: 'Maanantai', tue: 'Tiistai', wed: 'Keskiviikko', thu: 'Torstai',
      fri: 'Perjantai', sat: 'Lauantai', sun: 'Sunnuntai',
    },
    fallbackRows: [
      { label: 'Ma – To', value: '15–22' },
      { label: 'Pe – La', value: '15–23' },
      { label: 'Sunnuntai', value: '14–21' },
    ],
  },

  ctaStrip: {
    heading: 'Nälkä yllätti?',
    text: 'Tilaa verkosta kotiinkuljetuksena tai noutona — valmiina alle 30 minuutissa.',
    cta: 'Selaa ruokalistaa',
  },

  productPage: {
    backAriaLabel: 'Takaisin',
    cartAriaLabel: 'Ostoskori',
    removeOneAriaLabel: 'Poista yksi',
    addOneAriaLabel: 'Lisää yksi',
    size: 'Koko',
    medium: 'Keskikokoinen',
    large: 'Iso',
    finishToppings: 'Viimeistely — napauta lisätäksesi täytteitä',
    bottom: 'Pohja',
    change: 'vaihda',
    select: 'valitse',
    fillingsHeading: 'Täytteet',
    fillingsEmptyHint: 'Täytteitä ei ole vielä lisätty — lisää niitä alta kohdasta "Lisää täytteitä".',
    moreFillings: 'Lisää täytteitä',
    sauceStripesHeading: 'Viimeistele kastikeraidoilla',
    dipHeading: 'Reunatäyte',
    selectADip: 'Valitse reunatäyte',
    productDetailsHeading: 'Tuotetiedot',
    rawMaterialTitle: 'Raaka-ainetiedot',
    rawMaterialBody: 'Kaikki raaka-aineet hankitaan hyväksytyiltä toimittajilta ja valmistetaan tuoreena päivittäin paikan päällä. Allergeeni- ja alkuperätiedot jokaisesta täytteestä ovat saatavilla pyynnöstä ravintolasta, ja täydelliset ainesosaluettelot on painettu pakkaukseen.',
    nutritionTitle: 'Ravintosisältötiedot',
    nutritionBody: 'Energia-, rasva-, hiilihydraatti-, sokeri-, proteiini- ja suola-arvot on laskettu 100 g:aa ja annosta kohden, ja ne vaihtelevat hieman valitsemasi koon ja täytteiden mukaan. Tarkat arvot muokatulle tilauksellesi näytetään kassalla.',
    climateTitle: 'Ilmastolaskuri',
    climateBody: 'Tämän tuotteen arvioitu hiilijalanjälki lasketaan sen raaka-aineiden, pakkauksen ja valmistustavan perusteella. Kasvipohjaisten täytteiden ja juuston valitseminen yleensä pienentää tilauksesi jalanjälkeä.',
    loadingOptions: 'Ladataan vaihtoehtoja…',
    itemUnavailable: 'Tämä tuote ei ole juuri nyt saatavilla.',
    addToOrder: (price) => `Lisää tilaukseen — ${price}`,
    addToBundle: 'Lisää pakettiin',
    addToBundleExtra: (price) => `Lisää pakettiin — +${price}`,
    largeUpchargeDetail: (price) => `Iso (+${price})`,
  },

  bundleModal: {
    backAriaLabel: 'Takaisin',
    backToBundle: '← takaisin pakettiin',
    chooseItem: 'Valitse tuote',
    added: 'lisätty',
    included: 'Sisältyy',
    choose: 'Valitse',
    remove: 'poista',
    chooseItemBtn: (label) => `+ Valitse ${label}`,
    item: 'tuote',
    fillEverySlot: 'Täytä jokainen kohta jatkaaksesi',
    addBundleToOrder: (price) => `Lisää paketti tilaukseen — ${price}`,
  },

  drinkUpsell: {
    titleLine1: 'Pepsi vai',
    titleLine2: 'Pepsi Max?',
    noThanks: 'Ei kiitos',
  },

  checkout: {
    stepCart: 'Ostoskori',
    stepDetails: 'Tiedot',
    stepPayment: 'Maksu',
    backAriaLabel: 'Takaisin',
    closeAriaLabel: 'Sulje',
    title: 'Tilauksesi',
    itemsCount: (n) => (n === 1 ? '1 tuote tilauksessasi' : `${n} tuotetta tilauksessasi`),
    emptyCart: 'Ostoskorisi on tyhjä. Lisää ensin jotain herkullista ruokalistalta.',
    backToMenu: 'Takaisin ruokalistalle',
    reviewOrder: 'Tarkista tilauksesi',
    total: 'Yhteensä',
    remove: 'Poista',
    coldDrink: 'Kylmä juoma kylkeen?',
    inCart: (n) => `Korissa · ${n}`,
    orderDetails: 'Tilauksen tiedot',
    fullName: 'Etu- ja sukunimi',
    deliveryAddress: 'Toimitusosoite',
    deliveryAddressPlaceholder: 'Katu, talon numero, kaupunki',
    emailOptional: 'Sähköpostiosoite (valinnainen)',
    emailPlaceholder: 'sina@esimerkki.fi (valinnainen)',
    phone: 'Puhelin',
    phonePlaceholder: '040 123 4567',
    additionalInfo: 'Lisätietoa ravintolalle',
    additionalInfoPlaceholder: 'esim. ovikoodi, kerros, yritys, ruoka-allergia',
    errorName: 'Anna koko nimesi.',
    errorAddress: 'Anna toimitusosoitteesi.',
    errorEmail: 'Anna kelvollinen sähköpostiosoite.',
    errorPhone: 'Anna kelvollinen suomalainen puhelinnumero (esim. 040 123 4567).',
    couponPlaceholder: 'Alennuskoodi',
    couponApply: 'Käytä',
    couponChecking: 'Tarkistetaan…',
    couponApplied: (code, amount) => `${code} käytössä — −${amount}`,
    couponRemove: 'Poista',
    couponGenericError: 'Tämä alennuskoodi ei ole voimassa.',
    couponNetworkError: 'Alennuskoodia ei voitu tarkistaa juuri nyt. Yritä uudelleen.',
    paymentMethodHeading: 'Maksutapa',
    cod: 'Käteinen toimituksessa',
    codDesc: 'Maksa, kun tilauksesi saapuu',
    continue: 'Jatka',
    continueWithTotal: (total) => `Jatka — ${total}`,
    placeOrder: (total) => `Tilaa — ${total}`,
    genericOrderError: 'Tilausta ei voitu lähettää. Yritä uudelleen.',
    storeClosedError: 'Olemme tilapäisesti suljettu emmekä ota juuri nyt vastaan tilauksia. Käy pian uudelleen.',
    ready: 'Valmis',
    allDrinks: 'Kaikki juomat',
    dipsShortcut: 'Reunatäyte',
    snacks: 'Naposteltavat',
    added: 'Lisätty',
  },

  confirm: {
    eyebrow: 'Tilaus vastaanotettu',
    thanks: (name) => `Kiitos${name ? `, ${name}` : ''}! Tilauksesi on matkalla.`,
    eta: 'Arvioitu valmistumisaika: 25–35 minuuttia',
    couponApplied: (amount) => `Alennuskoodi käytössä: −${amount}`,
    codNote: (total) => (
      <>Maksa <b>{total}</b> käteisellä, kun tilauksesi saapuu.</>
    ),
    saveOrderNumber: (trackLink) => (
      <>Tallenna tilausnumerosi — voit tarkistaa tilauksesi tilan milloin tahansa {trackLink}-sivulla.</>
    ),
    trackLinkText: 'Seuraa tilausta',
    continueShopping: 'Jatka ostoksia',
  },

  track: {
    eyebrow: 'Tilauksen tila',
    heading: 'Seuraa tilaustasi',
    desc: 'Anna tilausnumerosi (vahvistuksestasi) ja puhelinnumero, jota käytit tilatessasi.',
    orderNumberLabel: 'Tilausnumero',
    orderNumberPlaceholder: 'esim. OZY-AB123456',
    phoneLabel: 'Puhelinnumero',
    phonePlaceholder: 'Numero, jota käytit tilatessasi',
    trackOrderBtn: 'Seuraa tilausta',
    lookingUp: 'Haetaan tilaustasi…',
    fillBothFields: 'Anna sekä tilausnumerosi että puhelinnumerosi.',
    notFoundError: 'Emme löytäneet tilausta kyseisellä numerolla ja puhelinnumerolla. Tarkista molemmat ja yritä uudelleen.',
    genericError: 'Jotain meni pieleen. Yritä hetken kuluttua uudelleen.',
    dontHaveOrderNumber: 'Eikö tilausnumero ole tiedossa?',
    backToOrderNumber: '← Minulla on tilausnumero',
    recentOrdersHint: 'Tilasitko äskettäin tällä laitteella?',
    findMyOrders: 'Hae tilaukseni',
    searching: 'Haetaan…',
    noPhoneMatches: 'Emme löytäneet tuoreita tilauksia kyseisellä puhelinnumerolla.',
    recentOrdersForNumber: 'Tämän numeron viimeaikaiset tilaukset',
    placedAt: (date) => `Tilattu ${date}`,
    estimatedReadyBy: (time) => <>Arvioitu valmis <strong>{time}</strong></>,
    minutesLeftSoon: 'pitäisi olla valmis hetkestä hetkeen',
    minutesLeftOne: 'noin 1 min jäljellä',
    minutesLeft: (n) => `noin ${n} min jäljellä`,
    cancelledNotice: 'Tämä tilaus on peruutettu. Jos tämä on odottamatonta, soita meille.',
    stepReceived: 'Tilaus vastaanotettu',
    stepPreparing: 'Valmistetaan',
    stepOnTheWay: 'Matkalla',
    stepDelivered: 'Toimitettu',
    deliveringTo: (addr, method) => `Toimitetaan osoitteeseen ${addr} · ${method}`,
    codPaymentLabel: 'Käteinen toimituksessa',
    trackDifferentOrder: '← Seuraa toista tilausta',
  },

  legal: {
    lastUpdated: (date) => `Päivitetty viimeksi: ${date}`,
  },

  privacy: {
    title: 'Tietosuojaseloste',
    metaTitle: 'Tietosuojaseloste — ozy.fi',
    lastUpdated: '6. syyskuuta 2026',
    intro: 'ozy.fi ("me") kunnioittaa yksityisyyttäsi. Tällä sivulla kerrotaan, mitä henkilötietoja keräämme, kun tilaat ruokaa tämän verkkosivun kautta, miksi keräämme niitä, ja mitä oikeuksia sinulla on EU:n yleisen tietosuoja-asetuksen (GDPR) mukaan.',
    s1Title: '1. Keitä olemme',
    s1CompanyPlaceholder: '[Yrityksen nimi / Y-tunnus — täytettävä]',
    s1AddressPlaceholder: '[Yrityksen osoite — täytettävä]',
    s2Title: '2. Mitä tietoja keräämme',
    s2Intro: 'Kun teet tilauksen, keräämme:',
    s2Items: ['Koko nimen', 'Toimitusosoitteen', 'Sähköpostiosoitteen', 'Puhelinnumeron', 'Tilauksen sisällön ja mahdolliset lisäämäsi huomautukset (esim. allergiat, ovikoodi)'],
    s3Title: '3. Miksi keräämme niitä',
    s3Items: ['Tilauksesi valmistamiseen ja toimittamiseen', 'Sinuun yhteyden ottamiseen tilaukseesi liittyen tarvittaessa', 'Kirjanpito- ja verolainsäädännön edellyttämien tietojen säilyttämiseen'],
    s3Outro: 'Emme myy henkilötietojasi kolmansille osapuolille.',
    s4Title: '4. Kuinka kauan säilytämme tietoja',
    s4Body: 'Tilaustietoja säilytetään niin kauan kuin Suomen kirjanpitolaki edellyttää (nykyisin 6 vuotta), minkä jälkeen ne poistetaan.',
    s5Title: '5. Oikeutesi',
    s5Intro: 'GDPR:n mukaan sinulla on oikeus:',
    s5Items: ['Kysyä, mitä henkilötietoja meillä on sinusta', 'Pyytää meitä korjaamaan virheelliset tiedot', 'Pyytää meitä poistamaan tietosi, mikäli se on lain mukaan mahdollista', 'Vastustaa tietojesi käyttöä'],
    s5Outro: 'Käyttääksesi näitä oikeuksia, lähetä sähköpostia osoitteeseen hello@ozy.fi.',
    s6Title: '6. Evästeet',
    s6Body: 'Tämä sivusto käyttää teknisiä evästeitä/paikallista tallennustilaa, joita tarvitaan ostoskorisi sisällön säilyttämiseen tilauksen aikana sekä evästevalintasi muistamiseen. Luvallasi (evästebannerin kautta annettuna) sivusto voi käyttää myös Google Analyticsin, Metan, TikTokin ja Microsoft Clarityn evästeitä sivuston kävijämäärän ja mainonnan tehokkuuden mittaamiseen. Voit peruuttaa tämän luvan milloin tahansa tyhjentämällä selaimesi sivustokohtaiset tiedot, jolloin evästebanneri näytetään uudelleen.',
    s7Title: '7. Yhteystiedot',
    s7Body: 'Kysyttävää tästä selosteesta? Lähetä sähköpostia osoitteeseen hello@ozy.fi.',
  },

  terms: {
    title: 'Käyttöehdot',
    metaTitle: 'Käyttöehdot — ozy.fi',
    lastUpdated: '6. syyskuuta 2026',
    s1Title: '1. Tilaukset',
    s1Body: 'Tekemällä tilauksen ozy.fi-sivustolla vahvistat, että antamasi toimitustiedot (nimi, osoite, puhelin, sähköposti) ovat oikein. Valmistamme tilauksesi heti sen saavuttua emmekä voi taata muutoksia lähettämisen jälkeen — soita meille, jos jokin tarvitsee korjausta.',
    s2Title: '2. Hinnat ja maksaminen',
    s2Body: 'Kaikki hinnat näytetään euroina (€) ja sisältävät arvonlisäveron soveltuvin osin. Maksutapana on toistaiseksi vain käteinen toimituksessa, maksettuna suoraan kuljettajalle.',
    s3Title: '3. Toimitus',
    s3Body: 'Kassalla näytetyt arvioidut toimitus-/valmistumisajat ovat suuntaa-antavia ja voivat vaihdella tilausmäärän, sään ja liikenteen mukaan.',
    s4Title: '4. Allergiat ja ruokatiedot',
    s4Body: 'Merkitse mahdolliset allergiat tai ruokavaliorajoitukset kassan "Lisätietoa ravintolalle" -kenttään. Vaikka olemme huolellisia ainesosien kanssa, keittiössämme käsitellään yleisiä allergeeneja (gluteeni, maitotuotteet, pähkinät) emmekä voi taata täysin allergeenitonta ympäristöä.',
    s5Title: '5. Peruutukset',
    s5Body: 'Peruuttaaksesi tai muuttaaksesi tilauksen, soita meille mahdollisimman pian. Kun valmistus on aloitettu, emme välttämättä voi enää perua tilausta.',
    s6Title: '6. Vastuunrajoitus',
    s6Body: 'ozy.fi ei vastaa viivästyksistä tai ongelmista, jotka johtuvat kohtuullisen vaikutusvaltamme ulkopuolella olevista olosuhteista (esim. ankarat sääolot, liikennehäiriöt).',
    s7Title: '7. Yhteystiedot',
    s7Body: 'Kysyttävää näistä ehdoista? Lähetä sähköpostia osoitteeseen hello@ozy.fi.',
  },

  error: {
    heading: 'Jokin meni pieleen',
    body: 'Sivun lataamisessa tapahtui virhe. Yritä uudelleen — jos ongelma jatkuu, palaa etusivulle.',
    tryAgain: 'Yritä uudelleen',
    goHome: 'Etusivulle',
  },

  notFound: {
    heading: 'Sivua ei löytynyt',
    body: 'Etsimääsi sivua ei ole olemassa tai se on siirretty.',
    goHome: 'Etusivulle',
  },

  languageSwitcher: {
    fi: 'Suomi',
    en: 'English',
    ariaLabel: 'Vaihda kieltä',
  },
};

export default fi;
