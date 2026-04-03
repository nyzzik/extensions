import {
    BasicRateLimiter,
    type Chapter,
    type ChapterDetails,
    type ChapterProviding,
    type DiscoverSection,
    type DiscoverSectionItem,
    type DiscoverSectionProviding,
    DiscoverSectionType,
    type Extension,
    Form,
    type MangaProviding,
    type PagedResults,
    type SearchFilter,
    type SearchQuery,
    type SearchResultItem,
    type SearchResultsProviding,
    type SettingsFormProviding,
    type SortingOption,
    type SourceManga,
    type Tag,
    type TagSection,
} from "@paperback/types";
import { URLBuilder } from "../utils/url-builder/array-query-variant";
import { AS_API_DOMAIN, AS_DOMAIN } from "./config";
import { AsuraInterceptor } from "./interceptor";
import type {
    AsuraChapterResponse,
    AsuraCreatorRequest,
    AsuraGenre,
    AsuraManga,
    AsuraMetadata,
    AsuraSearchResult,
    PageData,
} from "./interfaces/interfaces";
import { AsuraSettingForm, getAccessToken, getShowUpcomingChapters } from "./settings";
import pbconfig from "./pbconfig";
import { statuses, types } from "./filters";

// Application.global_setTimeout = Application.setTimeout;

export class AsuraScansExtension
    implements
        Extension,
        SearchResultsProviding,
        MangaProviding,
        ChapterProviding,
        SettingsFormProviding,
        DiscoverSectionProviding
{
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
        return [
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
    }

    async getDiscoverSectionItems(
        section: DiscoverSection,
        metadata: AsuraMetadata | undefined,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        let items: DiscoverSectionItem[] = [];
        // let urlBuilder = new URLBuilder(AS_DOMAIN);
        const page: number = metadata?.page ?? 0;
        // if (section.type === DiscoverSectionType.chapterUpdates && page > 1) {
        //     urlBuilder = urlBuilder.addPath("series");
        //     urlBuilder = urlBuilder.addQuery("page", page.toString());
        // }

        switch (section.type) {
            case DiscoverSectionType.featured: {
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

                // console.log(json);

                for (const manga of json.data) {
                    items.push({
                        imageUrl: manga.cover_url ?? "",
                        title: manga.title,
                        mangaId: manga.slug,
                        type: "featuredCarouselItem",
                        contentRating: pbconfig.contentRating,
                    });
                }
                metadata = undefined;
                break;
            }
            case DiscoverSectionType.simpleCarousel: {
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
                    items.push({
                        imageUrl: manga.cover,
                        title: manga.title,
                        mangaId: manga.slug,
                        subtitle: `Chapter ${manga.latest_chapters[0].number.toString()}${new Date(manga.latest_chapters[0].early_access_until ?? "") > new Date() ? " - (Early Access)" : ""}`,
                        type: "simpleCarouselItem",
                        contentRating: pbconfig.contentRating,
                    });
                }

                metadata = json.meta.has_more
                    ? { page: page + 1, per_page: json.meta.per_page }
                    : undefined;
                break;
            }
            case DiscoverSectionType.chapterUpdates: {
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
                    items.push({
                        imageUrl: manga.cover,
                        title: manga.title,
                        mangaId: manga.slug,
                        subtitle: `Chapter ${manga.latest_chapters[0].number.toString()}${new Date(manga.latest_chapters[0].early_access_until ?? "") > new Date() ? " - (Early Access)" : ""}`,
                        chapterId: manga.latest_chapters[0].id.toString(),
                        type: "chapterUpdatesCarouselItem",
                        contentRating: pbconfig.contentRating,
                    });
                }

                metadata = json.meta.has_more
                    ? { page: page + 1, per_page: json.meta.per_page }
                    : undefined;
                break;
            }
            case DiscoverSectionType.genres:
                if (section.id === "type") {
                    items = [];
                    const tags: TagSection[] = await this.getSearchTags();
                    for (const tag of tags[2].tags) {
                        items.push({
                            type: "genresCarouselItem",
                            searchQuery: {
                                title: "",
                                filters: [
                                    {
                                        id: tag.id,
                                        value: { [tag.id]: "included" },
                                    },
                                ],
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
                                filters: [
                                    {
                                        id: tag.id,
                                        value: { [tag.id]: "included" },
                                    },
                                ],
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
                                filters: [
                                    {
                                        id: tag.id,
                                        value: { [tag.id]: "included" },
                                    },
                                ],
                            },
                            name: tag.title,
                            metadata: metadata,
                        });
                    }
                }
        }
        return { items, metadata };
    }

    async getSettingsForm(): Promise<Form> {
        return new AsuraSettingForm();
    }

    getMangaShareUrl(mangaId: string): string {
        return `${AS_DOMAIN}/series/${mangaId}`;
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = {
            url: new URLBuilder(AS_API_DOMAIN)
                .addPath("api")
                .addPath("series")
                .addPath(mangaId)
                .build(),
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);

        const json = JSON.parse(Application.arrayBufferToUTF8String(buffer)) as {
            series: AsuraManga;
        };
        // return await parseMangaDetails($, mangaId);
        return {
            mangaId: mangaId,
            mangaInfo: {
                primaryTitle: json.series.title,
                secondaryTitles: json.series.alt_titles,
                status: json.series.status,
                author: json.series.author === "_" ? undefined : json.series.author,
                artist: json.series.artist === "_" ? undefined : json.series.artist,
                tagGroups: [
                    {
                        id: "0",
                        title: "Genres",
                        tags: json.series.genres.map((genre) => ({
                            id: genre.slug,
                            title: genre.name,
                        })),
                    },
                ],
                synopsis: json.series.description.replaceAll("<p>", "").replaceAll("</p>", "\n"),
                thumbnailUrl: json.series.cover_url ?? json.series.cover,
                contentRating: pbconfig.contentRating,
                shareUrl: new URLBuilder(AS_DOMAIN).addPath("series").addPath(mangaId).build(),
            },
        };
    }

    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        // https://api.asurascans.com/api/series/dungeon-architect-f6174291/chapters
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
            if (!getShowUpcomingChapters() && chapter.is_locked) continue;
            chapters.push({
                sourceManga,
                chapterId: chapter.id.toString(),
                langCode: "🇬🇧",
                chapNum: chapter.number,
                title: chapter?.title ?? undefined,
                publishDate: new Date(chapter.early_access_until ?? chapter.published_at),
                additionalInfo: chapter.is_locked ? { early_access: "true" } : undefined,
                sortingIndex: chapter.number,
                volume: 0,
            });
        }

        return chapters;
    }

    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        let accessToken: string = (Application.getState("accessToken") as string) ?? "";
        if (chapter?.additionalInfo?.early_access) {
            throw new Error(
                `Chapter is early access. Reading early access chapters is not allowed. Please go to ${AS_DOMAIN}.`,
            );
            accessToken = await getAccessToken();
        }
        // https://api.asurascans.com/api/series/a-villains-will-to-survive-7f873ca6/chapters/49
        const request = {
            url: `https://api.asurascans.com/api/series/${chapter.sourceManga.mangaId}/chapters/${chapter.chapNum}`,
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
        pages = await Promise.all(data.data.chapter.pages.map(this.unscramble));

        const chapterDetails: ChapterDetails = {
            id: chapter.chapterId,
            mangaId: chapter.sourceManga.mangaId,
            pages,
        };
        return chapterDetails;
    }

    async unscramble(this: void, data: PageData): Promise<string> {
        const config = data;
        if (!config.url || !config.tiles || !config.tile_cols || !config.tile_rows) {
            return config.url;
        }

        // const [res, buffer] = await Application.scheduleRequest({ url: config.url, method: "GET" });
        // let contentType = res.headers["Content-Type"];

        // let str: string = `data:${contentType};base64,${Application.base64Encode(buffer)}`;

        // return new Promise((res, reject) => {
        //     const image = new Image();
        //     // image.crossOrigin = "Anonymous";
        //     image.onload = () => {
        //         const canvas = new CanvasAPI(image.width, image.height);
        //         const ctx = canvas.getContext("2d");

        //         const tileW = image.width / config.tile_cols;
        //         const tileH = image.height / config.tile_rows;

        //         config.tiles.forEach((destIndex, sourceIndex) => {
        //             const sx = (sourceIndex % config.tile_cols) * tileW;
        //             const sy = Math.floor(sourceIndex / config.tile_cols) * tileH;

        //             const dx = (destIndex % config.tile_cols) * tileW;
        //             const dy = Math.floor(destIndex / config.tile_cols) * tileH;

        //             ctx.drawImage(image, sx, sy, tileW, tileH, dx, dy, tileW, tileH);
        //         });
        //         res(canvas.toDataURL());
        //     };
        //     image.onerror = () => {
        //         reject(new Error("Failed to load image for unscrambling."));
        //     }
        //     image.src = str;
        // });
        return "";
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
            id: "genres",
            title: "Genres",
            tags: tags,
        });

        tagSections.push({
            id: "status",
            title: "Status",
            tags: statuses,
        });
        tagSections.push({
            id: "type",
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

    async getSearchFilters(): Promise<SearchFilter[]> {
        const tags = await this.getSearchTags();
        return tags.map((tag) => {
            if (tag.id === "genres") {
                return {
                    id: tag.id,
                    title: tag.title,
                    type: "multiselect",
                    options: tag.tags.map((x) => ({ id: x.id, value: x.title })),
                    allowExclusion: false,
                    value: {},
                    allowEmptySelection: true,
                    maximum: undefined,
                };
            } else if (tag.id === "min_chapters") {
                return {
                    id: tag.id,
                    title: tag.title,
                    type: "input",
                    placeholder: "0",
                    value: "",
                };
            } else {
                return {
                    id: tag.id,
                    title: tag.title,
                    type: "dropdown",
                    options: tag.tags.map((x) => ({ id: x.id, value: x.title })),
                    value: "all",
                };
            }
        });
    }

    async getSearchResults(
        query: SearchQuery,
        metadata: AsuraMetadata | undefined,
        sortingOption: SortingOption | undefined,
    ): Promise<PagedResults<SearchResultItem>> {
        const page: number = metadata?.page ?? 0;
        // https://api.asurascans.com/api/series?search=test&sort=latest&order=desc&limit=20&offset=0
        let urlBuilder: URLBuilder = new URLBuilder(AS_API_DOMAIN).addPath("api").addPath("series");

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
        const includedTags = [];
        for (const filter of query.filters) {
            if (filter.id === "genres") {
                // console.log(filter.value as string)
                const tags = (filter.value ?? {}) as Record<string, "included" | "excluded">;
                for (const tag of Object.entries(tags)) {
                    includedTags.push(tag[0]);
                }
                urlBuilder = urlBuilder.addQuery("genres", includedTags);
            } else {
                if (filter.value === "all") continue;
                urlBuilder = urlBuilder.addQuery(filter.id, filter.value as string);
            }
        }

        // console.log(query.filters);

        // urlBuilder = urlBuilder
        //     .addQuery("genres", getFilterTagsBySection("genres", includedTags))
        //     .addQuery("status", getFilterTagsBySection("status", includedTags))
        //     .addQuery("types", getFilterTagsBySection("type", includedTags))
        //     .addQuery("order", getFilterTagsBySection("order", includedTags));

        urlBuilder = urlBuilder
            // .addQuery("order", "desc")
            .addQuery("limit", 20)
            .addQuery("offset", page * (metadata?.per_page ?? 20));

        console.log(urlBuilder.build());

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
            items.push({
                imageUrl: manga.cover_url ?? manga.cover,
                title: manga.title,
                mangaId: manga.slug,
                subtitle: `Chapter ${manga.latest_chapters[0].number.toString()}${new Date(manga.latest_chapters[0].early_access_until ?? "") > new Date() ? " - (Early Access)" : ""}`,
                contentRating: pbconfig.contentRating,
            });
        }
        metadata = json.meta.has_more ? { page: page + 1 } : undefined;
        return { items, metadata };
    }

    async getSortingOptions(_: SearchQuery): Promise<SortingOption[]> {
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
