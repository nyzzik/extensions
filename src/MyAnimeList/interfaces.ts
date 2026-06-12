import type { JSONObject } from "@paperback/types";

export interface MyAnimeListManga {
    id: number;
    title: string;
    main_picture: MyAnimeListPicture;
    alternative_titles?: {
        synonyms?: string[];
        en?: string;
        ja?: string;
    };
    start_date?: string;
    end_date?: string;
    synopsis?: string;
    mean?: number;
    rank?: number;
    popularity?: number;
    num_list_users: number;
    num_scoring_users: number;
    nsfw?: "white" | "gray" | "black";
    genres: MyAnimeListGenre[];
    created_at: string;
    updated_at: string;
    media_type: MyAnimeListMediaType;
    status: MyAnimeListPublishingStatus;
    my_list_status?: MyAnimeListMangaListStatus;
    num_volumes: number;
    num_chapters: number;
    authors: MyAnimeListPersonRoleEdge[];
    pictures: MyAnimeListPicture[];
    background?: string;
    related_anime: MyAnimeListRelated[];
    related_manga: MyAnimeListRelated[];
    recommendations: MyAnimeListRecommendation[];
    serialization: MyAnimeListMangaMagazineRelationEdge[];
}

export interface MyAnimeListMangaSlim {
    id?: number;
    title?: string;
    main_picture?: MyAnimeListPicture;
    my_list_status?: MyAnimeListMangaListStatus;
    num_volumes: number;
    num_chapters: number;
}

export interface MyAnimeListGenre {
    id: number;
    name: string;
}

interface MyAnimeListPersonRoleEdge {
    node: MyAnimeListPersonBase;
    role: string;
}

interface MyAnimeListPersonBase {
    id: number;
    first_name: string;
    last_name: string;
}

interface MyAnimeListPicture {
    large?: string;
    medium: string;
}

interface MyAnimeListRelated {
    node: unknown;
    relation_type:
        | "sequel"
        | "prequel"
        | "alternative_setting"
        | "alternative_version"
        | "side_story"
        | "parent_story"
        | "summary"
        | "full_story";
    relation_type_formatted: string;
}

interface MyAnimeListRecommendation {
    node: unknown;
    num_recommendations: number;
}

interface MyAnimeListMangaMagazineRelationEdge {
    node: MyAnimeListMagazine;
    role: string;
}

interface MyAnimeListMagazine {
    id: number;
    name: string;
}

export interface MyAnimeListMangaListStatus {
    status?: MyAnimeListReadingStatus;
    score: MyAnimeListScore;
    num_volumes_read: number;
    num_chapters_read: number;
    is_rereading: boolean;
    start_date?: string;
    finish_date?: string;
    priority: number;
    num_times_reread: number;
    reread_value: number;
    tags: string[];
    comments: string;
    updated_at?: string;
}

export interface MyAnimeListMangaListPost {
    status?: MyAnimeListReadingStatus;
    is_rereading?: boolean;
    score?: MyAnimeListScore;
    num_volumes_read?: number;
    num_chapters_read?: number;
    priority?: 0 | 1 | 2;
    num_times_reread?: number;
    reread_value?: 0 | 1 | 2 | 3 | 4 | 5;
    tags?: string;
    comments?: string;
}

export interface MyAnimeListMangaListResponse {
    data: MyAnimeListUserMangaListEdge[];
    paging: MyAnimeListPagingObject;
}

export interface MyAnimeListMangaSearchResponse {
    node: any[];
    paging: MyAnimeListPagingObject;
}

interface MyAnimeListPagingObject {
    previous: string;
    next: string;
}

export interface MyAnimeListUserMangaListEdge {
    node: MyAnimeListManga;
    list_status: MyAnimeListMangaListStatus;
}

type MyAnimeListMediaType =
    | "unknown"
    | "manga"
    | "novel"
    | "one_shot"
    | "doujinshi"
    | "manhwa"
    | "manhua"
    | "oel";
type MyAnimeListPublishingStatus = "finished" | "currently_publishing" | "not_yet_published";

export interface MyAnimeListMetadata extends JSONObject {
    next?: string;
}

export const readingStatuses = [
    { id: "reading", name: "Currently Reading" },
    { id: "completed", name: "Finished" },
    { id: "on_hold", name: "On Hold" },
    { id: "dropped", name: "Dropped" },
    { id: "plan_to_read", name: "Plan to Read" },
] as const;
export type MyAnimeListReadingStatus = (typeof readingStatuses)[number]["id"];
export type MyAnimeListScore = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface MyAnimeListUserStatistics {
    id: number;
    name: string;
    gender: string;
    birthday: string;
    location: string;
    joined_at: string;
    picture: string;
    anime_statistics: MyAnimeListAnimeStatistics;
}

interface MyAnimeListAnimeStatistics {
    num_items_watching: number;
    num_items_completed: number;
    num_items_on_hold: number;
    num_items_dropped: number;
    num_items_plan_to_watch: number;
    num_items: number;
    num_days_watched: number;
    num_days_watching: number;
    num_days_completed: number;
    num_days_on_hold: number;
    num_days_dropped: number;
    num_days: number;
    num_episodes: number;
    num_times_rewatched: number;
    mean_score: number;
}
