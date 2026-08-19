import { STATIC_CSS } from "./static-style.mjs";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safeUrl = (value = "") => {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? escapeHtml(url.href) : "#";
  } catch {
    return "#";
  }
};

const fontStyle = (value) => {
  const size = Number(value);
  return Number.isFinite(size) && size >= 9 && size <= 96 ? ` style="font-size:${size}px"` : "";
};

const renderMedia = (media, assetMap) => {
  if (!media) return "";
  const asset = (media.assetId ? assetMap.get(media.assetId) : null) || (media.src ? assetMap.get(media.src) : null);
  if (asset && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(asset.dataUrl || "")) {
    return `
      <figure class="media-frame">
        <button type="button" class="zoom-button" aria-label="${escapeHtml(media.alt)} 크게 보기">
          <img src="${escapeHtml(asset.dataUrl)}" alt="${escapeHtml(media.alt)}" loading="lazy">
        </button>
        <figcaption><strong${fontStyle(media.labelFontSize)}>${escapeHtml(media.label)}</strong><span${fontStyle(media.captionFontSize)}>${escapeHtml(media.caption)}</span></figcaption>
      </figure>`;
  }
  return `
    <figure class="media-placeholder">
      <span class="format-mark">${escapeHtml(media.format || "IMAGE")}</span>
      <figcaption><strong${fontStyle(media.labelFontSize)}>이미지 준비 중 · ${escapeHtml(media.label)}</strong><span${fontStyle(media.captionFontSize)}>${escapeHtml(media.captureGuide || media.caption)}</span></figcaption>
    </figure>`;
};

const renderStep = (step, index, assetMap) => {
  const bullets = (step.bullets || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const toneLabels = { info: "참고", tip: "팁", warning: "주의", danger: "중요" };
  const callout = step.callout
    ? `<aside class="callout ${escapeHtml(step.callout.tone)}"><span class="callout-label">${toneLabels[step.callout.tone] || "참고"}</span><div><strong${fontStyle(step.callout.titleFontSize)}>${escapeHtml(step.callout.title)}</strong><p${fontStyle(step.callout.textFontSize)}>${escapeHtml(step.callout.text)}</p></div></aside>`
    : "";
  return `
    <article class="step-card">
      <div class="step-heading"><span>${index + 1}</span><div><h3${fontStyle(step.titleFontSize)}>${escapeHtml(step.title)}</h3><p${fontStyle(step.bodyFontSize)}>${escapeHtml(step.body)}</p></div></div>
      ${renderMedia(step.media, assetMap)}
      ${bullets ? `<ul class="bullet-list"${fontStyle(step.bulletFontSize)}>${bullets}</ul>` : ""}
      ${callout}
    </article>`;
};

const renderSection = (section, assetMap, showSources) => {
  const platforms = (section.platforms || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const steps = (section.steps || []).map((step, index) => renderStep(step, index, assetMap)).join("");
  const sources = (section.sources || [])
    .map((source) => `<a href="${safeUrl(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>`)
    .join("");
  return `
    <section class="manual-section" id="${escapeHtml(section.id)}" data-searchable>
      <header class="section-heading">
        <span class="section-number">${escapeHtml(section.number)}</span>
        <div><p class="section-eyebrow">${escapeHtml(section.eyebrow)}</p><h2${fontStyle(section.titleFontSize)}>${escapeHtml(section.title)}</h2><p${fontStyle(section.summaryFontSize)}>${escapeHtml(section.summary)}</p></div>
      </header>
      <div class="section-meta"><strong>${escapeHtml(section.audience)}</strong>${platforms}<span>${escapeHtml(section.duration)}</span></div>
      <div class="steps">${steps}</div>
      ${showSources && sources ? `<details class="sources"><summary>공식 참고 자료</summary><div>${sources}</div></details>` : ""}
    </section>`;
};

export function generateStaticHtml(manual, assets = []) {
  const settings = manual.settings || {};
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const brandAsset = settings.brandLogo ? assetMap.get(settings.brandLogo) : null;
  const brandMarkup = brandAsset && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(brandAsset.dataUrl || "")
    ? `<img class="brand-logo" src="${escapeHtml(brandAsset.dataUrl)}" alt="${escapeHtml(settings.company)} 로고">`
    : `<span class="brand-mark">S</span>`;
  const navigation = (manual.sections || [])
    .map((section) => `<a href="#${escapeHtml(section.id)}"><span>${escapeHtml(section.number)}</span>${escapeHtml(section.title)}</a>`)
    .join("");
  const quickLinks = (manual.quickLinks || [])
    .map((item) => `<a class="quick-card" href="#${escapeHtml(item.sectionId)}"><span>${escapeHtml(item.icon)}</span><strong${fontStyle(item.labelFontSize)}>${escapeHtml(item.label)}</strong><small${fontStyle(item.hintFontSize)}>${escapeHtml(item.hint || "단계별로 보기")}</small></a>`)
    .join("");
  const sections = (manual.sections || []).map((section) => renderSection(section, assetMap, settings.showSources !== false)).join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(settings.subtitle)}">
  <title>${escapeHtml(settings.title)}</title>
  <style>${STATIC_CSS}</style>
</head>
<body style="--font-scale:${Math.max(0.8, Math.min(1.4, Number(settings.fontScale || 100) / 100))}">
  <a class="skip-link" href="#main">본문으로 바로가기</a>
  <header class="topbar"><a class="brand" href="#top">${brandMarkup}${settings.showHeaderLabel !== false ? `<span${fontStyle(settings.headerLabelFontSize)}>${escapeHtml(settings.headerLabel || "사내 Synology NAS 매뉴얼")}</span>` : ""}</a><div class="top-actions"><button type="button" id="printManual">인쇄</button></div></header>
  <div class="layout" id="top">
    <aside class="sidebar" aria-label="매뉴얼 목차">
      <label class="search-label" for="manualSearch">매뉴얼 검색</label>
      <input class="search-input" id="manualSearch" type="search" placeholder="예: 폴더, 비밀번호, 모바일" autocomplete="off">
      <p class="result-count" id="resultCount" aria-live="polite"></p>
      <nav>${navigation}</nav>
      ${settings.showConnectionCard !== false ? `<div class="connection-card"><strong>회사 연결 정보</strong><span>NAS · ${escapeHtml(settings.nasAddress)}</span><span>Team Folder · ${escapeHtml(settings.teamFolder)}</span><span>웹 · ${escapeHtml(settings.driveWebUrl)}</span><span>문의 · ${escapeHtml(settings.support)}</span></div>` : ""}
    </aside>
    <main class="content" id="main">
      <details class="mobile-toc"><summary>매뉴얼 목차</summary><nav>${navigation}</nav></details>
      ${settings.showHero !== false ? `<section class="hero"><p class="eyebrow"${fontStyle(settings.eyebrowFontSize)}>${escapeHtml(settings.eyebrow || "SYNOLOGY DRIVE · USER MANUAL")}</p><h1${fontStyle(settings.heroTitleFontSize)}>${escapeHtml(settings.title)}</h1><p class="hero-copy"${fontStyle(settings.heroSubtitleFontSize)}>${escapeHtml(settings.subtitle)}</p><div class="hero-meta"><span>${escapeHtml(settings.version)}</span><span>최종 확인 ${escapeHtml(settings.lastUpdated)}</span><span>${escapeHtml(settings.verifiedVersion)}</span></div></section>` : ""}
      ${settings.showNotice !== false ? `<div class="notice" role="note"><strong${fontStyle(settings.noticeTitleFontSize)}>${escapeHtml(settings.noticeTitle || "화면이 조금 달라도 괜찮습니다.")}</strong><span${fontStyle(settings.noticeBodyFontSize)}>${escapeHtml(settings.noticeBody || "DSM과 Synology Drive 버전에 따라 메뉴 이름이 다를 수 있습니다.")}</span></div>` : ""}
      ${settings.showQuickLinks !== false ? `<section class="quick-grid" aria-label="주요 작업 바로가기">${quickLinks}</section>` : ""}
      <p class="empty-search" id="emptySearch">검색 결과가 없습니다. 다른 단어로 찾아보세요.</p>
      <div class="section-list">${sections}</div>
      ${settings.showFooter !== false ? `<footer class="footer">${escapeHtml(settings.company)} · ${escapeHtml(settings.title)} · ${escapeHtml(settings.version)} · 문의 ${escapeHtml(settings.support)}</footer>` : ""}
    </main>
  </div>
  <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="이미지 크게 보기"><button type="button" id="closeLightbox" aria-label="닫기">×</button><img id="lightboxImage" alt=""></div>
  <script>
    (function(){
      var input=document.getElementById("manualSearch");
      var sections=Array.prototype.slice.call(document.querySelectorAll("[data-searchable]"));
      var count=document.getElementById("resultCount");
      var empty=document.getElementById("emptySearch");
      var navLinks=Array.prototype.slice.call(document.querySelectorAll(".sidebar nav a,.mobile-toc nav a"));
      var activeSection="";
      function setActiveSection(id){if(!id)return;var changed=activeSection!==id;activeSection=id;navLinks.forEach(function(link){var active=link.getAttribute("href")==="#"+id;link.classList.toggle("active",active);if(active)link.setAttribute("aria-current","location");else link.removeAttribute("aria-current");});if(!changed)return;var sidebar=document.querySelector(".sidebar");var activeLink=sidebar&&sidebar.querySelector('a[href="#'+id+'"]');if(sidebar&&activeLink){var sidebarRect=sidebar.getBoundingClientRect();var linkRect=activeLink.getBoundingClientRect();var targetTop=sidebar.scrollTop+linkRect.top-sidebarRect.top-sidebar.clientHeight/2+linkRect.height/2;sidebar.scrollTo({top:Math.max(0,targetTop),behavior:reducedMotion?"auto":"smooth"});}}
      var reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.body.classList.add("motion-ready");
      if(reducedMotion||!("IntersectionObserver" in window)){sections.forEach(function(section){section.classList.add("is-visible");});}else{
        var revealObserver=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add("is-visible");revealObserver.unobserve(entry.target);}});},{threshold:.06,rootMargin:"0px 0px -8% 0px"});
        sections.forEach(function(section){revealObserver.observe(section);});
      }
      function updateLocation(){if(!sections.length)return;var marker=Math.min(260,window.innerHeight*.32);var nextId=sections[0].id;sections.forEach(function(section){if(section.getBoundingClientRect().top<=marker)nextId=section.id;});if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-4)nextId=sections[sections.length-1].id;setActiveSection(nextId);}
      var scrollFrame=0;function handleScroll(){if(scrollFrame)return;scrollFrame=window.requestAnimationFrame(function(){scrollFrame=0;updateLocation();});}
      window.addEventListener("scroll",handleScroll,{passive:true});document.addEventListener("scroll",handleScroll,{capture:true,passive:true});window.addEventListener("resize",handleScroll);updateLocation();
      function normalize(value){return String(value||"").normalize("NFKC").toLocaleLowerCase("ko-KR");}
      function filter(){var query=normalize(input.value.trim());var visible=0;sections.forEach(function(section){var match=!query||normalize(section.textContent).indexOf(query)!==-1;section.hidden=!match;if(match)visible+=1;});count.textContent=query?visible+"개 장을 찾았습니다.":"";empty.style.display=visible?"none":"block";}
      input.addEventListener("input",filter);
      document.getElementById("printManual").addEventListener("click",function(){window.print();});
      var box=document.getElementById("lightbox");var full=document.getElementById("lightboxImage");var close=document.getElementById("closeLightbox");
      document.querySelectorAll(".zoom-button").forEach(function(button){button.addEventListener("click",function(){var image=button.querySelector("img");full.src=image.src;full.alt=image.alt;box.classList.add("open");close.focus();});});
      function closeBox(){box.classList.remove("open");full.src="";}
      close.addEventListener("click",closeBox);box.addEventListener("click",function(event){if(event.target===box)closeBox();});document.addEventListener("keydown",function(event){if(event.key==="Escape")closeBox();});
    }());
  </script>
</body>
</html>`;
}
