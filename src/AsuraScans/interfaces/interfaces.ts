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
}

export interface Filters {
    types: [
        {
            id: number;
            name: string;
        },
    ];
    genres: [
        {
            id: number;
            name: string;
        },
    ];
    statuses: [
        {
            id: number;
            name: string;
        },
    ];
    order: [
        {
            name: string;
            value: string;
        },
    ];
}

export interface AsuraMetadata {
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
}

export interface AsuraGenre {
    id: number;
    name: string;
    slug: string;
}
