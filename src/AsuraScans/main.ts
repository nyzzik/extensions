import {
    BasicRateLimiter,
    type Chapter,
    type ChapterDetails,
    type DiscoverSection,
    type DiscoverSectionItem,
    DiscoverSectionType,
    Form,
    type PagedResults,
    type SearchQuery,
    type SearchResultItem,
    type SortingOption,
    type SourceManga,
    type Tag,
    type TagSection,
    AdvancedSearchForm,
    type ChapterReadActionQueueProcessingResult,
    type MangaProgress,
    type TrackedMangaChapterReadAction,
    type ExtensionImpl,
    type Request,
    type MangaInfoExtra,
} from "@paperback/types";
import { URLBuilder } from "../utils/url-builder/array-query-variant";
import { AS_API_DOMAIN, AS_DOMAIN } from "./config";
import { AsuraInterceptor } from "./interceptor";
import {
    type AsuraApiResponse,
    type AsuraBookmarkResponse,
    type AsuraChapterResponse,
    type AsuraCreatorRequest,
    type AsuraGenre,
    type AsuraMetadata,
    type AsuraSearchResult,
    type AsuraSeriesPayload,
    type SearchMetadata,
    TagSectionId,
} from "./interfaces/interfaces";
import {
    AsuraSettingForm,
    getAccessToken,
    getShowNovels,
    getShowUpcomingChapters,
} from "./forms/settings";
import { statuses, types } from "./filters";
import { AsuraScansAdvancedSearchForm } from "./forms/search";
import AsuraConfig from "./pbconfig";
import { TrackingForm } from "./forms/tracking";
import {
    getNovelChapterDetails,
    getNovelChapters,
    getNovelDetails,
    getNovelDiscoverSections,
} from "./novel-helper";
import { unscramble } from "./utilities";

// Application.global_setTimeout = Application.setTimeout;

export class AsuraScansExtension implements ExtensionImpl<typeof AsuraConfig> {
    async getMangaProgressManagementForm(sourceManga: SourceManga): Promise<Form> {
        return new TrackingForm(sourceManga);
    }
    async getMangaProgress(sourceManga: SourceManga): Promise<MangaProgress> {
        if (!Application.getState("user")) {
            throw new Error("You are not signed in, tracking will not work.");
        }
        let request: Request = {
            url: new URLBuilder(AS_API_DOMAIN)
                .addPath("api")
                .addPath("me")
                .addPath("bookmarks")
                .addQuery("search", sourceManga.mangaInfo.primaryTitle)
                .build(),
            method: "GET",
            headers: {
                Authorization: `Bearer ${await getAccessToken()}`,
            },
        };

        let [res, buffer] = await Application.scheduleRequest(request);
        if (res.status !== 200) {
            throw new Error("Failed to fetch manga progress.");
        }
        let response = JSON.parse(
            Application.arrayBufferToUTF8String(buffer),
        ) as AsuraBookmarkResponse;

        let title = response.data.find((bookmark) => bookmark.series.slug === sourceManga.mangaId);
        if (title === undefined) {
            throw new Error("Manga not found in bookmarks.");
        }
        return {
            sourceManga,
            lastReadChapter: {
                chapterId: title.last_read_chapter.toString(),
                volume: 0,
                sourceManga,
                langCode: "en",
                chapNum: title.last_read_chapter,
            },
            lastReadTime: new Date(title.last_read_at),
            userRating: 0,
        };
    }
    async processChapterReadActionQueue(
        actions: TrackedMangaChapterReadAction[],
    ): Promise<ChapterReadActionQueueProcessingResult> {
        const trackedReadActions: ChapterReadActionQueueProcessingResult = {
            successfulItems: [],
            failedItems: [],
        };

        if (!Application.getState("user")) {
            trackedReadActions.successfulItems.push(...actions.map((e) => e.id));
            return trackedReadActions;
        }
        const highestChapters: Map<string, number> = new Map();
        for (const action of actions) {
            if ((highestChapters.get(action.sourceManga.mangaId) ?? 0) < action.chapterNum) {
                highestChapters.set(action.sourceManga.mangaId, action.chapterNum);
            }
        }

        for (const action of actions) {
            if (action.sourceManga.mangaId.startsWith("novel-")) {
                trackedReadActions.successfulItems.push(action.id);
            }
            if (highestChapters.get(action.sourceManga.mangaId) != action.chapterNum) {
                trackedReadActions.successfulItems.push(action.id);
                continue;
            }

            let request: Request = {
                url: new URLBuilder(AS_API_DOMAIN)
                    .addPath("api")
                    .addPath("me")
                    .addPath("bookmarks")
                    .addQuery("search", action.sourceManga.mangaInfo.primaryTitle)
                    .build(),
                method: "GET",
                headers: {
                    Authorization: `Bearer ${await getAccessToken()}`,
                },
            };

            let [_, buffer] = await Application.scheduleRequest(request);
            const json = JSON.parse(
                Application.arrayBufferToUTF8String(buffer),
            ) as AsuraBookmarkResponse;

            let id = action.sourceManga.mangaInfo.additionalInfo?.id;
            if (id === undefined) {
                trackedReadActions.failedItems.push(action.id);
                continue;
            }

            let title = json.data.find(
                (bookmark) => bookmark.series.slug === action.sourceManga.mangaId,
            );
            if (title === undefined) {
                let request: Request = {
                    url: new URLBuilder(AS_API_DOMAIN)
                        .addPath("api")
                        .addPath("bookmarks")
                        .addPath(id)
                        .build(),
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${await getAccessToken()}`,
                    },
                };
                let [res, _] = await Application.scheduleRequest(request);
                if (res.status !== 200) {
                    trackedReadActions.failedItems.push(action.id);
                }
            } else {
                if ((title.last_read_chapter ?? 0) >= action.chapterNum) {
                    trackedReadActions.successfulItems.push(action.id);
                    continue;
                }
            }
            const post: Request = {
                url: new URLBuilder(AS_API_DOMAIN)
                    .addPath("api")
                    .addPath("bookmarks")
                    .addPath(id)
                    .addPath("read")
                    .addPath(action.chapterNum.toString())
                    .build(),
                method: "POST",
                headers: {
                    Authorization: `Bearer ${await getAccessToken()}`,
                },
            };

            const [res, _2] = await Application.scheduleRequest(post);
            if (res.status === 200) {
                trackedReadActions.successfulItems.push(action.id);
            } else {
                trackedReadActions.failedItems.push(action.id);
            }
        }

        return trackedReadActions;
    }

    globalRateLimiter = new BasicRateLimiter("ratelimiter", {
        numberOfRequests: 6,
        bufferInterval: 1,
        ignoreImages: false,
    });

    requestManager = new AsuraInterceptor("main");

    async initialise(): Promise<void> {
        this.globalRateLimiter.registerInterceptor();
        this.requestManager.registerInterceptor();
        if (Application.isResourceLimited) return;
    }

    async getDiscoverSections(): Promise<DiscoverSection[]> {
        let sections = [
            {
                id: "featured",
                title: "Popular Today",
                type: DiscoverSectionType.featured,
            },

            {
                id: "latest_updates",
                title: "Latest Updates",
                type: DiscoverSectionType.chapterUpdates,
            },

            {
                id: "popular_today",
                title: "Popular of All Time",
                type: DiscoverSectionType.simpleCarousel,
            },

            { id: "type", title: "Types", type: DiscoverSectionType.genres },

            { id: "genres", title: "Genres", type: DiscoverSectionType.genres },

            { id: "status", title: "Status", type: DiscoverSectionType.genres },
        ];
        if (getShowNovels()) {
            sections.push(...getNovelDiscoverSections());
        }
        return sections;
    }

    async getDiscoverSectionItems(
        section: DiscoverSection,
        metadata: AsuraMetadata | undefined,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        let items: DiscoverSectionItem[] = [];
        const page: number = metadata?.page ?? 0;
        switch (section.id) {
            case "featured": {
                // https://api.asurascans.com/api/trending/daily?limit=10
                let urlBuilder = new URLBuilder(AS_API_DOMAIN)
                    .addPath("api")
                    .addPath("trending")
                    .addPath("daily")
                    .addQuery("limit", "10");
                const [_, buffer] = await Application.scheduleRequest({
                    url: urlBuilder.build(),
                    method: "GET",
                });
                const json: AsuraSearchResult = JSON.parse(
                    Application.arrayBufferToUTF8String(buffer),
                );

                for (const manga of json.data) {
                    items.push({
                        imageUrl: manga.cover_url ?? "",
                        title: manga.title,
                        mangaId: manga.slug,
                        type: "featuredCarouselItem",
                        contentRating: AsuraConfig.contentRating,
                    });
                }
                metadata = undefined;
                break;
            }
            case "popular_today": {
                // Popular of all time. https://api.asurascans.com/api/series?sort=popular&order=desc&limit=20&offset=0
                let urlBuilder = new URLBuilder(AS_API_DOMAIN)
                    .addPath("api")
                    .addPath("series")
                    .addQuery("sort", "popular")
                    .addQuery("order", "desc")
                    .addQuery("offset", page * (metadata?.per_page ?? 20));
                const [_, buffer] = await Application.scheduleRequest({
                    url: urlBuilder.build(),
                    method: "GET",
                });
                const json: AsuraSearchResult = JSON.parse(
                    Application.arrayBufferToUTF8String(buffer),
                );

                for (const manga of json.data) {
                    const latestChapter = manga?.latest_chapters?.[0];
                    const chapterNumber =
                        latestChapter?.number != null ? String(latestChapter.number) : "?";

                    const earlyAccessDate = latestChapter?.early_access_until
                        ? new Date(latestChapter.early_access_until)
                        : null;

                    const isEarlyAccess =
                        earlyAccessDate !== null &&
                        !Number.isNaN(earlyAccessDate.getTime()) &&
                        earlyAccessDate > new Date();

                    items.push({
                        imageUrl: manga.cover,
                        title: manga.title,
                        mangaId: manga.slug,
                        subtitle: `Chapter ${chapterNumber}${isEarlyAccess ? " 🔒" : ""}`,
                        type: "simpleCarouselItem",
                        contentRating: AsuraConfig.contentRating,
                    });
                }

                metadata = json.meta.has_more
                    ? { page: page + 1, per_page: json.meta.per_page }
                    : undefined;
                break;
            }
            case "latest_updates": {
                let urlB = new URLBuilder(AS_API_DOMAIN)
                    .addPath("api")
                    .addPath("series")
                    .addQuery("sort", "latest")
                    .addQuery("order", "desc")
                    .addQuery("offset", page * (metadata?.per_page ?? 20));
                const [_, buffer] = await Application.scheduleRequest({
                    url: urlB.build(),
                    method: "GET",
                });
                const json: AsuraSearchResult = JSON.parse(
                    Application.arrayBufferToUTF8String(buffer),
                );
                // items = await parseUpdateSection($, page);
                // metadata = !isLastPage($) ? { page: page + 1 } : undefined;

                for (const manga of json.data) {
                    const latestChapter = manga?.latest_chapters?.[0];
                    const chapterNumber =
                        latestChapter?.number != null ? String(latestChapter.number) : "?";

                    const earlyAccessDate = latestChapter?.early_access_until
                        ? new Date(latestChapter.early_access_until)
                        : null;

                    const isEarlyAccess =
                        earlyAccessDate !== null &&
                        !Number.isNaN(earlyAccessDate.getTime()) &&
                        earlyAccessDate > new Date();

                    items.push({
                        imageUrl: manga.cover,
                        title: manga.title,
                        mangaId: manga.slug,
                        subtitle: `Chapter ${chapterNumber}${isEarlyAccess ? " 🔒" : ""}`,
                        chapterId: manga.latest_chapters[0].id.toString() ?? 0,
                        type: "chapterUpdatesCarouselItem",
                        contentRating: AsuraConfig.contentRating,
                    });
                }

                metadata = json.meta.has_more
                    ? { page: page + 1, per_page: json.meta.per_page }
                    : undefined;
                break;
            }
            case "genres":
            case "type":
            case "status":
                if (section.id === "type") {
                    items = [];
                    const tags: TagSection[] = await this.getSearchTags();
                    for (const tag of tags[2].tags) {
                        items.push({
                            type: "genresCarouselItem",
                            searchQuery: {
                                title: "",
                                metadata: {
                                    seriesType: [tag.id],
                                },
                            },
                            name: tag.title,
                            metadata: metadata,
                        });
                    }
                }
                if (section.id === "genres") {
                    items = [];
                    const tags: TagSection[] = await this.getSearchTags();
                    for (const tag of tags[0].tags) {
                        items.push({
                            type: "genresCarouselItem",
                            searchQuery: {
                                title: "",
                                metadata: {
                                    genres: [tag.id],
                                },
                            },
                            name: tag.title,
                            metadata: metadata,
                        });
                    }
                }
                if (section.id === "status") {
                    items = [];
                    const tags: TagSection[] = await this.getSearchTags();
                    for (const tag of tags[1].tags) {
                        items.push({
                            type: "genresCarouselItem",
                            searchQuery: {
                                title: "",
                                metadata: {
                                    seriesStatus: [tag.id],
                                },
                            },
                            name: tag.title,
                            metadata: metadata,
                        });
                    }
                }
                break;
            case "novel_featured": {
                // https://api.asurascans.com/api/novel-series?limit=3&sort=popular&period=week
                let urlBuilder = new URLBuilder(AS_API_DOMAIN)
                    .addPath("api")
                    .addPath("novel-series")
                    .addQuery("sort", "popular")
                    .addQuery("period", "week")
                    .addQuery("limit", "10");
                const [_, buffer] = await Application.scheduleRequest({
                    url: urlBuilder.build(),
                    method: "GET",
                });
                const json: AsuraSearchResult = JSON.parse(
                    Application.arrayBufferToUTF8String(buffer),
                );

                for (const manga of json.data) {
                    items.push({
                        imageUrl: manga.cover_url ?? "",
                        title: manga.title,
                        mangaId: "novel-" + manga.slug,
                        type: "featuredCarouselItem",
                        contentRating: AsuraConfig.contentRating,
                    });
                }
                metadata = undefined;
                break;
            }
            case "novel_latest_updates": {
                let urlB = new URLBuilder(AS_API_DOMAIN)
                    .addPath("api")
                    .addPath("novel-series")
                    .addQuery("sort", "latest")
                    .addQuery("order", "desc")
                    .addQuery("offset", page * (metadata?.per_page ?? 20));
                const [_, buffer] = await Application.scheduleRequest({
                    url: urlB.build(),
                    method: "GET",
                });
                const json: AsuraSearchResult = JSON.parse(
                    Application.arrayBufferToUTF8String(buffer),
                );

                for (const manga of json.data) {
                    const latestChapter = manga?.recent_chapters?.[0];
                    const chapterNumber =
                        latestChapter?.number != null ? String(latestChapter.number) : "?";

                    let chapId = "0";
                    if (manga.recent_chapters) {
                        chapId = manga.recent_chapters[0].id.toString() ?? 0;
                    }

                    items.push({
                        imageUrl: manga.cover ?? manga.cover_url,
                        title: manga.title,
                        mangaId: "novel-" + manga.slug,
                        subtitle: `Chapter ${chapterNumber}${latestChapter?.is_locked ? " 🔒" : ""}`,
                        chapterId: chapId,
                        type: "chapterUpdatesCarouselItem",
                        contentRating: AsuraConfig.contentRating,
                    });
                }

                metadata = json.meta.has_more
                    ? { page: page + 1, per_page: json.meta.per_page }
                    : undefined;
                break;
            }
            case "novel_popular_today": {
                // Popular of all time. https://api.asurascans.com/api/novel-series?limit=10&sort=popular
                let urlBuilder = new URLBuilder(AS_API_DOMAIN)
                    .addPath("api")
                    .addPath("novel-series")
                    .addQuery("sort", "popular")
                    .addQuery("order", "desc")
                    .addQuery("offset", page * (metadata?.per_page ?? 20));
                const [_, buffer] = await Application.scheduleRequest({
                    url: urlBuilder.build(),
                    method: "GET",
                });
                const json: AsuraSearchResult = JSON.parse(
                    Application.arrayBufferToUTF8String(buffer),
                );

                for (const manga of json.data) {
                    const latestChapter = manga?.recent_chapters?.[0];
                    const chapterNumber =
                        latestChapter?.number != null ? String(latestChapter.number) : "?";

                    items.push({
                        imageUrl: manga.cover ?? manga.cover_url,
                        title: manga.title,
                        mangaId: "novel-" + manga.slug,
                        subtitle: `Chapter ${chapterNumber}${latestChapter?.is_locked ? " 🔒" : ""}`,
                        type: "simpleCarouselItem",
                        contentRating: AsuraConfig.contentRating,
                    });
                }

                metadata = json.meta.has_more
                    ? { page: page + 1, per_page: json.meta.per_page }
                    : undefined;
                break;
            }
        }
        return { items, metadata };
    }

    async getSettingsForm(): Promise<Form> {
        return new AsuraSettingForm();
    }

    getMangaShareUrl(mangaId: string): string {
        return `${AS_DOMAIN}/comics/${mangaId}`;
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        let isNovel = mangaId.startsWith("novel-");

        if (isNovel) {
            return getNovelDetails(mangaId);
        }

        const request = {
            url: new URLBuilder(AS_API_DOMAIN)
                .addPath("api")
                .addPath("series")
                .addPath(mangaId)
                .build(),
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);

        const json = JSON.parse(Application.arrayBufferToUTF8String(buffer)) as AsuraApiResponse;
        const { series, recommended_series, linked_novel }: AsuraSeriesPayload =
            "data" in json && json.data ? json.data : (json as AsuraSeriesPayload);

        let extras: MangaInfoExtra[] = [];

        if (linked_novel) {
            extras.push({
                id: "linked_novel",
                title: "Linked Novel",
                items: [
                    {
                        id: "novel-" + linked_novel.slug,
                        title: linked_novel.title,
                        imageUrl: linked_novel.cover_url,
                    },
                ],
                type: "relation",
            });
        }
        if (recommended_series) {
            extras.push({
                id: "recommended",
                title: "Recommended Series",
                items: recommended_series.map((item) => ({
                    id: item.slug,
                    title: item.title,
                    imageUrl: item.cover_url ?? item.cover,
                })),
                type: "relation",
            });
        }

        return {
            mangaId: mangaId,
            mangaInfo: {
                primaryTitle: series.title,
                secondaryTitles: series.alt_titles,
                status: series.status,
                author: series.author === "_" ? undefined : series.author,
                artist: series.artist === "_" ? undefined : series.artist,
                tagGroups: [
                    {
                        id: "0",
                        title: "Genres",
                        tags: series.genres.map((genre) => ({
                            id: genre.slug,
                            title: genre.name,
                        })),
                    },
                ],
                synopsis: series.description.replaceAll("<p>", "").replaceAll("</p>", "\n"),
                thumbnailUrl: series.cover_url ?? series.cover,
                contentRating: AsuraConfig.contentRating,
                shareUrl: new URLBuilder(AS_DOMAIN).addPath("comics").addPath(mangaId).build(),
                isWebtoon: true,
                additionalInfo: {
                    id: series.id.toString(),
                },
                extras,
            },
        };
    }

    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        // https://api.asurascans.com/api/series/dungeon-architect-f6174291/chapters
        let isNovel = sourceManga.mangaId.startsWith("novel-");
        if (isNovel) {
            return getNovelChapters(sourceManga);
        }
        const request = {
            url: new URLBuilder(AS_API_DOMAIN)
                .addPath("api")
                .addPath("series")
                .addPath(sourceManga.mangaId)
                .addPath("chapters")
                .build(),
            method: "GET",
        };
        const [_, buffer] = await Application.scheduleRequest(request);
        const chapterData: AsuraChapterResponse = JSON.parse(
            Application.arrayBufferToUTF8String(buffer),
        );

        let chapters: Chapter[] = [];

        for (const chapter of chapterData.data) {
            if (!getShowUpcomingChapters() && chapter.is_premium) continue;
            chapters.push({
                sourceManga,
                chapterId: chapter.id.toString(),
                langCode: "🇬🇧",
                chapNum: chapter.number,
                title: chapter?.title ?? undefined,
                publishDate: new Date(chapter.early_access_until ?? chapter.published_at),
                additionalInfo: chapter.is_premium ? { early_access: "true" } : undefined,
                sortingIndex: chapter.number,
                volume: 0,
            });
        }

        return chapters;
    }

    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        let isNovel = chapter.sourceManga.mangaId.startsWith("novel-");

        if (isNovel) {
            // return {
            //     id: chapter.chapterId,
            //     mangaId: chapter.sourceManga.mangaId,
            //     type: "html",
            //     html: `<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body><p>This is the first chapter</p></body></html>`,
            // };
            return getNovelChapterDetails(chapter);
        }
        let accessToken: string = ((await getAccessToken()) as string) ?? "";
        if (chapter?.additionalInfo?.early_access && !accessToken) {
            throw new Error(
                `Chapter is early access. Reading early access chapters is not allowed. Please go to ${AS_DOMAIN}.`,
            );
        }
        // https://api.asurascans.com/api/series/a-villains-will-to-survive-7f873ca6/chapters/49

        const request = {
            url: `https://api.asurascans.com/api/${"series"}/${chapter.sourceManga.mangaId}/chapters/${chapter.chapNum}`,
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
        const data = JSON.parse(json);

        let pages: string[] = [];
        pages = await Promise.all(data.data.chapter.pages.map(unscramble));

        const chapterDetails: ChapterDetails = {
            id: chapter.chapterId,
            mangaId: chapter.sourceManga.mangaId,
            pages,
        };
        return chapterDetails;
    }

    // TODO: Reimplement Search Tags with new Site Changes
    async getSearchTags(): Promise<TagSection[]> {
        let tagSections = Application.getState("tags") as TagSection[];
        if (tagSections !== undefined) {
            console.log("bypassing web request");
            return tagSections;
        }
        tagSections = [];
        let request = {
            url: new URLBuilder(AS_API_DOMAIN).addPath("api").addPath("genres").build(),
            method: "GET",
        };

        let [, buffer] = await Application.scheduleRequest(request);
        let data = JSON.parse(Application.arrayBufferToUTF8String(buffer)) as {
            data: AsuraGenre[];
        };

        let tags: Tag[] = [];

        for (const genre of data.data) {
            tags.push({
                id: genre.slug,
                title: genre.name,
            });
        }

        tagSections.push({
            id: TagSectionId.Genres,
            title: "Genres",
            tags: tags,
        });

        tagSections.push({
            id: TagSectionId.SeriesStatus,
            title: "Status",
            tags: statuses,
        });
        tagSections.push({
            id: TagSectionId.SeriesType,
            title: "Type",
            tags: types,
        });

        tagSections.push({
            id: "min_chapters",
            title: "Minimum Chapters",
            tags: [],
        });

        request = {
            url: new URLBuilder(AS_API_DOMAIN).addPath("api").addPath("creators").build(),
            method: "GET",
        };

        buffer = (await Application.scheduleRequest(request))[1];
        let creators = JSON.parse(Application.arrayBufferToUTF8String(buffer)) as {
            data: AsuraCreatorRequest;
        };
        let artists: Tag[] = [
            {
                id: "all",
                title: "All",
            },
        ];
        const authors: Tag[] = [
            {
                id: "all",
                title: "All",
            },
        ];
        for (const creator of creators.data.artists) {
            artists.push({
                id: creator.toLowerCase().replace(/\s/g, "-").replace(/[',]/g, ""),
                title: creator,
            });
        }
        for (const creator of creators.data.authors) {
            authors.push({
                id: creator.toLowerCase().replace(/\s/g, "-").replace(/[',]/g, ""),
                title: creator,
            });
        }
        tagSections.push({
            id: "artist",
            title: "Artist",
            tags: artists,
        });
        tagSections.push({
            id: "author",
            title: "Author",
            tags: authors,
        });

        Application.setState(tagSections, "tags");

        return tagSections;
    }

    async supportsTagExclusion(): Promise<boolean> {
        return false;
    }

    async getAdvancedSearchForm(
        searchQuery: SearchQuery<SearchMetadata>,
    ): Promise<AdvancedSearchForm> {
        const tags = await this.getSearchTags();
        return new AsuraScansAdvancedSearchForm(searchQuery, tags);
    }

    async getSearchResults(
        query: SearchQuery<SearchMetadata>,
        metadata: AsuraMetadata | undefined,
        sortingOption: SortingOption | undefined,
    ): Promise<PagedResults<SearchResultItem>> {
        const page: number = metadata?.page ?? 0;
        // https://api.asurascans.com/api/series?search=test&sort=latest&order=desc&limit=20&offset=0
        let urlBuilder: URLBuilder;
        if (query.metadata?.showNovels && getShowNovels()) {
            urlBuilder = new URLBuilder(AS_API_DOMAIN).addPath("api").addPath("novel-series");
        } else {
            urlBuilder = new URLBuilder(AS_API_DOMAIN).addPath("api").addPath("series");
        }

        if (query?.title) {
            urlBuilder = urlBuilder.addQuery(
                "search",
                encodeURIComponent(query?.title.replace(/[’‘´`'-][a-z]*/g, "%") ?? ""),
            );
        }
        if (sortingOption) {
            urlBuilder = urlBuilder.addQuery("sort", sortingOption.id);
        } else {
            urlBuilder = urlBuilder.addQuery("sort", "latest");
        }

        let order = "desc";
        if (!query.metadata?.orderIsDescending) {
            order = "asc";
        }

        if (query.metadata?.genres?.length) {
            urlBuilder = urlBuilder.addQuery("genres", query.metadata.genres.join(","));
        }
        const status = query.metadata?.seriesStatus?.[0];
        if (status && status !== "all") {
            urlBuilder = urlBuilder.addQuery("status", status);
        }
        let seriesType = query.metadata?.seriesType?.[0];
        if (seriesType && seriesType !== "all") {
            if (seriesType === "mangatoon") seriesType = "manga";
            urlBuilder = urlBuilder.addQuery("type", seriesType);
        }

        urlBuilder = urlBuilder
            .addQuery("order", order)
            .addQuery("limit", 20)
            .addQuery("offset", page * (metadata?.per_page ?? 20));

        const [, buffer] = await Application.scheduleRequest({
            url: urlBuilder.build(),
            method: "GET",
        });
        const json: AsuraSearchResult = JSON.parse(Application.arrayBufferToUTF8String(buffer));

        if (json.data === null) {
            return { items: [], metadata: undefined };
        }

        let items: SearchResultItem[] = [];

        for (const manga of json.data) {
            const latestChapter = manga?.latest_chapters?.[0];
            const chapterNumber =
                latestChapter?.number != null ? String(latestChapter.number) : "?";

            const earlyAccessDate = latestChapter?.early_access_until
                ? new Date(latestChapter.early_access_until)
                : null;

            const isEarlyAccess =
                earlyAccessDate !== null &&
                !Number.isNaN(earlyAccessDate.getTime()) &&
                earlyAccessDate > new Date();

            items.push({
                imageUrl: manga.cover_url ?? manga.cover,
                title: manga.title,
                mangaId:
                    query.metadata?.showNovels && getShowNovels()
                        ? "novel-" + manga.slug
                        : manga.slug,
                subtitle: `Chapter ${chapterNumber}${isEarlyAccess ? "🔒 " : ""}`,
                contentRating: AsuraConfig.contentRating,
            });
        }
        metadata = json.meta.has_more ? { page: page + 1 } : undefined;
        return { items, metadata };
    }

    async getSortingOptions(_: SearchQuery<SearchMetadata>): Promise<SortingOption[]> {
        return [
            { id: "latest", label: "Latest Update" },
            { id: "popular", label: "Popular" },
            { id: "rating", label: "Rating" },
            { id: "title", label: "A-Z" },
            { id: "newest", label: "Newest" },
        ];
    }
}

export const AsuraScans = new AsuraScansExtension();
