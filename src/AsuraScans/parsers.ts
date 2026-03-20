import {
    type Chapter,
    type ChapterDetails,
    ContentRating,
    type DiscoverSectionItem,
    type SearchResultItem,
    type SourceManga,
    type Tag,
    type TagSection,
} from "@paperback/types";
import { type CheerioAPI, load } from "cheerio";
import { URLBuilder } from "../utils/url-builder/base";
import { AS_DOMAIN } from "./config";
import type { Filters } from "./interfaces/interfaces";
import pbconfig from "./pbconfig";
import { getShowUpcomingChapters } from "./settings";
import { getMangaId } from "./utilities";

export const parseMangaDetails = async ($: CheerioAPI, mangaId: string): Promise<SourceManga> => {
    const title = $("h1.font-semibold").text().trim() ?? "";
    const image = $("#desktop-cover-container img").attr("src") ?? "";
    const description = $("#description-text").text().trim() ?? "";

    const author = $('span:contains("Author")').next().text().trim() ?? "";
    const artist = $('span:contains("Artist")').next().text().trim() ?? "";

    // TODO: Reimplement Genres and Tags
    // const arrayTags: Tag[] = [];
    // for (const tag of $("button", $('h3:contains("Genres")').next()).toArray()) {
    //   const label = $(tag).text().trim();
    //   const filterName = label.toLocaleUpperCase();

    //   const id = await getFilter(filterName);

    //   if (!id || !label) continue;
    //   arrayTags.push({ id: `genres_${id}`, title: label });
    // }
    // const tagSections: TagSection[] = [{ id: "0", title: "genres", tags: arrayTags }];

    const rawStatus = $('h3:contains("Status")').next().text().trim() ?? "";
    let status = "ONGOING";
    switch (rawStatus.toUpperCase()) {
        case "ONGOING":
            status = "Ongoing";
            break;
        case "COMPLETED":
            status = "Completed";
            break;
        case "HIATUS":
            status = "Hiatus";
            break;
        case "SEASON END":
            status = "Season End";
            break;
        case "COMING SOON":
            status = "Coming Soon";
            break;
        default:
            status = "Ongoing";
            break;
    }

    const titles = [load(title).text()];

    return {
        mangaId: mangaId,
        mangaInfo: {
            primaryTitle: titles.shift() as string,
            secondaryTitles: titles,
            status: status,
            author: load(author).text() === "_" ? undefined : load(author).text(),
            artist: load(artist).text() === "_" ? undefined : load(artist).text(),
            // tagGroups: tagSections,
            synopsis: load(description).text(),
            thumbnailUrl: image,
            contentRating: ContentRating.EVERYONE,
            shareUrl: new URLBuilder(AS_DOMAIN).addPath("comics").addPath(mangaId).build(),
        },
    };
};

export const parseChapters = ($: CheerioAPI, sourceManga: SourceManga): Chapter[] => {
    const chapters: Chapter[] = [];
    const readerIsland = $('astro-island[component-url*="ChapterList"]');

    if (!readerIsland.length) {
        console.error("Could not find the chapter data component.");
        return [];
    }
    try {
        const propsRaw: any = readerIsland.attr("props");

        const props = JSON.parse(propsRaw);

        const chapterData = props.chapters[1];

        const parsed = chapterData.map((item: any) => {
            const info = item[1];
            return {
                number: info.number[1],
                id: info.id[1],
                createdAt: info.created_at[1],
                is_locked: info.is_locked[1],
            };
        });
        parsed.forEach(
            (chapter: {
                is_locked: boolean;
                createdAt: string;
                title: string;
                id: string;
                number: number;
            }) => {
                if (!getShowUpcomingChapters() && chapter.is_locked) return;
                // console.log(chapter.published_at);
                const date = new Date(chapter.createdAt);
                let title = chapter.title ?? "";
                let additionalInfo: Record<string, string> = {};
                if (chapter.is_locked) {
                    if (!date) return;
                    const hours = date.getHours() + 6;
                    date.setHours(hours);
                    title = `(Early Access) ${chapter.title ?? ""}`.trim();
                    additionalInfo = { early_access: "true" };
                }
                chapters.push({
                    chapterId: chapter.id.toString(),
                    title: title,
                    langCode: "🇬🇧",
                    chapNum: chapter.number,
                    volume: 0,
                    publishDate: date,
                    sortingIndex: chapter.number,
                    sourceManga,
                    additionalInfo,
                });
            },
        );
    } catch (error) {
        throw new Error("Error parsing chapter data: " + error);
    }

    if (chapters.length == 0) {
        throw new Error(`Couldn't find any chapters for mangaId: ${sourceManga.mangaId}!`);
    }

    return chapters;
};

export const parseChapterDetails = async (
    $: CheerioAPI,
    mangaId: string,
    chapterId: string,
): Promise<ChapterDetails> => {
    const pages: string[] = [];

    for (const image of $('img[alt*="chapter"]').toArray()) {
        const img = $(image).attr("src") ?? "";
        if (!img) continue;

        pages.push(img);
    }

    const chapterDetails = {
        id: chapterId,
        mangaId: mangaId,
        pages: pages,
    };

    return chapterDetails;
};

export const parseFeaturedSection = async ($: CheerioAPI): Promise<DiscoverSectionItem[]> => {
    // Featured
    const featuredSection_Array: DiscoverSectionItem[] = [];
    for (const manga of $("li.slide", "ul.slider.animated").toArray()) {
        const slug = $("a", manga).attr("href")?.replace(/\/$/, "")?.split("/").pop() ?? "";
        if (!slug) continue;

        const id = await getMangaId(slug);

        // Fix ID later, remove hash
        const image: string = $("img", manga).first().attr("src") ?? "";
        const title: string = $("a", manga).first().text().trim() ?? "";

        if (!id || !title) continue;
        featuredSection_Array.push({
            imageUrl: image,
            title: load(title).text(),
            mangaId: id,
            type: "featuredCarouselItem",
            contentRating: pbconfig.contentRating,
        });
    }
    return featuredSection_Array;
};

export const parseUpdateSection = async (
    $: CheerioAPI,
    page: number,
): Promise<DiscoverSectionItem[]> => {
    // Latest Updates
    const updateSectionArray: DiscoverSectionItem[] = [];

    console.log(`Page Number: ${page}`);
    if (page == 1) {
        console.log("here");
        for (const item of $("div.w-full", "div.grid.grid-rows-1").toArray()) {
            const slug = $("a", item).attr("href")?.replace(/\/$/, "")?.split("/").pop() ?? "";
            if (!slug) continue;

            const id = await getMangaId(slug);

            const image: string = $("img", item).first().attr("src") ?? "";
            const title: string =
                $(".col-span-9 > .font-medium > a", item).first().text().trim() ?? "";
            let subtitle: string =
                $(".flex.flex-col .flex-row a", item).first().text().trim() ?? "";
            const subtitleContext: string = $("p.flex.items-end", item).text().trim() ?? "";
            if (subtitleContext.toLowerCase().indexOf("public") !== -1) {
                subtitle = "(Early Access) " + subtitle;
            }

            if (!id || !title) continue;

            updateSectionArray.push({
                imageUrl: image,
                title: load(title).text(),
                mangaId: id,
                subtitle: subtitle,
                chapterId: subtitle.split(" ")[1],
                type: "chapterUpdatesCarouselItem",
                contentRating: pbconfig.contentRating,
            });
        }
    } else
        for (const item of $("a", "div.grid.grid-cols-2").toArray()) {
            const slug = $(item).attr("href")?.replace(/\/$/, "")?.split("/").pop() ?? "";
            if (!slug) continue;

            const id = await getMangaId(slug);

            const image: string = $("img", item).first().attr("src") ?? "";
            const title: string = $("span.block.font-bold", item).first().text().trim() ?? "";
            const subtitle: string =
                $("span.block.font-bold", item).first().next().text().trim() ?? "";

            updateSectionArray.push({
                imageUrl: image,
                title: load(title).text(),
                mangaId: id,
                subtitle: subtitle,
                chapterId: subtitle.split(" ")[1],
                type: "chapterUpdatesCarouselItem",
                contentRating: pbconfig.contentRating,
            });
        }

    return updateSectionArray;
};

export const parsePopularSection = async ($: CheerioAPI): Promise<DiscoverSectionItem[]> => {
    // Popular Today
    const popularSection_Array: DiscoverSectionItem[] = [];
    for (const manga of $("a", "div.flex-wrap.hidden").toArray()) {
        const slug = $(manga).attr("href")?.replace(/\/$/, "")?.split("/").pop() ?? "";
        if (!slug) continue;

        const id = await getMangaId(slug);

        const image: string = $("img", manga).first().attr("src") ?? "";
        const title: string = $("span.block.font-bold", manga).first().text().trim() ?? "";
        const subtitle: string =
            $("span.block.font-bold", manga).first().next().text().trim() ?? "";

        if (!id || !title) continue;
        popularSection_Array.push({
            imageUrl: image,
            title: load(title).text(),
            subtitle: load(subtitle).text(),
            mangaId: id,
            type: "simpleCarouselItem",
            contentRating: pbconfig.contentRating,
        });
    }
    return popularSection_Array;
};

export const parseTags = (filters: Filters): TagSection[] => {
    const createTags = (
        filterItems: {
            id: number | string;
            name: string;
        }[],
        prefix: string,
    ): Tag[] => {
        return filterItems.map((item: { id: number | string; name: string }) => ({
            id: `${prefix}_${item.id ?? item.name}`,
            title: item.name,
        }));
    };

    const tagSections: TagSection[] = [
        // Tag section for genres
        {
            id: "0",
            title: "genres",
            tags: createTags(filters.genres, "genres"),
        },
        // Tag section for status
        {
            id: "1",
            title: "status",
            tags: createTags(filters.statuses, "status"),
        },
        // Tag section for types
        {
            id: "2",
            title: "type",
            tags: createTags(filters.types, "type"),
        },
        // Tag section for order
        {
            id: "3",
            title: "order",
            tags: createTags(
                filters.order.map((order) => ({
                    id: order.value,
                    name: order.name,
                })),
                "order",
            ),
        },
    ];
    // throw new Error(tagSections.length.toString())
    return tagSections;
};

export const parseSearch = async ($: CheerioAPI): Promise<SearchResultItem[]> => {
    const collectedIds: string[] = [];
    const itemArray: SearchResultItem[] = [];

    let g = $("div.grid > div");

    console.log("Length of search: " + g.length);

    for (const el of $("div.grid > div").toArray()) {
        const card = $(el);
        const anchor = card.find("a").first();
        const link = anchor.attr("href");
        const slug = link?.replace(/\/$/, "")?.split("/").pop() ?? "";

        if (!slug) continue;

        const title = card.find("h3").text().trim();

        const image = card.find("img").attr("src") ?? "";

        const id = await getMangaId(slug);
        console.log(id);

        const latestChapter = card.find("div.text-xs").first().text().trim();

        itemArray.push({
            imageUrl: image.startsWith("http") ? image : `https://asurascans.com${image}`,
            title: load(title).text(),
            mangaId: id,
            subtitle: latestChapter,
            contentRating: pbconfig.contentRating,
        });

        collectedIds.push(id);
    }

    return itemArray;
};

export const isLastPage = ($: CheerioAPI): boolean => {
    let isLast = true;
    const hasItems = $("a", "div.grid.grid-cols-2").toArray().length > 0;

    if (hasItems) isLast = false;
    return isLast;
};
