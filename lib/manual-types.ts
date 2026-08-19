export type CalloutTone = "info" | "tip" | "warning" | "danger";

export type ManualAsset = {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  size: number;
  updatedAt: string;
};

export type ManualMedia = {
  id: string;
  label: string;
  format: string;
  alt: string;
  caption: string;
  captureGuide: string;
  labelFontSize?: number;
  captionFontSize?: number;
  src?: string;
  assetId?: string;
  baseAssetId?: string;
};

export type ManualStep = {
  id: string;
  title: string;
  body: string;
  bullets: string[];
  titleFontSize?: number;
  bodyFontSize?: number;
  bulletFontSize?: number;
  callout?: {
    tone: CalloutTone;
    title: string;
    text: string;
    titleFontSize?: number;
    textFontSize?: number;
  };
  media?: ManualMedia;
};

export type ManualSource = {
  label: string;
  url: string;
};

export type ManualSection = {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  summary: string;
  titleFontSize?: number;
  summaryFontSize?: number;
  audience: string;
  platforms: string[];
  duration: string;
  steps: ManualStep[];
  sources?: ManualSource[];
};

export type ManualDocument = {
  schemaVersion: number;
  settings: {
    company: string;
    brandLogo: string;
    headerLabel: string;
    eyebrow: string;
    headerLabelFontSize?: number;
    eyebrowFontSize?: number;
    heroTitleFontSize?: number;
    heroSubtitleFontSize?: number;
    noticeTitleFontSize?: number;
    noticeBodyFontSize?: number;
    title: string;
    subtitle: string;
    noticeTitle: string;
    noticeBody: string;
    showHeaderLabel: boolean;
    showHero: boolean;
    showNotice: boolean;
    showQuickLinks: boolean;
    showConnectionCard: boolean;
    showSources: boolean;
    showFooter: boolean;
    fontScale: number;
    version: string;
    lastUpdated: string;
    verifiedVersion: string;
    nasAddress: string;
    driveWebUrl: string;
    teamFolder: string;
    localFolder: string;
    support: string;
    networkPolicy: string;
  };
  quickLinks: Array<{
    icon: string;
    label: string;
    hint: string;
    labelFontSize?: number;
    hintFontSize?: number;
    sectionId: string;
  }>;
  sections: ManualSection[];
};

export type ManualBackup = {
  schemaVersion: number;
  exportedAt: string;
  manual: ManualDocument;
  assets: ManualAsset[];
};

export type ValidationIssue = {
  level: "warning" | "error";
  message: string;
  target?: string;
};
