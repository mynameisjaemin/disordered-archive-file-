export type CategoryId =
  | "references"
  | "issues"
  | "journal"
  | "portfolio"
  | "archive"
  | "freeboard"
  | "contact";

export type MainReferenceTag =
  | "DAF_life"
  | "DAF_Fashion"
  | "DAF_Runway"
  | "DAF_Editorial"
  | "DAF_Styling"
  | "DAF_Detail"
  | "DAF_Silhouette"
  | "DAF_Textile"
  | "DAF_Graphics"
  | "DAF_Object"
  | "DAF_Space"
  | "DAF_Art"
  | "DAF_Theory"
  | "DAF_Structure"
  | "DAF_video"
  | "DAF_Mood";

export type JournalPost = {
  id: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  content?: string;
  tags: string[];
  category?: string;
  slug?: string;
  coverImage?: string;
  coverAlt?: string;
  coverCaption?: string;
  publishedAt?: string;
  updatedAt?: string;
  visibility?: "draft" | "published" | "private" | string;
  relatedIssueId?: string;
  relatedIssueNumber?: string | number;
  relatedIssueSlug?: string;
};

export type PortfolioItem = {
  id: string;
  portfolioNumber?: string | number;
  title: string;
  subtitle?: string;
  description: string;
  coverImage?: string;
  coverAlt?: string;
  category?: string;
  tags: string[];
  status?: "completed" | "in_progress" | "archived" | string;
  projectType?: "individual" | "team" | string;
  client?: string;
  projectPeriod?: string;
  archivedDate?: string;
  slug?: string;
  isFeatured?: boolean;
  displayOrder?: number;
  role?: string;
  contribution?: string[] | string;
  skills?: string[];
  overview?: string;
  background?: string;
  problem?: string;
  goal?: string;
  research?: string;
  insight?: string;
  strategy?: string;
  planning?: string;
  process?: string;
  execution?: string;
  outcome?: string;
  reflection?: string;
  gallery?: ({
    src: string;
    alt?: string;
    caption?: string;
  } | string)[];
  attachment?: {
    url: string;
    label?: string;
    type?: string;
    size?: string;
  };
  attachments?: {
    url: string;
    label?: string;
    type?: string;
    size?: string;
    storagePath?: string;
  }[];
  relatedJournalId?: string;
  relatedJournalSlug?: string;
  relatedIssueId?: string;
  relatedIssueNumber?: string | number;
  relatedArchiveIds?: string[];
  visibility?: "draft" | "published" | "private" | string;
  createdAt?: string;
  updatedAt?: string;
};

export type IssueItem = {
  id: string;
  title: string;
  link: string;
  description?: string;
  category?: string;
  publishedAt?: string;
  issueNumber?: string | number;
  thumbnailSrc?: string;
  thumbnailUrl?: string;
  instagramUrl?: string;
  instagramHandle: string;
  tags: string[];
  isFeatured?: boolean;
  createdAt?: string;
  storagePath?: string;
};

export type FreeboardPost = {
  id: string;
  name: string;
  content: string;
  isAnonymous: boolean;
  date: string;
  tags: string[];
  x?: number;
  y?: number;
  rotation?: number;
  size?: "small" | "medium" | "large" | string;
  visibility?: "published" | "hidden" | string;
  createdAt?: string;
};

export type ReferenceItem = {
  id: string;
  title: string;
  mainTag: MainReferenceTag;
  tags: string[];
  type: "image" | "video";
  src: string;
  memo: string;
  location?: string;
  date?: string;
  noticed?: string;
  possibleUse?: string;
  storagePath?: string;
};

export type ArchiveFileType =
  | "garment"
  | "pattern"
  | "process"
  | "material"
  | "fitting"
  | "reference"
  | string;

export type ArchiveFileStatus = "draft" | "in_progress" | "completed" | "archived" | string;

export type ArchiveSectionKey =
  | "finalGarment"
  | "pattern"
  | "reference"
  | "material"
  | "process"
  | "fitting"
  | "notes";

export type ArchiveMediaItem = {
  id?: string;
  src: string;
  alt?: string;
  caption?: string;
  imageType?: string;
  description?: string;
  date?: string;
};

export type ArchiveProcessStep = {
  title: string;
  note?: string;
  date?: string;
  image?: string;
  caption?: string;
};

export type ArchiveSection = {
  summary?: string;
  content?: string;
  media?: ArchiveMediaItem[];
  source?: string;
  reasonSaved?: string;
  learned?: string;
  application?: string;
  patternType?: string;
  baseSize?: string;
  version?: string;
  measurements?: string;
  modificationNotes?: string;
  issue?: string;
  correction?: string;
  finalPattern?: string;
  fabricName?: string;
  composition?: string;
  color?: string;
  weight?: string;
  texture?: string;
  stretch?: string;
  thickness?: string;
  surface?: string;
  behavior?: string;
  notes?: string;
  problem?: string;
  result?: string;
  steps?: ArchiveProcessStep[];
};

export type ArchiveFileItem = {
  id: string;
  archiveNumber?: string | number;
  title: string;
  slug?: string;
  type: ArchiveFileType;
  category?: string;
  status?: ArchiveFileStatus;
  date?: string;
  coverImage?: string;
  coverAlt?: string;
  tags: string[];
  isFeatured?: boolean;
  displayOrder?: number;
  garmentType?: string;
  material?: string;
  color?: string;
  technique?: string;
  seasonYear?: string;
  sizeMeasurement?: string;
  patternVersion?: string;
  sections?: Partial<Record<ArchiveSectionKey, ArchiveSection>>;
  relatedJournalSlug?: string;
  relatedPortfolioSlug?: string;
  relatedIssueNumber?: string | number;
  visibility?: "draft" | "published" | "private" | string;
  createdAt?: string;
  updatedAt?: string;
};

export type ArchiveSearchResults = {
  references: ReferenceItem[];
  issues: IssueItem[];
  journal: JournalPost[];
  portfolio: PortfolioItem[];
  archive: ArchiveFileItem[];
  freeboard: FreeboardPost[];
  contact: string[];
};
