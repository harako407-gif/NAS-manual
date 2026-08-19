export const STATIC_CSS = String.raw`
:root{--font-scale:1;--ink:#1f2937;--muted:#667085;--subtle:#8a94a3;--line:#dfe3e8;--line-strong:#c8ced6;--paper:#fff;--canvas:#f2f4f6;--navy:#153f70;--deep:#0f2f54;--soft:#f7f8fa;--warning:#fff9ed;--danger:#a92f2f}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:92px}
body{margin:0;background:var(--canvas);color:var(--ink);font-family:Pretendard,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;line-height:1.68;text-rendering:optimizeLegibility}
button,input{font:inherit}a{color:inherit}:focus-visible{outline:3px solid #5b9bd5;outline-offset:3px}
.skip-link{position:fixed;left:16px;top:-80px;z-index:100;padding:10px 14px;background:#fff;color:var(--navy);border:1px solid var(--line-strong)}
.skip-link:focus{top:12px}
.topbar{position:sticky;top:0;z-index:30;height:68px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;background:rgba(255,255,255,.97);color:var(--deep);border-bottom:1px solid var(--line-strong);box-shadow:0 4px 18px rgba(15,47,84,.08)}
.brand{display:flex;align-items:center;gap:12px;color:var(--deep);font-size:calc(15px * var(--font-scale));font-weight:760;text-decoration:none}
.brand-mark{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--line-strong);font-family:Georgia,serif;font-size:15px;font-style:italic}
.brand-logo{width:auto;height:38px;max-width:190px;object-fit:contain;background:transparent;padding:0}
.top-actions button{min-height:38px;padding:7px 12px;border:1px solid var(--line-strong);border-radius:4px;background:#fff;color:var(--deep);font-size:15px;font-weight:760;cursor:pointer}
.layout{max-width:1580px;margin:0 auto;display:grid;grid-template-columns:292px minmax(0,1fr);background:var(--paper)}
.sidebar{position:sticky;top:68px;align-self:start;height:calc(100vh - 68px);padding:30px 22px;background:#fafbfc;border-right:1px solid var(--line);overflow:auto;scroll-behavior:smooth;scrollbar-gutter:stable}
.search-label{display:block;margin-bottom:7px;color:#344054;font-size:15px;font-weight:760}
.search-input{width:100%;min-height:40px;padding:9px 11px;border:1px solid var(--line-strong);border-radius:3px;background:#fff;color:var(--ink)}
.result-count{min-height:20px;margin:6px 1px 0;color:var(--muted);font-size:15px}
.sidebar nav{display:grid;margin:14px 0 28px;border-top:1px solid var(--line)}
.sidebar nav a{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:7px;padding:10px 7px;border-bottom:1px solid var(--line);color:#475467;text-decoration:none;font-size:calc(15px * var(--font-scale));font-weight:680;transition:color .25s ease,background-color .25s ease,transform .25s ease}
.sidebar nav a:hover{color:var(--navy);background:#f3f5f7}
.sidebar nav a.active{color:var(--deep);background:#eaf0f6;font-weight:820;transform:translateX(3px)}
.sidebar nav a.active:after{content:"현재";align-self:center;color:var(--navy);font-size:15px;font-weight:760}
.sidebar nav a.active span{color:var(--navy)}
.sidebar nav a span{color:var(--subtle);font-size:15px;padding-top:3px}
.connection-card{display:grid;gap:6px;padding:15px;background:#fff;color:#475467;border:1px solid var(--line);font-size:15px;overflow-wrap:anywhere}
.connection-card strong{color:var(--deep);margin-bottom:2px}
.mobile-toc{display:none;margin:0 0 24px;border:1px solid var(--line)}
.mobile-toc summary{padding:12px 14px;color:var(--deep);font-size:15px;font-weight:760;cursor:pointer}
.mobile-toc nav{display:grid;border-top:1px solid var(--line)}
.mobile-toc a{padding:9px 14px;border-bottom:1px solid var(--line);color:#475467;text-decoration:none;font-size:15px}
.mobile-toc a.active{color:var(--deep);background:#eaf0f6;font-weight:820}
.mobile-toc a.active:after{content:" · 현재";color:var(--navy)}
.content{min-width:0;padding:54px clamp(28px,5.5vw,82px) 96px;background:#fff}
.hero{padding:34px 0 38px;color:var(--ink);border-bottom:1px solid var(--line-strong)}
.eyebrow{margin:0 0 16px;color:var(--navy);font-size:15px;font-weight:820;letter-spacing:.13em}
.hero h1{max-width:850px;margin:0;color:var(--deep);font-size:clamp(calc(38px * var(--font-scale)),5vw,calc(62px * var(--font-scale)));line-height:1.12;letter-spacing:-.045em}
.hero-copy{max-width:720px;margin:20px 0 24px;color:#596579;font-size:clamp(calc(16px * var(--font-scale)),1.8vw,calc(19px * var(--font-scale)))}
.hero-meta,.section-meta{display:flex;flex-wrap:wrap;align-items:center;color:var(--muted);font-size:15px}
.hero-meta span,.section-meta span,.section-meta strong{font-size:inherit;font-weight:650}
.hero-meta span+span:before,.section-meta>*+*:before{content:"·";margin:0 9px;color:#b1b7c0}
.notice{display:grid;gap:3px;margin:24px 0 0;padding:15px 17px;border:1px solid var(--line);background:#fafbfc;color:#475467;font-size:15px}
.notice strong{color:#344054}
.quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin:42px 0 80px;border-top:1px solid var(--line-strong)}
.quick-card{min-height:88px;display:grid;grid-template-columns:42px 1fr;grid-template-rows:auto auto;align-content:center;column-gap:14px;padding:16px 10px;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none}
.quick-card:nth-child(odd){border-right:1px solid var(--line);padding-right:24px}.quick-card:nth-child(even){padding-left:24px}.quick-card:hover{background:#fafbfc}
.quick-card>span{grid-row:1/3;align-self:center;color:var(--navy);font-size:15px;font-weight:820}.quick-card strong{align-self:end;font-size:calc(15px * var(--font-scale))}.quick-card small{color:var(--muted);font-size:calc(15px * var(--font-scale))}
.section-list{display:grid;gap:96px}.manual-section{scroll-margin-top:96px}
.motion-ready .manual-section{opacity:0;transform:translateY(22px);transition:opacity .55s ease,transform .55s cubic-bezier(.22,1,.36,1)}
.motion-ready .manual-section.is-visible{opacity:1;transform:translateY(0)}
.section-heading{display:grid;grid-template-columns:58px 1fr;gap:18px;padding-bottom:20px;border-bottom:1px solid var(--line-strong)}
.section-number{color:var(--navy);font-size:15px;font-weight:850}.section-number:after{content:"/";margin-left:5px;color:#b8bec6;font-weight:400}
.section-eyebrow{margin:0;color:var(--navy);font-size:15px;font-weight:800;letter-spacing:.09em}
.section-heading h2{max-width:900px;margin:3px 0 0;color:var(--deep);font-size:clamp(calc(26px * var(--font-scale)),3vw,calc(38px * var(--font-scale)));line-height:1.25;letter-spacing:-.035em}
.section-heading p{max-width:760px;margin:7px 0 0;color:var(--muted);font-size:calc(15px * var(--font-scale))}.section-meta{margin:14px 0 16px}
.steps{display:grid}.step-card{padding:42px 0 48px;border-bottom:1px solid var(--line);background:#fff}
.step-heading{display:grid;grid-template-columns:44px minmax(0,760px);gap:15px}
.step-heading>span{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--navy);border-radius:50%;color:var(--navy);font-size:15px;font-weight:820}
.step-heading h3{margin:0;color:#27364a;font-size:clamp(calc(19px * var(--font-scale)),2vw,calc(23px * var(--font-scale)));line-height:1.4;letter-spacing:-.02em}.step-heading p{margin:7px 0 0;color:#596579;font-size:calc(15px * var(--font-scale))}
.media-frame,.media-placeholder{margin:24px 0 0 59px;border-radius:4px;overflow:hidden}
.media-frame{max-width:1120px;border:1px solid var(--line-strong);background:#fff}
.zoom-button{width:100%;min-height:180px;display:grid;place-items:center;padding:18px;border:0;background:#f6f7f8;cursor:zoom-in}
.zoom-button img{display:block;width:auto;max-width:100%;max-height:760px;object-fit:contain}
.media-frame figcaption,.media-placeholder figcaption{display:grid;gap:5px;padding:12px 15px;background:#fff;border-top:1px solid var(--line)}
.media-frame figcaption span,.media-placeholder figcaption span{color:var(--muted);font-size:15px}.media-frame figcaption strong,.media-placeholder figcaption strong{color:#344054;font-size:15px}
.media-placeholder{max-width:960px;min-height:210px;display:grid;grid-template-columns:110px minmax(0,1fr);gap:20px;place-content:center;padding:26px;border:1px dashed #b8c0ca;background:#fafbfc}
.format-mark{width:64px;height:64px;display:grid;place-items:center;align-self:center;border:1px solid var(--line-strong);color:#596579;font-size:15px;font-weight:800}
.bullet-list{max-width:780px;display:grid;gap:7px;margin:20px 0 0 59px;padding-left:19px;color:#475467;font-size:calc(15px * var(--font-scale))}.bullet-list li::marker{color:#7c8796}
.callout{max-width:820px;display:grid;grid-template-columns:54px 1fr;gap:14px;margin:22px 0 0 59px;padding:14px 16px;border:1px solid var(--line-strong);background:#fafbfc}
.callout-label{color:#596579;font-size:15px;font-weight:820;letter-spacing:.05em}.callout strong{display:block;color:#344054;font-size:15px}.callout p{margin:3px 0 0;color:#596579;font-size:15px}
.callout.warning{background:var(--warning)}.callout.danger{border-color:#d8b4b4;background:#fffafa}.callout.danger .callout-label{color:var(--danger)}
.sources{margin-top:18px;color:#596579;font-size:15px}.sources summary{cursor:pointer;font-weight:740}.sources div{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}.sources a{color:var(--navy)}
.empty-search{display:none;margin:30px 0;padding:34px;text-align:center;border:1px solid var(--line);background:#fafbfc;color:var(--muted)}
.footer{margin-top:90px;padding:26px 0 8px;border-top:1px solid var(--line-strong);color:var(--muted);font-size:15px}
.lightbox{position:fixed;inset:0;z-index:80;display:none;place-items:center;padding:30px;background:rgba(5,13,23,.94)}.lightbox.open{display:grid}
.lightbox img{max-width:min(1280px,95vw);max-height:88vh}.lightbox button{position:absolute;right:20px;top:20px;width:44px;height:44px;border:1px solid rgba(255,255,255,.45);background:#fff;color:var(--deep);font-size:23px;cursor:pointer}
@media(max-width:980px){.layout{grid-template-columns:1fr;border:0}.sidebar{display:none}.mobile-toc{display:block}.content{padding-top:30px}.media-frame,.media-placeholder,.callout,.bullet-list{margin-left:0}}
@media(max-width:640px){.topbar{height:62px;padding:0 14px}.brand-logo{height:28px;max-width:128px;padding:4px 6px}.brand>span:last-child{display:none}.content{padding:20px 16px 62px}.hero h1{font-size:38px}.quick-grid{grid-template-columns:1fr;margin-bottom:62px}.quick-card,.quick-card:nth-child(odd),.quick-card:nth-child(even){border-right:0;padding:13px 6px}.section-list{gap:72px}.section-heading{grid-template-columns:46px 1fr;gap:10px}.step-card{padding:34px 0 40px}.step-heading{grid-template-columns:36px 1fr;gap:10px}.step-heading>span{width:30px;height:30px}.zoom-button{padding:8px;min-height:120px}.media-placeholder{grid-template-columns:1fr;padding:18px 12px;text-align:center}.format-mark{margin:auto}}
@media print{@page{size:A4 portrait;margin:12mm}.topbar,.sidebar,.mobile-toc,.quick-grid,.notice,.sources{display:none!important}.layout{display:block;border:0}.content{padding:0}.hero{min-height:250mm;display:flex;flex-direction:column;justify-content:center;border:0}.hero h1{font-size:36pt}.manual-section{break-before:page}.step-card{break-inside:auto;padding:8mm 0}.step-heading,.media-frame,.media-frame figcaption,.callout{break-inside:avoid}.zoom-button{padding:4mm}.zoom-button img{max-height:165mm}.media-placeholder{min-height:50mm}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;
