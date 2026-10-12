/**
 * EIA Wexford — Sanity CMS Integration Layer
 * Fetches content from Sanity Content Lake and injects into the existing HTML layout.
 * Falls back to hardcoded HTML content if Sanity is unreachable.
 * 
 * Project: nohg0gpn | Dataset: production
 */

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────
  const PROJECT_ID = 'nohg0gpn';
  const DATASET = 'production';
  const API_VERSION = '2026-09-28';
  const CDN_BASE = `https://cdn.sanity.io`;
  const API_BASE = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`;

  // ── Helpers ───────────────────────────────────────
  function groqFetch(query, params = {}) {
    let url = `${API_BASE}?query=${encodeURIComponent(query)}`;
    for (const [k, v] of Object.entries(params)) {
      url += `&$${k}="${encodeURIComponent(v)}"`;
    }
    return fetch(url).then(r => r.json()).then(d => d.result);
  }

  function imgUrl(ref, width) {
    if (!ref || !ref.asset || !ref.asset._ref) return '';
    const parts = ref.asset._ref.split('-');
    // image-<id>-<WxH>-<format>
    const id = parts[1];
    const dims = parts[2];
    const format = parts[3];
    return `${CDN_BASE}/images/${PROJECT_ID}/${DATASET}/${id}-${dims}.${format}?w=${width || 800}&auto=format`;
  }

  function fileUrl(ref) {
    if (!ref || !ref.asset || !ref.asset._ref) return '';
    const parts = ref.asset._ref.split('-');
    // file-<id>-<format>
    const id = parts[1];
    const format = parts[2];
    return `${CDN_BASE}/files/${PROJECT_ID}/${DATASET}/${id}.${format}`;
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Firebase Config ──────────────────────────────
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCiAKiYF2yVfWO69BthwKWRpy-bqXCh4qw",
    authDomain: "eia-wexford.firebaseapp.com",
    projectId: "eia-wexford",
    storageBucket: "eia-wexford.firebasestorage.app",
    messagingSenderId: "318050987857",
    appId: "1:318050987857:web:6da4f5f5327186ef666d70"
  };

  // ── Fetch & Render All Sections ───────────────────

  async function loadCMS() {
    // 1. Try Firebase Firestore first
    try {
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js");
      const { 
        getFirestore, doc, getDoc, collection, getDocs, query, orderBy 
      } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
      
      const fbApp = initializeApp(FIREBASE_CONFIG, "eia-live-client");
      const db = getFirestore(fbApp);

      const [
        setSnap, heroSnap, aboutSnap, commSetSnap, memCtaSnap, 
        commSnap, eventSnap, galSnap, guideSnap, pillarSnap,
        srvSnap, testSnap, partSnap, statSnap
      ] = await Promise.all([
        getDoc(doc(db, "content", "siteSettings")),
        getDoc(doc(db, "content", "heroSection")),
        getDoc(doc(db, "content", "aboutSection")),
        getDoc(doc(db, "content", "committeeSettings")).catch(() => ({ exists: () => false })),
        getDoc(doc(db, "content", "membershipCta")).catch(() => ({ exists: () => false })),
        getDocs(query(collection(db, "committeeMembers"), orderBy("displayOrder", "asc"))),
        getDocs(query(collection(db, "events"), orderBy("date", "asc"))),
        getDocs(query(collection(db, "galleryItems"), orderBy("displayOrder", "asc"))),
        getDocs(query(collection(db, "localGuidePlaces"), orderBy("number", "asc"))),
        getDocs(query(collection(db, "corePillars"), orderBy("displayOrder", "asc"))).catch(() => ({ empty: true, docs: [] })),
        getDoc(doc(db, "content", "servicesSection")).catch(() => ({ exists: () => false })),
        getDoc(doc(db, "content", "testimonialsSection")).catch(() => ({ exists: () => false })),
        getDoc(doc(db, "content", "partnersSection")).catch(() => ({ exists: () => false })),
        getDoc(doc(db, "content", "statsBand")).catch(() => ({ exists: () => false }))
      ]);

      if (setSnap.exists() || !commSnap.empty) {
        console.log('[EIA CMS] Loading content from Firebase Firestore');
        if (setSnap.exists()) renderSettings(setSnap.data());
        if (heroSnap.exists()) renderHero(heroSnap.data());
        if (aboutSnap.exists()) renderAbout(aboutSnap.data());
        if (memCtaSnap && memCtaSnap.exists()) renderMembership(memCtaSnap.data());

        const members = [];
        commSnap.forEach(d => members.push({ ...d.data(), _id: d.id }));
        if (members.length) {
          const cData = commSetSnap && commSetSnap.exists() ? commSetSnap.data() : {};
          renderCommittee({
            sectionHeading: cData.sectionHeading || "Executive Committee & Office Bearers",
            sectionDescription: cData.sectionDescription || "Introducing the newly elected Executive Committee of Enniscorthy Indian Association for 2026, serving our community with unity, passion, and dedicated volunteer governance.",
            year: cData.year || 2026,
            quoteText: cData.quoteText || "We are proud to introduce the newly elected Executive Committee of Indian Association Enniscorthy for 2026. We look forward to serving our community with unity and dedication.",
            quoteAttribution: cData.quoteAttribution || "— Enniscorthy Indian Association (EIA) Executive Team",
            filterTabs: [
              { label: `All Members (${members.length})`, filterValue: "all" },
              { label: "Executive Officers", filterValue: "officer" },
              { label: "Auditors", filterValue: "auditor" },
              { label: "Members", filterValue: "member" }
            ]
          }, members);
        }

        const events = [];
        eventSnap.forEach(d => {
          const ev = d.data();
          if (ev.isActive !== false) events.push(ev);
        });
        if (events.length) renderEvents(events);

        const gallery = [];
        galSnap.forEach(d => gallery.push(d.data()));
        if (gallery.length) renderGallery(gallery);

        const guide = [];
        guideSnap.forEach(d => guide.push(d.data()));
        if (guide.length) renderGuide(guide);

        const pillars = [];
        if (pillarSnap && !pillarSnap.empty) {
          pillarSnap.forEach(d => pillars.push(d.data()));
          if (pillars.length) renderPillars(pillars);
        }

        if (srvSnap && srvSnap.exists() && srvSnap.data().services) {
          renderServices(srvSnap.data().services);
        }
        if (testSnap && testSnap.exists() && testSnap.data().testimonials) {
          renderTestimonials(testSnap.data().testimonials);
        }
        if (partSnap && partSnap.exists() && partSnap.data().partners) {
          renderPartners(partSnap.data().partners);
        }
        if (statSnap && statSnap.exists() && statSnap.data().stats) {
          renderStats(statSnap.data().stats);
        }

        return; // Successfully rendered from Firebase!
      }
    } catch (fbErr) {
      console.info('[EIA CMS] Firebase load not ready, falling back to Sanity:', fbErr);
    }

    // 2. Fallback to Sanity if Firebase is empty/unconfigured
    try {
      const [
        settings,
        hero,
        about,
        commSettings,
        members,
        pillars,
        guide,
        stats,
        events,
        membership,
        services,
        gallery,
        testimonials,
        partners
      ] = await Promise.all([
        groqFetch('*[_type == "siteSettings"][0]'),
        groqFetch('*[_type == "heroSection"][0]'),
        groqFetch('*[_type == "aboutSection"][0]'),
        groqFetch('*[_type == "committeeSettings"][0]'),
        groqFetch('*[_type == "committeeMember"] | order(displayOrder asc)'),
        groqFetch('*[_type == "corePillar"] | order(displayOrder asc)'),
        groqFetch('*[_type == "localGuidePlace"] | order(number asc)'),
        groqFetch('*[_type == "statsBand"][0]'),
        groqFetch('*[_type == "event" && isActive == true] | order(date asc)'),
        groqFetch('*[_type == "membershipCta"][0]'),
        groqFetch('*[_type == "serviceCard"] | order(displayOrder asc)'),
        groqFetch('*[_type == "galleryItem"] | order(displayOrder asc)'),
        groqFetch('*[_type == "testimonial"] | order(displayOrder asc)'),
        groqFetch('*[_type == "partner"] | order(displayOrder asc)')
      ]);

      if (settings) renderSettings(settings);
      if (hero) renderHero(hero);
      if (about) renderAbout(about);
      if (commSettings && members) renderCommittee(commSettings, members);
      if (pillars && pillars.length) renderPillars(pillars);
      if (guide && guide.length) renderGuide(guide);
      if (stats) renderStats(stats);
      if (events && events.length) renderEvents(events);
      if (membership) renderMembership(membership);
      if (services && services.length) renderServices(services);
      if (gallery && gallery.length) renderGallery(gallery);
      if (testimonials && testimonials.length) renderTestimonials(testimonials);
      if (partners && partners.length) renderPartners(partners);

      console.log('[EIA CMS] Content loaded from Sanity');
    } catch (err) {
      console.warn('[EIA CMS] Sanity fetch failed, using fallback HTML content:', err);
    }
  }

  // ── Site Settings ─────────────────────────────────
  function renderSettings(s) {
    // Nav brand
    const brandName = document.querySelector('.brand-text .name');
    const brandSub = document.querySelector('.brand-text .sub');
    if (brandName) brandName.textContent = s.orgName;
    if (brandSub) brandSub.textContent = s.tagline;

    // Nav CTA
    const navCta = document.querySelector('.nav-cta');
    if (navCta) {
      if (s.navCtaVisible === false || !s.navCtaText) {
        navCta.style.display = 'none';
      } else {
        navCta.style.display = '';
        navCta.textContent = s.navCtaText;
        navCta.href = s.navCtaLink;
      }
    }

    // Logo
    if (s.logo || s.logoUrl) {
      const logoUrl = s.logoUrl || imgUrl(s.logo, 96);
      document.querySelectorAll('.brand-logo, .foot-logo').forEach(img => {
        if (logoUrl) img.src = logoUrl;
      });
    }

    // Footer
    const footDesc = document.querySelector('.foot-desc');
    if (footDesc) footDesc.textContent = s.footerDescription;

    // Footer contact
    const contactItems = document.querySelectorAll('.foot-contact-item');
    if (contactItems[0]) {
      const textNode = contactItems[0].lastChild;
      if (textNode) textNode.textContent = s.address;
    }
    if (contactItems[1] && s.email) {
      const link = contactItems[1].querySelector('a');
      if (link) {
        link.href = `mailto:${s.email}`;
        link.textContent = s.email;
      }
      // Update secondary email text after the link
      const secondaryText = s.secondaryEmail ? ` • ${s.secondaryEmail}` : '';
      const existingText = contactItems[1].childNodes;
      for (let i = existingText.length - 1; i >= 0; i--) {
        if (existingText[i].nodeType === 3 && existingText[i].textContent.includes('•')) {
          existingText[i].textContent = secondaryText;
          break;
        }
      }
    }

    // Footer brand name
    const footBrandName = document.querySelector('.foot-brand .name');
    const footBrandSub = document.querySelector('.foot-brand .sub');
    if (footBrandName) footBrandName.textContent = s.orgName;
    if (footBrandSub) footBrandSub.textContent = s.tagline;

    // Copyright
    const footBottom = document.querySelector('.foot-bottom');
    if (footBottom && s.copyrightText) {
      footBottom.childNodes[0].textContent = s.copyrightText;
    }
  }

  // ── Hero Section ──────────────────────────────────
  function renderHero(h) {
    const kicker = document.querySelector('.hero-kicker-tag');
    if (kicker) kicker.textContent = h.kickerText;

    const h1 = document.querySelector('.hero h1');
    if (h1) {
      h1.innerHTML = `${esc(h.titleLine1)}\n<span class="text-amber">${esc(h.titleLine2)}</span>`;
    }

    // Motto
    const mottoStrip = document.querySelector('.hero-motto-strip');
    if (mottoStrip && h.mottoItems) {
      mottoStrip.innerHTML = h.mottoItems
        .map((m, i) => `<span>${esc(m)}</span>${i < h.mottoItems.length - 1 ? '<span class="dot">•</span>' : ''}`)
        .join('');
    }

    // Lead paragraph
    const lead = document.querySelector('.hero-lead');
    if (lead) lead.textContent = h.leadParagraph;

    // CTA buttons
    const actions = document.querySelector('.hero-actions');
    if (actions && h.ctaButtons) {
      actions.innerHTML = h.ctaButtons
        .filter(btn => btn && btn.visible !== false && btn.label)
        .map(btn =>
          `<a href="${esc(btn.href)}" class="btn ${esc(btn.style)}"${btn.style === 'btn-outline' ? ' style="color:#fff;border-color:rgba(255,255,255,0.35);"' : ''}>${esc(btn.label)}</a>`
        ).join('');
    }

    // Stats
    const statsContainer = document.querySelector('.hero-stats');
    if (statsContainer && h.heroStats) {
      statsContainer.innerHTML = h.heroStats.map(st =>
        `<div class="hero-stat"><div class="num">${esc(st.number)}${esc(st.suffix)}</div><div class="txt">${esc(st.label)}</div></div>`
      ).join('');
    }

    // Background video & poster
    const video = document.querySelector('.hero-bg video');
    const videoSrc = (h.videoFile && fileUrl(h.videoFile)) || h.videoUrl;

    if (video && videoSrc) {
      let source = video.querySelector('source');
      if (source) {
        if (source.getAttribute('src') !== videoSrc) {
          source.setAttribute('src', videoSrc);
          video.load();
          video.play().catch(() => {});
        }
      } else {
        video.setAttribute('src', videoSrc);
        video.load();
        video.play().catch(() => {});
      }
    }

    if (h.backgroundPoster || h.posterUrl) {
      const poster = h.posterUrl || imgUrl(h.backgroundPoster, 1920);
      if (video && poster) video.setAttribute('poster', poster);
      const fallbackImg = document.querySelector('.hero-bg video img');
      if (fallbackImg && poster) fallbackImg.src = poster;
    }
  }

  // ── About Section ─────────────────────────────────
  function renderAbout(a) {
    const kicker = document.querySelector('#about .kicker');
    if (kicker) kicker.textContent = a.kickerText;

    const heading = document.querySelector('.about-main h2');
    if (heading) heading.textContent = a.heading;

    // Paragraphs
    const paragraphs = document.querySelectorAll('.about-main > p');
    if (a.paragraphs) {
      a.paragraphs.forEach((p, i) => {
        if (paragraphs[i]) {
          if (i === 0) {
            paragraphs[i].innerHTML = `<strong>${esc(a.paragraphs[0].split(')')[0])})</strong>${esc(a.paragraphs[0].split(')').slice(1).join(')'))}`;
          } else {
            paragraphs[i].textContent = p;
          }
        }
      });
    }

    // Vision box
    const visionTitle = document.querySelector('.about-vision-box h4');
    if (visionTitle) {
      const svgIcon = visionTitle.querySelector('svg');
      const svgHtml = svgIcon ? svgIcon.outerHTML : '';
      visionTitle.innerHTML = `${svgHtml} ${esc(a.visionTitle)}`;
    }
    const visionQuote = document.querySelector('.about-vision-box p');
    if (visionQuote) visionQuote.textContent = `"${a.visionQuote}"`;

    // About image
    if (a.aboutImage || a.aboutImageUrl) {
      const img = document.querySelector('.about-media img');
      if (img) img.src = a.aboutImageUrl || imgUrl(a.aboutImage, 800);
    }

    // Stat badge
    const statBig = document.querySelector('.about-stat .big');
    const statLbl = document.querySelector('.about-stat .lbl');
    if (statBig) statBig.textContent = a.statBadgeValue;
    if (statLbl) statLbl.textContent = a.statBadgeLabel;

    // CTA
    const cta = document.querySelector('.about-main .ghost');
    if (cta) {
      if (a.ctaVisible === false || !a.ctaText) {
        cta.style.display = 'none';
      } else {
        cta.style.display = '';
        cta.textContent = a.ctaText;
        cta.href = a.ctaHref;
      }
    }
  }

  // ── Committee Section ─────────────────────────────
  function renderCommittee(cs, members) {
    // Section head
    const heading = document.querySelector('#committee .section-head h2');
    if (heading) heading.textContent = cs.sectionHeading;

    const desc = document.querySelector('#committee .section-head p');
    if (desc) desc.textContent = cs.sectionDescription;

    const kicker = document.querySelector('#committee .kicker');
    if (kicker) kicker.textContent = `Leadership • ${cs.year}`;

    // Quote card
    const quoteP = document.querySelector('.comm-quote-card p');
    if (quoteP) quoteP.textContent = `"${cs.quoteText}"`;
    const quoteSm = document.querySelector('.comm-quote-card small');
    if (quoteSm) quoteSm.textContent = cs.quoteAttribution;

    // Filter pills
    const pillsContainer = document.querySelector('#committee .filter-pills');
    if (pillsContainer && cs.filterTabs) {
      pillsContainer.innerHTML = cs.filterTabs.map((tab, i) =>
        `<button${i === 0 ? ' class="active"' : ''} data-cfilter="${esc(tab.filterValue)}">${esc(tab.label)}</button>`
      ).join('');
      // Re-bind filter events
      bindCommitteeFilters();
    }

    // Filter current year members
    const currentMembers = members.filter(m => m.year === cs.year);

    // Committee grid
    const grid = document.getElementById('commGrid');
    if (grid) {
      grid.innerHTML = currentMembers.map(m => {
        const photoSrc = m.photoUrl || (m.photo ? imgUrl(m.photo, 400) : `images/committee_sq/${m.name.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')}.jpg`);
        const badgeClass = m.badgeStyle === 'patron' ? ' patron' : m.badgeStyle === 'president' ? ' president' : '';
        return `
          <div class="comm-card" data-cat="${esc(m.category)}" data-r>
            <div class="comm-photo-wrap">
              <img src="${photoSrc}" alt="${esc(m.name)} — ${esc(m.role)}" loading="lazy">
              <span class="comm-role-badge${badgeClass}">${esc(m.role)}</span>
            </div>
            <div class="comm-info">
              <h4>${esc(m.name)}</h4>
              <span class="designation">${esc(m.role)}</span>
            </div>
          </div>`;
      }).join('');

      // Re-trigger reveal animation for new cards
      grid.querySelectorAll('[data-r]').forEach(el => {
        el.classList.add('vis');
      });
    }
  }

  function bindCommitteeFilters() {
    const btns = document.querySelectorAll('.filter-pills button[data-cfilter]');
    const getCards = () => document.querySelectorAll('.comm-card');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.getAttribute('data-cfilter');
        getCards().forEach(card => {
          card.style.display = (f === 'all' || card.getAttribute('data-cat') === f) ? 'flex' : 'none';
        });
      });
    });
  }

  // ── Core Pillars ──────────────────────────────────
  function renderPillars(pillars) {
    const container = document.querySelector('.prog-cards');
    if (!container) return;

    // Map of curated images by display order
    const curatedPillarImages = [
      'images/pillar-culture-arts.jpg',
      'images/pillar-sports-activities.jpg',
      'images/eia-st-patricks-parade.jpeg',
      'images/eia-beats-chendamelam.jpeg'
    ];

    container.innerHTML = pillars.map((p, i) => {
      let src = p.imageUrl;
      if (!src && p.image) {
        src = imgUrl(p.image, 600);
      }
      if (!src) {
        src = curatedPillarImages[i] || '';
      }
      let descHtml = esc(p.description);
      if (descHtml.includes('EIA Sports and Arts Club (PPN-00677)')) {
        descHtml = descHtml.replace('EIA Sports and Arts Club (PPN-00677)', '<a href="#services" style="color:var(--amber);font-weight:600;">EIA Sports and Arts Club (PPN-00677)</a>');
      } else if (p.title && p.title.toLowerCase().includes('sports')) {
        descHtml = `<a href="#services" style="color:var(--amber);font-weight:600;">EIA Sports and Arts Club (PPN-00677)</a> &mdash; ${descHtml}`;
      }
      return `
        <div class="prog-card" data-r="${(i * 0.1).toFixed(1)}">
          <img src="${src}" alt="${esc(p.title)}" loading="lazy" decoding="async">
          <span class="label">${esc(p.title)}</span>
          <p style="padding:0 20px 20px;font-size:13px;color:rgba(255,255,255,0.7);">${descHtml}</p>
        </div>`;
    }).join('');

    container.querySelectorAll('[data-r]').forEach(el => el.classList.add('vis'));
  }

  // ── Local Guide ───────────────────────────────────
  function renderGuide(places) {
    const grid = document.getElementById('guideGrid');
    if (!grid) return;

    grid.innerHTML = places.map(p => {
      const isDaytrip = p.category === 'daytrip';
      return `
        <div class="guide-card${isDaytrip ? ' daytrip' : ''}" data-gcat="${esc(p.category)}" data-r>
          <div class="guide-card-head">
            <div class="guide-num">${p.number}</div>
            <span class="guide-tag">${esc(p.tag)}</span>
          </div>
          <h4>${esc(p.name)}</h4>
          <p>${esc(p.description)}</p>
          <a href="${esc(p.mapUrl)}" target="_blank" rel="noopener" class="guide-link">
            <span>View on Map →</span>
          </a>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-r]').forEach(el => el.classList.add('vis'));

    // Re-bind guide filters
    const guideFilterBtns = document.querySelectorAll('.filter-pills button[data-gfilter]');
    const guideCards = () => document.querySelectorAll('.guide-card');
    guideFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        guideFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.getAttribute('data-gfilter');
        guideCards().forEach(card => {
          card.style.display = (f === 'all' || card.getAttribute('data-gcat') === f) ? 'flex' : 'none';
        });
      });
    });
  }

  // ── Stats Band ────────────────────────────────────
  function renderStats(s) {
    if (!s.stats) return;
    const container = document.querySelector('.stats-inner');
    if (!container) return;

    container.innerHTML = s.stats.map((st, i) =>
      `<div class="stat-box" data-r="${(i * 0.1).toFixed(1)}">
        <div class="big"><span class="count" data-target="${st.targetNumber}">0</span>${st.suffix ? `<span class="amber">${esc(st.suffix)}</span>` : ''}</div>
        <div class="lbl">${esc(st.label)}</div>
      </div>`
    ).join('');

    // Re-init counter animations
    const counters = container.querySelectorAll('.count');
    const countObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          const target = parseInt(el.dataset.target, 10);
          const duration = 1600;
          const start = performance.now();
          function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(eased * target);
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          countObs.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(el => countObs.observe(el));
    container.querySelectorAll('[data-r]').forEach(el => el.classList.add('vis'));
  }

  // ── Events Section ────────────────────────────────
  function renderEvents(events) {
    const grid = document.querySelector('.event-grid');
    if (!grid) return;

    grid.innerHTML = events.map((ev, i) => {
      const d = new Date(ev.date + 'T00:00:00');
      const day = String(d.getDate()).padStart(2, '0');
      const mo = d.toLocaleString('en', { month: 'short' }).toUpperCase() + ' ' + d.getFullYear();
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

      // Match event specific images
      let src = ev.imageUrl;
      if (!src && ev.title) {
        if (ev.title.includes('Onam')) src = 'images/eia-onam-celebration.jpeg';
        else if (ev.title.includes('Cultural') || ev.title.includes('Indo')) src = 'images/ambassador-manish-gupta.jpeg';
        else if (ev.title.includes('Christmas') || ev.title.includes('New Year')) src = 'images/eia-christmas-celebration.jpeg';
      }
      if (!src) src = ev.image ? imgUrl(ev.image, 700) : (fallbackEventImages[i] || '');

      const ctaText = (ev.ctaLabel && !ev.ctaLabel.toLowerCase().includes('ticket')) ? ev.ctaLabel : 'RSVP / Register';

      return `
        <div class="event-card" data-r="${(i * 0.1).toFixed(1)}">
          <div class="event-art">
            <img src="${src}" alt="${esc(ev.title)}" loading="lazy" decoding="async">
            <div class="event-date">
              <span class="day">${day}</span>
              <span class="mo">${mo}</span>
            </div>
            ${ev.badge ? `<span class="event-badge">${esc(ev.badge)}</span>` : ''}
          </div>
          <div class="event-body">
            <h3>${esc(ev.title)}</h3>
            <p>${esc(ev.description)}</p>
            <div class="event-foot">
              <span>${esc(ev.venue)}</span>
              <button class="btn btn-amber btn-sm" onclick="openEventModal('${esc(ev.title).replace(/'/g, "\\'")}', '${esc(ev.venue || dateStr).replace(/'/g, "\\'")}')">${esc(ctaText)}</button>
            </div>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-r]').forEach(el => el.classList.add('vis'));
  }

  // ── Membership CTA ────────────────────────────────
  function renderMembership(m) {
    const card = document.querySelector('.membership-cta-card');
    if (!card) return;

    const kickerEl = card.querySelector('.hero-kicker-tag');
    if (kickerEl) kickerEl.textContent = m.kickerText;

    const h2 = card.querySelector('h2');
    if (h2) h2.textContent = m.heading;

    const p = card.querySelector('p');
    if (p) p.textContent = m.description;

    const checklist = card.querySelector('.membership-checklist');
    if (checklist && m.checklistItems) {
      checklist.innerHTML = m.checklistItems.map(item => `<span>• ${esc(item)}</span>`).join('');
    }

    const btns = card.querySelector('.membership-cta-btns');
    if (btns) {
      if (m.ctaButtons && Array.isArray(m.ctaButtons) && m.ctaButtons.length > 0) {
        btns.innerHTML = m.ctaButtons
          .filter(b => b && b.visible !== false && b.label)
          .map(b => `<a href="${esc(b.href)}" class="btn ${esc(b.style || 'btn-amber')}">${esc(b.label)}</a>`)
          .join('');
      } else {
        const primary = btns.querySelector('.btn-amber');
        const secondary = btns.querySelector('.btn-outline');
        if (primary) {
          if (m.primaryVisible === false || !m.primaryCtaLabel) primary.style.display = 'none';
          else { primary.style.display = ''; primary.textContent = m.primaryCtaLabel; primary.href = m.primaryCtaHref; }
        }
        if (secondary) {
          if (m.secondaryVisible === false || !m.secondaryCtaLabel) secondary.style.display = 'none';
          else { secondary.style.display = ''; secondary.textContent = m.secondaryCtaLabel; secondary.href = m.secondaryCtaHref; }
        }
      }
    }
  }

  // ── Services Section ──────────────────────────────
  function renderServices(services) {
    const grid = document.querySelector('.services-grid');
    if (!grid) return;

    grid.innerHTML = services.map((s, i) =>
      `<div class="service-card" data-r="${(i * 0.1).toFixed(1)}">
        <div class="service-icon">${s.iconSvg || ''}</div>
        <h4>${esc(s.title)}</h4>
        <p>${esc(s.description)}</p>
        ${s.bulletPoints ? `<ul class="service-list">${s.bulletPoints.map(bp => `<li>${esc(bp)}</li>`).join('')}</ul>` : ''}
      </div>`
    ).join('');

    grid.querySelectorAll('[data-r]').forEach(el => el.classList.add('vis'));
  }

  // ── Gallery Section ───────────────────────────────
  function renderGallery(gallery) {
    const grid = document.getElementById('galGrid');
    if (!grid) return;

    // Fallback images
    const fallbackGalleryImages = [
      'avin-cp-Z9dgBPFSa40-unsplash.jpg',
      'ajin-k-s-0tuzOfs-T3s-unsplash.jpg',
      'vineeth-vinod-NwxSI7wD-gc-unsplash.jpg',
      'manyu-varma-mM6cUV3B9M8-unsplash.jpg',
      'sateesh-reddy-patlolla-ds_bUqGISJA-unsplash.jpg',
      'images (1).jpeg'
    ];

    grid.innerHTML = gallery.map((g, i) => {
      const src = g.imageUrl || (g.image ? imgUrl(g.image, 600) : fallbackGalleryImages[i] || '');
      return `
        <div class="gal-item" data-cat="${esc(g.category)}" onclick="openLightbox('${src.replace(/'/g, "\\'")}', '${esc(g.caption).replace(/'/g, "\\'")}')">
          <img src="${src}" alt="${esc(g.caption)}" loading="lazy" decoding="async">
          <div class="cap"><span>${esc(g.caption)}</span></div>
        </div>`;
    }).join('');

    // Re-bind gallery filters
    const gFilters = document.querySelectorAll('#gFilters button');
    const galItems = () => document.querySelectorAll('#galGrid .gal-item');
    gFilters.forEach(btn => {
      btn.addEventListener('click', () => {
        gFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.dataset.filter;
        galItems().forEach(item => {
          item.classList.toggle('hidden', f !== 'all' && item.dataset.cat !== f);
        });
      });
    });
  }

  // ── Testimonials Section ──────────────────────────
  function renderTestimonials(testimonials) {
    const sec = document.getElementById('memberVoices') || document.querySelector('.testimonials');
    const grid = document.querySelector('.test-grid');
    if (!grid) return;

    if (!testimonials || !Array.isArray(testimonials) || testimonials.length === 0) {
      if (sec) sec.style.display = 'none';
      grid.innerHTML = '';
      return;
    }

    if (sec) sec.style.display = '';
    grid.innerHTML = testimonials.map((t, i) =>
      `<div class="test-card" data-r="${(i * 0.1).toFixed(1)}">
        <blockquote>"${esc(t.quote)}"</blockquote>
        <div class="test-author">
          <div class="av">${esc(t.authorInitial || t.authorName.charAt(0))}</div>
          <div>
            <div class="name">${esc(t.authorName)}</div>
            <div class="role">${esc(t.authorRole)}</div>
          </div>
        </div>
      </div>`
    ).join('');

    grid.querySelectorAll('[data-r]').forEach(el => el.classList.add('vis'));
  }

  // ── Partners Section ──────────────────────────────
  function renderPartners(partners) {
    const container = document.querySelector('.partner-badges');
    if (!container) return;

    container.innerHTML = partners.map(p =>
      `<span class="partner-badge">${esc(p.name)}</span>`
    ).join('');
  }

  // ── Initialize ────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCMS);
  } else {
    loadCMS();
  }

})();
