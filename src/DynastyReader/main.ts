import {
    BasicRateLimiter,
    type Chapter,
    type ChapterDetails,
    type ChapterProviding,
    type DiscoverSection,
    type DiscoverSectionItem,
    type DiscoverSectionProviding,
    type Extension,
    type MangaProviding,
    type PagedResults,
    type SearchQuery,
    type SearchResultItem,
    type SearchResultsProviding,
    type SortingOption,
    type SourceManga,
    type Metadata,
    type Request,
    ContentRating,
} from "@paperback/types";
import { URLBuilder } from "../utils/url-builder/base";
import { DS_DOMAIN } from "./config";
import type { DynastyReaderChapters, DynastyReaderSeries } from "./interfaces";

import * as cheerio from "cheerio";
import { DynastyReaderInterceptor } from "./interceptor";
import { getOrSetThumbnail } from "./utilities";

export class DynastyReaderExtension
    implements
        Extension,
        SearchResultsProviding,
        MangaProviding,
        ChapterProviding,
        // SettingsFormProviding,
        DiscoverSectionProviding
{
    globalRateLimiter = new BasicRateLimiter("ratelimiter", {
        numberOfRequests: 2,
        bufferInterval: 1,
        ignoreImages: false,
    });

    requestManager = new DynastyReaderInterceptor("main");

    async initialise(): Promise<void> {
        this.globalRateLimiter.registerInterceptor();
        this.requestManager.registerInterceptor();
        if (Application.isResourceLimited) return;
    }
    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const urlBuilder = new URLBuilder(`${DS_DOMAIN}/${mangaId}.json`);

        const request: Request = {
            url: urlBuilder.build(),
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);
        const response: DynastyReaderSeries = JSON.parse(
            Application.arrayBufferToUTF8String(buffer),
        );

        const author = response.tags.filter((x) => x.type == "Author");
        const status = response.tags.find((x) => x.type == "Status");

        const description = response?.description?.replace(/<[^>]*>?/gm, "").trim() ?? "";
        let name = "";
        if (response.type === "Doujin") {
            name = response.name + " " + response.type;
        }

        return {
            mangaId,
            mangaInfo: {
                thumbnailUrl: await getOrSetThumbnail(
                    "SET",
                    mangaId,
                    `${DS_DOMAIN}${response.cover}`,
                ),
                synopsis: description,
                primaryTitle: name,
                secondaryTitles: response.aliases,
                contentRating:
                    response.type === "Doujin" ? ContentRating.ADULT : ContentRating.MATURE,
                author: author[0]?.name ?? undefined,
                status: status?.name,
            },
        };
    }
    async getSearchResults(
        query: SearchQuery<Metadata>,
        metadata: Metadata | undefined,
        sortingOption: SortingOption | undefined,
    ): Promise<PagedResults<SearchResultItem>> {
        const request: Request = {
            url: `${DS_DOMAIN}/search?q=${query.title ?? ""}&classes[]=Doujin&classes[]=Series&sort=`,
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);
        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));

        const results: SearchResultItem[] = [];

        for (const item of $("dl.chapter-list > dd").toArray()) {
            const id = $("a.name", item).attr("href")?.replace(/\/$/, "") ?? "";
            const title = $("a.name", item).text().trim() ?? "";
            const tags = $("span.tags > a", item)
                .toArray()
                .map((x) => $(x).text().trim())
                .join(", ");

            if (!id || !title) continue;

            results.push({
                mangaId: id,
                imageUrl: await getOrSetThumbnail("FETCH", id),
                title: title,
            });
        }
        return { items: results };
    }
    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        const urlBuilder = new URLBuilder(`${DS_DOMAIN}/${sourceManga.mangaId}.json`);

        const request: Request = {
            url: urlBuilder.build(),
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);
        const response: DynastyReaderSeries = JSON.parse(
            Application.arrayBufferToUTF8String(buffer),
        );

        const chapters: Chapter[] = [];

        // const chapterRegex = /Chapter\s+(\d+(\.\d+)?)(.*)/;
        const chapterRegex = /Chapter\s+(\d+(\.\d+)?)?(.*)/;
        const volumeRegex = /Volume (\d+(\.\d+)?)/;

        let index = 0;
        let volNum = 0;
        let chapNum = 0;
        switch (response.type) {
            // For doujin/alice_quartet
            case "Doujin":
            // For series/alice_quartet
            case "Series":
                for (const chapter of response.taggings) {
                    let volNumRegex;
                    if (chapter.header) {
                        volNumRegex = chapter.header.match(volumeRegex);
                        if (volNumRegex && volNumRegex[0]) volNum = Number(volNumRegex[1]);
                        else volNum = 0;
                    }
                    if (!chapter.permalink || !chapter.title) continue;

                    const chapNumRegex = chapter.title.match(chapterRegex);

                    let chapTitle = chapter.title;
                    if (chapNumRegex && chapNumRegex[1]) chapNum = parseFloat(chapNumRegex[1]);
                    else chapNum += 0.1;
                    // else chapNum = chapter.permalink.split("ch")[1] ? Number(chapter.permalink.split("ch")[1]) : 0;
                    if (chapNumRegex && chapNumRegex[3] !== undefined)
                        chapTitle = chapNumRegex[3].replace(":", "").trim();

                    chapters.push({
                        chapterId: chapter.permalink,
                        title: chapTitle.trim(),
                        langCode: "en",
                        chapNum: parseFloat(chapNum.toFixed(1)),
                        sortingIndex: ++index,
                        version: chapter.tags.find((x) => x.type === "Scanlator")?.name,
                        publishDate: new Date(chapter.released_on),
                        volume: volNum,
                        sourceManga: sourceManga,
                    });
                }
                break;
            // For chapters/alice_quartet (Not used)
            default:
                break;
        }

        if (chapters.length == 0) {
            throw new Error(`Couldn't find any chapters for mangaId: ${sourceManga.mangaId}!`);
        }

        console.log(JSON.stringify(chapters));

        // return chapters.map(chapter => {
        //     if(chapter.sortingIndex)
        //         chapter.sortingIndex += chapters.length
        //     return chapter
        // })
        return chapters;
    }
    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        const request = {
            url: `${DS_DOMAIN}/chapters/${chapter.chapterId}.json`,
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);
        const data: DynastyReaderChapters =
            typeof Application.arrayBufferToUTF8String(buffer) === "string"
                ? JSON.parse(Application.arrayBufferToUTF8String(buffer))
                : Application.arrayBufferToUTF8String(buffer);

        const images: string[] = [];

        for (const image of data.pages) {
            images.push(DS_DOMAIN + image.url);
        }

        return {
            id: chapter.chapterId,
            mangaId: chapter.sourceManga.mangaId,
            pages: images,
        };
    }

    getDiscoverSections(): Promise<DiscoverSection[]> {
        throw new Error("Method not implemented.");
    }
    getDiscoverSectionItems(
        section: DiscoverSection,
        metadata?: Metadata,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        throw new Error("Method not implemented.");
    }

    // async getSearchTags(): Promise<TagSection[]> {
    //     const tagSections: TagSection[] = []

    //     let getMore = true
    //     let page = 1
    //     while (getMore) {
    //         const request: Request = {
    //             url: `${DS_DOMAIN}/tags.json?page=${page++}`,
    //             method: 'GET'
    //         }

    //         const [_, buffer] = await Application.scheduleRequest(request);
    //         const response: DynastyReaderSeries = JSON.parse(Application.arrayBufferToUTF8String(buffer));

    //         for (const tagType of response.tags) {

    //             for (const key of Object.keys(tagType)) {
    //                 const tags: Tag[] = []

    //                 for (const tag of tagType[key]) {
    //                     tags.push({
    //                         id: tag.permalink,
    //                         label: tag.name
    //                     })
    //                 }
    //                 tagSections.push(App.createTagSection({ id: key, label: key, tags: tags.map(x => App.createTag(x)) }))
    //             }
    //         }

    //         if (data.current_page >= data.total_pages) {
    //             getMore = false
    //         }
    //     }

    //     return tagSections
    // }
}

export const DynastyReader = new DynastyReaderExtension();
