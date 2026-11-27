import type { JSONObject } from "@paperback/types";

export interface Months {
    january: string;
    february: string;
    march: string;
    april: string;
    may: string;
    june: string;
    july: string;
    august: string;
    september: string;
    october: string;
    november: string;
    december: string;
}

export interface StatusTypes {
    ONGOING: string;
    HIATUS: string;
    COMPLETED: string;
    DROPPED: string;
    SEASONEND: string;
    COMINGSOON: string;
    AXED: string;
}

export interface AsuraMetadata extends JSONObject {
    total?: number;
    per_page?: number;
    has_more?: boolean;
    page?: number;
}

export interface Page {
    order: number;
    url: string;
}

export interface AsuraChapter {
    id: number;
    series_id: number;
    number: number;
    slug: string;
    page_count: number;
    is_premium: boolean;
    comments_enabled: boolean;
    published_at: string;
    view_count: number;
    created_at: string;
    series_slug: string;
    is_locked: boolean;
    title?: string;
    early_access_until?: string;
}

export interface AsuraChapterResponse {
    data: AsuraChapter[];
}

export interface PageData {
    url: string;
    tiles: number[];
    tile_cols: number;
    tile_rows: number;
}

export interface AsuraSearchResult {
    data: AsuraManga[];
    meta: AsuraMetadata;
}

export type AsuraApiResponse = AsuraSeriesPayload | { data: AsuraSeriesPayload };

export interface AsuraSeriesPayload {
    series: AsuraManga;
    recommended_series: AsuraManga[];
    linked_novel?: AsuraLinkedNovel;
}

export interface AsuraManga {
    id: number;
    slug: string;
    title: string;
    alt_titles: string[];
    description: string;
    cover: string;
    cover_url?: string;
    status: string;
    type: string;
    author: string;
    artist: string;
    popularity_rank: number;
    bookmark_count: number;
    rating: number;
    chapter_count: number;
    last_chapter_at: string;
    created_at: string;
    updated_at: string;
    public_url: string;
    source_url: string;
    genres: AsuraGenre[];
    latest_chapters: AsuraChapter[];
    recent_chapters?: AsuraNovelChapter[];
}

export interface AsuraGenre {
    id: number;
    name: string;
    slug: string;
}

export interface AsuraCreatorRequest {
    authors: string[];
    artists: string[];
}

export interface SearchMetadata extends JSONObject {
    genres?: string[];
    seriesStatus?: string[];
    seriesType?: string[];
    orderIsDescending?: boolean;
    showNovels?: boolean;
}

export enum TagSectionId {
    Genres = "genres",
    SeriesStatus = "status",
    SeriesType = "type",
}

export interface AsuraUser {
    id: number;
    email: string;
    email_verified_at: string;
    username: string;
    role: string;
    description: string;
    premium_until: string;
    comment_banned: boolean;
    has_custom_username: boolean;
    streak_days: number;
    has_password: boolean;
    created_at: string;
}

export interface AsuraBookmarkResponse {
    data: AsuraBookmark[];
    meta: {
        total: number;
    };
}

export interface AsuraBookmark {
    created_at: string;
    id: number;
    last_read_at: string;
    last_read_chapter: number;
    next_chapter?: number;
    series: AsuraBookmarkSeries;
    status: string;
}

export interface AsuraBookmarkSeries {
    chapter_count: number;
    cover_url: string;
    id: number;
    latest_chapter: number;
    slug: string;
    status: string;
    title: string;
    type: string;
}

export interface AsuraLinkedNovel {
    id: number;
    title: string;
    slug: string;
    cover_url: string;
    chapter_count: number;
    status: string;
}

export interface AsuraNovelResponse {
    chapters: AsuraNovelChapter[];
    next_chapter: AsuraNovelUpcomingChapter;
    series: AsuraNovelSeries;
    upcoming_chapters: AsuraNovelUpcomingChapter[];
}

export interface AsuraNovelChapter {
    id: number;
    number: number;
    title: string;
    word_count: number;
    early_access_hours: number;
    published_at: string;
    is_locked: boolean;
    view_count: number;
    paid_view_count: number;
    content_html?: string;
}

export interface AsuraNovelUpcomingChapter {
    number: number;
    scheduled_at: string;
}

export interface AsuraNovelSeries {
    id: number;
    series_id: number;
    author_id: number;
    slug: string;
    title: string;
    alternative_titles: string;
    description: string;
    cover_url: string;
    banner_url: string;
    status: string;
    author: string;
    genres: string[];
    genre_ids: number[];
    chapter_count: number;
    first_chapter?: undefined;
    is_pinned: boolean;
    rating: number;
    rating_count: number;
    bookmarks: number;
    page_view_count: number;
    paid_view_count: number;
    last_chapter_at: string;
    release_schedule: string;
}

export const readingStatuses = [
    { id: "reading", name: "Reading" },
    { id: "completed", name: "Completed" },
    { id: "on_hold", name: "On Hold" },
    { id: "dropped", name: "Dropped" },
    { id: "plan_to_read", name: "Plan to Read" },
] as const;
export type AsuraScansReadingStatus = (typeof readingStatuses)[number]["id"];
