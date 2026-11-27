import {
    DiscoverSectionType,
    type Chapter,
    type ChapterDetails,
    type DiscoverSection,
    type SourceManga,
} from "@paperback/types";
import AsuraConfig from "./pbconfig";
import { URLBuilder } from "../utils/url-builder/base";
import { AS_API_DOMAIN, AS_DOMAIN } from "./config";
import type {
    AsuraApiResponse,
    AsuraNovelChapter,
    AsuraNovelResponse,
    AsuraSeriesPayload,
} from "./interfaces/interfaces";
import { getAccessToken, getShowUpcomingChapters } from "./forms/settings";

export function getNovelDiscoverSections(): DiscoverSection[] {
    return [
        {
            id: "novel_featured",
            title: "Novels Popular This Week",
            type: DiscoverSectionType.featured,
        },

        {
            id: "novel_latest_updates",
            title: "Novels Latest Updates",
            type: DiscoverSectionType.chapterUpdates,
        },

        {
            id: "novel_popular_today",
            title: "Novels Popular of All Time",
            type: DiscoverSectionType.simpleCarousel,
        },
    ];
}

export async function getNovelDetails(mangaId: string): Promise<SourceManga> {
    const request = {
        url: new URLBuilder(AS_API_DOMAIN)
            .addPath("api")
            .addPath("novel-series")
            .addPath(mangaId.replace("novel-", ""))
            .build(),
        method: "GET",
    };

    const [_, buffer] = await Application.scheduleRequest(request);

    const json = JSON.parse(Application.arrayBufferToUTF8String(buffer)) as AsuraApiResponse;
    // return await parseMangaDetails($, mangaId);
    const { series, recommended_series }: AsuraSeriesPayload =
        "data" in json && json.data ? json.data : (json as AsuraSeriesPayload);

    return {
        mangaId: mangaId,
        mangaInfo: {
            primaryTitle: series.title,
            secondaryTitles: series.alt_titles,
            status: series.status,
            author: series.author === "_" ? undefined : series.author,
            artist: series.artist === "_" ? undefined : series.artist,
            synopsis: series.description.replaceAll("<p>", "").replaceAll("</p>", "\n"),
            thumbnailUrl: series.cover_url ?? series.cover,
            contentRating: AsuraConfig.contentRating,
            contentType: "novel",
            shareUrl: new URLBuilder(AS_DOMAIN).addPath("novels").addPath(mangaId).build(),
            isWebtoon: false,
            additionalInfo: {
                id: series.id.toString(),
            },
        },
    };
}

export async function getNovelChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    let chapters: Chapter[] = [];

    const request = {
        url: new URLBuilder(AS_API_DOMAIN)
            .addPath("api")
            .addPath("novel-series")
            .addPath(sourceManga.mangaId.replace("novel-", ""))
            .build(),
        method: "GET",
    };
    const [_, buffer] = await Application.scheduleRequest(request);
    const chapterData: AsuraNovelResponse = JSON.parse(Application.arrayBufferToUTF8String(buffer));

    for (const chapter of chapterData.chapters) {
        if (!getShowUpcomingChapters() && chapter.is_locked) continue;
        chapters.push({
            sourceManga,
            chapterId: chapter.id.toString(),
            langCode: "🇬🇧",
            chapNum: chapter.number,
            title: chapter.is_locked
                ? "🔒 " + (chapter?.title ?? "")
                : (chapter?.title ?? undefined),
            publishDate: new Date(chapter.published_at),
            additionalInfo: chapter.is_locked ? { early_access: "true" } : undefined,
            sortingIndex: chapter.number,
            volume: 0,
        });
    }

    return chapters;
}

export async function getNovelChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    let accessToken: string = ((await getAccessToken()) as string) ?? "";
    if (chapter?.additionalInfo?.early_access && !accessToken) {
        throw new Error(
            `Chapter is early access. Reading early access chapters is not allowed. Please go to ${AS_DOMAIN}.`,
        );
    }
    // https://api.asurascans.com/api/series/a-villains-will-to-survive-7f873ca6/chapters/49

    const request = {
        url: `https://api.asurascans.com/api/${"novel-series"}/${chapter.sourceManga.mangaId.replace("novel-", "")}/chapter/${chapter.chapNum}`,
        headers: {
            // "Authorization": "Bearer " + accessToken,
            Authorization: `Bearer ${accessToken}`,
            "X-Page-Token": "asura-reader-2026",
            "Sec-GPC": "1",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            Priority: "u=4",
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0",
        },
        method: "GET",
    };
    if (!accessToken && chapter?.additionalInfo?.early_access) {
        throw new Error(
            "Chapter is early access and no access token is available. Please check settings.",
        );
    }
    const [, buffer] = await Application.scheduleRequest(request);
    const json = Application.arrayBufferToUTF8String(buffer);
    const data: AsuraNovelChapter = JSON.parse(json);
    console.log(data.content_html);
    // throw new Error("Novel error");

    return {
        id: chapter.chapterId,
        mangaId: chapter.sourceManga.mangaId,
        type: "html",
        html: data.content_html ?? "",
        // pages: ["https://cdn.asurascans.com/asura-images/covers/noble-lady-reformation-guide.0068f6.webp"]
    };
}

function escapeXHTML(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
