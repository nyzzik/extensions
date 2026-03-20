import {
    BasicRateLimiter,
    type Chapter,
    type ChapterDetails,
    type ChapterProviding,
    ContentRating,
    type Extension,
    type MangaProviding,
    type PagedResults,
    type SearchFilter,
    type SearchQuery,
    type SearchResultItem,
    type SearchResultsProviding,
    type SourceManga,
    type Tag,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { AsuraInterceptor } from "../AsuraScans/interceptor";
import { MG_DOMAIN } from "./config";
// import { MangaGoInterceptor } from "./interceptor";
import type { MangaGoMetadata } from "./interfaces/interfaces";
import { decryptImgSrcs } from "./utilities";

export class MangaGoExtension
    implements Extension, SearchResultsProviding, MangaProviding, ChapterProviding
{
    // ,

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

    // async getPopularManga(page: number): Promise<PagedResults<>> {

    //     const request = new Request({
    //         url: `${this.baseUrl}/genre/all/${page}/?f=1&o=1&sortby=view&e=`,
    //         method: "GET"
    //     })

    //     const response = await this.requestManager.schedule(request, 1)
    //     const $ = cheerio.load(response.data)

    //     const tiles: MangaTile[] = []

    //     $(".updatesli").each((_, el) => {

    //         const link = $(el).find(".thm-effect")

    //         const id = link.attr("href") ?? ""
    //         const title = link.attr("title") ?? ""

    //         const img = link.find("img")
    //         const image = img.attr("data-src") || img.attr("src")

    //         tiles.push({
    //             id,
    //             title: createIconText({ text: title }),
    //             image
    //         })
    //     })

    //     const nextPage = $(".current+li > a").length > 0

    //     return {
    //         results: tiles,
    //         metadata: nextPage ? { page: page + 1 } : undefined
    //     }
    // }

    /////////////////////////////////
    // LATEST
    /////////////////////////////////

    // async getLatestManga(page: number): Promise<PagedResults<MangaTile>> {

    //     const request = new Request({
    //         url: `${this.baseUrl}/genre/all/${page}/?f=1&o=1&sortby=update_date&e=`,
    //         method: "GET"
    //     })

    //     const response = await this.requestManager.schedule(request, 1)
    //     const $ = cheerio.load(response.data)

    //     const tiles: MangaTile[] = []

    //     $(".updatesli").each((_, el) => {

    //         const link = $(el).find(".thm-effect")

    //         const id = link.attr("href") ?? ""
    //         const title = link.attr("title") ?? ""

    //         const img = link.find("img")
    //         const image = img.attr("data-src") || img.attr("src")

    //         tiles.push({
    //             id,
    //             title: createIconText({ text: title }),
    //             image
    //         })
    //     })

    //     const nextPage = $(".current+li > a").length > 0

    //     return {
    //         results: tiles,
    //         metadata: nextPage ? { page: page + 1 } : undefined
    //     }
    // }

    /////////////////////////////////
    // SEARCH
    /////////////////////////////////

    async getSearchResults(
        query: SearchQuery,
        metadata: MangaGoMetadata | undefined,
    ): Promise<PagedResults<SearchResultItem>> {
        const page = metadata?.page ?? 1;

        const url = query
            ? `${MG_DOMAIN}/r/l_search/?name=${encodeURIComponent(query.title)}&page=${page}`
            : `${MG_DOMAIN}/genre/all/${page}`;

        const request = {
            url,
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);
        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));

        const results: SearchResultItem[] = [];

        $(".updatesli, .pic_list > li").each((_, el) => {
            const link = $(el).find(".thm-effect");

            const id = link.attr("href")?.split("/read-manga/")[1] ?? "";
            const title = link.attr("title") ?? "";

            const img = link.find("img");
            const image = (img.attr("data-src") || img.attr("src")) ?? "";

            results.push({
                mangaId: id,
                title,
                imageUrl: image,
            });
        });

        const nextPage = $(".current+li > a").length > 0;

        return {
            items: results,
            metadata: nextPage ? { page: page + 1 } : undefined,
        };
    }

    /////////////////////////////////
    // MANGA DETAILS
    /////////////////////////////////

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = {
            url: `${MG_DOMAIN}/read-manga/${mangaId}`,
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);
        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));

        const title = $(".w-title h1").text().trim();
        console.log(title);

        const thumbnail = $("#information img").attr("src") ?? "";
        console.log(thumbnail);

        const description = $(".manga_summary").text().trim();
        console.log(description);

        // const tags: TagSection[] = []

        const genres: Tag[] = [];

        $("#information a").each((_, el) => {
            genres.push({
                id: $(el).text(),
                title: $(el).text(),
            });
        });

        // tags.push({
        //     id: "genres",
        //     title: "Genres",
        //     tags: genres
        // })

        return {
            mangaId,
            mangaInfo: {
                primaryTitle: title,
                thumbnailUrl: thumbnail,
                synopsis: description,
                secondaryTitles: [],
                contentRating: ContentRating.EVERYONE,
                // tagGroups: tags
            },
        };
    }

    /////////////////////////////////
    // CHAPTER LIST
    /////////////////////////////////

    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        const request = {
            url: `${MG_DOMAIN}/read-manga/${sourceManga.mangaId}`,
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);
        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));

        const chapters: Chapter[] = [];
        let sortingIndex = 0;

        $("table#chapter_table > tbody > tr").each((_, el) => {
            const link = $(el).find("a.chico");
            const id = link.attr("href") ?? "";
            const parts = link.text().trim().split(":");
            let name = parts[1]?.trim() ?? "";

            const volChap = parts[0]?.trim().split(" ");
            console.log("Full " + parts[0]);
            console.log(volChap);
            console.log("VolChap length " + volChap.length);
            let chapterIdentifier = "";
            let chapterNum = "0";
            let vol = undefined;
            if (volChap.length == 2) {
                let volstr = volChap[0].trim().split(".")[1].trim() ?? "0";
                vol = parseInt(volstr);
                chapterIdentifier = volChap[1]?.trim().split(".")[0].trim();
                chapterNum = volChap[1]?.trim().split(".")[1].trim();
                if (chapterNum.length == 0) {
                    chapterNum = "0";
                }
            } else if (volChap.length == 1) {
                chapterIdentifier = parts[0]?.trim().split(".")[0].trim();

                chapterNum = parts[0]?.trim().split(".")[1].trim();
                if (chapterNum.length == 0) {
                    chapterNum = "0";
                }
            }
            const date = $(el).find("td").last().text().trim();
            if (chapterIdentifier != "Ch" && name.length == 0) {
                name = chapterIdentifier + " " + name;
            }
            // console.log(id);
            // Regex to get chapter number from id, which looks like "v01/c001/"
            // console.log("-------------------")
            // console.log()
            // console.log("-------------------")
            // const chapNum = parseInt(id.split("v01/c")[1].split("/")[0]) ?? 0;
            console.log(chapterNum);
            // console.log(chapterNum);

            const chapNum = parseInt(chapterNum);

            chapters.push({
                chapterId: id,
                sourceManga,
                title: name,
                chapNum: chapNum,
                volume: vol,
                langCode: "🇬🇧",
                sortingIndex,
                publishDate: new Date(date),
            });

            sortingIndex--;
        });

        return chapters.map((chapter) => {
            if (chapter.sortingIndex != undefined) chapter.sortingIndex += chapters.length;
            return chapter;
        });
    }

    /////////////////////////////////
    // CHAPTER DETAILS
    /////////////////////////////////

    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        const request = {
            url: chapter.chapterId,
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);

        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));
        // Find script containing imgsrcs
        // console.log($("body").html())
        let encrypted: string | undefined;

        $("script").each((_, el) => {
            const text = $(el).html() ?? "";
            const match = text.match(/imgsrcs\s*=\s*["']([^"']+)["']/);

            if (match) {
                encrypted = match[1];
                console.log("found: ", match[0]);
                return false;
            }
        });
        // encrypted = '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';

        if (!encrypted) throw new Error("imgsrcs not found");

        // console.log("Encrypted: " + encrypted);

        const decrypted = await decryptImgSrcs(encrypted);

        // console.log(fixed);

        const pages = decrypted.split(",");

        return {
            id: chapter.chapterId,
            mangaId: chapter.sourceManga.mangaId,
            pages,
        };
        // return {id: "", mangaId: "", pages:[]};
    }

    async getSearchFilters(): Promise<SearchFilter[]> {
        const filters: SearchFilter[] = [];
        return filters;
    }
}

export const MangaGo = new MangaGoExtension();
