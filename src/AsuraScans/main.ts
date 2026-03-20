import {
    BasicRateLimiter,
    type Chapter,
    type ChapterDetails,
    type ChapterProviding,
    type DiscoverSection,
    type DiscoverSectionItem,
    // type DiscoverSectionProviding,
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
    type SourceManga,
    type TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { URLBuilder } from "../utils/url-builder/array-query-variant";
import { AS_API_DOMAIN, AS_DOMAIN } from "./config";
import { getFilterTagsBySection } from "./helpers";
import { AsuraInterceptor } from "./interceptor";
import type { AsuraScansMetadata, Filters } from "./interfaces/interfaces";
import {
    isLastPage,
    parseChapters,
    parseFeaturedSection,
    parseMangaDetails,
    parsePopularSection,
    parseSearch,
    // parseTags,
    parseUpdateSection,
} from "./parsers";
import { AsuraSettingForm, getAccessToken } from "./settings";
// import { setFilters } from "./utilities";

export class AsuraScansExtension
    implements
        Extension,
        SearchResultsProviding,
        MangaProviding,
        ChapterProviding,
        SettingsFormProviding
{
    // ,
    // TODO: Reimplement DiscoverSectionProviding with new Site Changes
    // DiscoverSectionProviding
    globalRateLimiter = new BasicRateLimiter("ratelimiter", {
        numberOfRequests: 4,
        bufferInterval: 1,
        ignoreImages: true,
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
                title: "Featured",
                type: DiscoverSectionType.featured,
            },

            {
                id: "latest_updates",
                title: "Latest Updates",
                type: DiscoverSectionType.chapterUpdates,
            },

            {
                id: "popular_today",
                title: "Popular Today",
                type: DiscoverSectionType.simpleCarousel,
            },

            { id: "type", title: "Types", type: DiscoverSectionType.genres },

            { id: "genres", title: "Genres", type: DiscoverSectionType.genres },

            { id: "status", title: "Status", type: DiscoverSectionType.genres },
        ];
    }

    async getDiscoverSectionItems(
        section: DiscoverSection,
        metadata: AsuraScansMetadata | undefined,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        let items: DiscoverSectionItem[] = [];
        let urlBuilder = new URLBuilder(AS_DOMAIN);
        const page: number = metadata?.page ?? 1;
        if (section.type === DiscoverSectionType.chapterUpdates && page > 1) {
            urlBuilder = urlBuilder.addPath("series");
            urlBuilder = urlBuilder.addQuery("page", page.toString());
        }

        switch (section.type) {
            case DiscoverSectionType.featured: {
                const [_, buffer] = await Application.scheduleRequest({
                    url: urlBuilder.build(),
                    method: "GET",
                });
                const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));
                items = await parseFeaturedSection($);
                break;
            }
            case DiscoverSectionType.simpleCarousel: {
                const [_, buffer] = await Application.scheduleRequest({
                    url: urlBuilder.build(),
                    method: "GET",
                });
                const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));
                items = await parsePopularSection($);
                break;
            }
            case DiscoverSectionType.chapterUpdates: {
                const [_, buffer] = await Application.scheduleRequest({
                    url: urlBuilder.build(),
                    method: "GET",
                });
                const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));
                items = await parseUpdateSection($, page);
                metadata = !isLastPage($) ? { page: page + 1 } : undefined;
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
            url: new URLBuilder(AS_DOMAIN).addPath("comics").addPath(mangaId).build(),
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);

        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));
        return await parseMangaDetails($, mangaId);
    }

    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        const request = {
            url: new URLBuilder(AS_DOMAIN).addPath("comics").addPath(sourceManga.mangaId).build(),
            method: "GET",
        };
        const [_, buffer] = await Application.scheduleRequest(request);
        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));
        return parseChapters($, sourceManga);
    }

    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        let accessToken = await getAccessToken();
        // https://api.asurascans.com/api/series/a-villains-will-to-survive-7f873ca6/chapters/49
        const request = {
            url: `https://api.asurascans.com/api/series/${chapter.sourceManga.mangaId}/chapters/${chapter.chapNum}`,
            headers: { Authorization: "Bearer " + accessToken },
            method: "GET",
        };
        if (!accessToken && chapter?.additionalInfo?.is_early_access) {
            throw new Error(
                "Chapter is early access and no access token is available. Please check settings.",
            );
        }
        const [, buffer] = await Application.scheduleRequest(request);
        const json = Application.arrayBufferToUTF8String(buffer);
        const data = JSON.parse(json);
        // console.log(data.data.chapter.pages);
        const chapterDetails: ChapterDetails = {
            id: chapter.chapterId,
            mangaId: chapter.sourceManga.mangaId,
            pages: data.data.chapter.pages.map((page: any) => page.url),
        };
        return chapterDetails;
    }

    async getGenres(): Promise<string[]> {
        try {
            const request = {
                url: new URLBuilder(AS_API_DOMAIN)
                    .addPath("api")
                    .addPath("series")
                    .addPath("filters")
                    .build(),
                method: "GET",
            };

            const [_, buffer] = await Application.scheduleRequest(request);
            const data: Filters = JSON.parse(
                Application.arrayBufferToUTF8String(buffer),
            ) as Filters;
            return data.genres.map((a) => a.name);
        } catch (error) {
            throw new Error(error as string);
        }
    }

    // TODO: Reimplement Search Tags with new Site Changes
    async getSearchTags(): Promise<TagSection[]> {
        // let tags = Application.getState("tags") as TagSection[];
        // if (tags !== undefined) {
        //     console.log("bypassing web request");
        //     return tags;
        // }
        // try {
        //     const request = {
        //         url: new URLBuilder(AS_API_DOMAIN)
        //             .addPath("api")
        //             .addPath("series")
        //             .addPath("filters")
        //             .build(),
        //         method: "GET",
        //     };

        //     const [_, buffer] = await Application.scheduleRequest(request);
        //     const data: Filters = JSON.parse(
        //         Application.arrayBufferToUTF8String(buffer),
        //     ) as Filters;

        //     await setFilters(data);

        //     tags = parseTags(data);
        //     Application.setState(tags, "tags");
        //     return tags;
        // } catch (error) {
        //     throw new Error(error as string);
        // }
        return [];
    }

    async supportsTagExclusion(): Promise<boolean> {
        return false;
    }

    async getSearchFilters(): Promise<SearchFilter[]> {
        const tags = await this.getSearchTags();
        return tags.map((tag) => ({
            id: tag.id,
            title: tag.title,
            type: "multiselect",
            options: tag.tags.map((x) => ({ id: x.id, value: x.title })),
            allowExclusion: false,
            value: {},
            allowEmptySelection: true,
            maximum: undefined,
        }));
    }

    async getSearchResults(
        query: SearchQuery,
        metadata: AsuraScansMetadata | undefined,
    ): Promise<PagedResults<SearchResultItem>> {
        const page: number = metadata?.page ?? 1;
        let newUrlBuilder: URLBuilder = new URLBuilder(AS_DOMAIN)
            .addPath("browse")
            .addQuery("page", page.toString());

        if (query?.title) {
            newUrlBuilder = newUrlBuilder.addQuery(
                "q",
                encodeURIComponent(query?.title.replace(/[’‘´`'-][a-z]*/g, "%") ?? ""),
            );
        }
        const includedTags = [];
        for (const filter of query.filters) {
            const tags = (filter.value ?? {}) as Record<string, "included" | "excluded">;
            for (const tag of Object.entries(tags)) {
                includedTags.push(tag[0]);
            }
        }

        newUrlBuilder = newUrlBuilder
            .addQuery("genres", getFilterTagsBySection("genres", includedTags))
            .addQuery("status", getFilterTagsBySection("status", includedTags))
            .addQuery("types", getFilterTagsBySection("type", includedTags))
            .addQuery("order", getFilterTagsBySection("order", includedTags));

        const response = await Application.scheduleRequest({
            url: newUrlBuilder.build(),
            method: "GET",
        });
        const $ = cheerio.load(Application.arrayBufferToUTF8String(response[1]));

        console.log($.html());

        const items = await parseSearch($);
        metadata = !isLastPage($) ? { page: page + 1 } : undefined;
        return { items, metadata };
    }
}

export const AsuraScans = new AsuraScansExtension();
