import {
    Chapter,
    ChapterDetails,
    ContentRating,
    DiscoverSectionItem,
    SearchResultItem,
    SourceManga,
    Tag,
    TagSection,
} from "@paperback/types";
import { CheerioAPI, load } from "cheerio";
import { URLBuilder } from "../utils/url-builder/base";
import { AS_DOMAIN } from "./config";
import { AsuraChaptersPayload, Filters } from "./interfaces/interfaces";
import pbconfig from "./pbconfig";
import { getShowUpcomingChapters } from "./settings";
import { getFilter, getMangaId } from "./utilities";

export const parseMangaDetails = async (
    $: CheerioAPI,
    mangaId: string,
): Promise<SourceManga> => {
    const title =
        $("h3.hover\\:text-themecolor:nth-child(3)").text().trim() ?? "";
    const image = $('img[alt="poster"]').attr("src") ?? "";
    const description = $("span.font-medium.text-sm").text().trim() ?? "";

    const author = $('h3:contains("Author")').next().text().trim() ?? "";
    const artist = $('h3:contains("Artist")').next().text().trim() ?? "";

    const arrayTags: Tag[] = [];
    for (const tag of $(
        "button",
        $('h3:contains("Genres")').next(),
    ).toArray()) {
        const label = $(tag).text().trim();
        const filterName = label.toLocaleUpperCase();

        const id = await getFilter(filterName);

        if (!id || !label) continue;
        arrayTags.push({ id: `genres_${id}`, title: label });
    }
    const tagSections: TagSection[] = [
        { id: "0", title: "genres", tags: arrayTags },
    ];

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
            author:
                load(author).text() === "_" ? undefined : load(author).text(),
            artist:
                load(artist).text() === "_" ? undefined : load(artist).text(),
            tagGroups: tagSections,
            synopsis: load(description).text(),
            thumbnailUrl: image,
            contentRating: ContentRating.EVERYONE,
            shareUrl: new URLBuilder(AS_DOMAIN)
                .addPath("series")
                .addPath(mangaId)
                .build(),
        },
    };
};

function extractObjectContaining(input: string, needle: string): string | null {
    const needleIndex = input.indexOf(needle);
    if (needleIndex === -1) return null;

    // Walk backwards to find the opening {
    let start = -1;
    let depth = 0;

    for (let i = needleIndex; i >= 0; i--) {
        if (input[i] === "}") depth++;
        else if (input[i] === "{") {
            if (depth === 0) {
                start = i;
                break;
            }
            depth--;
        }
    }

    if (start === -1) return null;

    // Walk forwards to find the matching }
    depth = 0;
    for (let i = start; i < input.length; i++) {
        if (input[i] === "{") depth++;
        else if (input[i] === "}") {
            depth--;
            if (depth === 0) {
                return input.slice(start, i + 1);
            }
        }
    }

    return null;
}

function unescapeJsString(input: string): string {
    return input
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
}

function decodeUnicodeEscapes(input: string): string {
    return input.replace(/\\u([0-9a-fA-F]{4})/g, (_, code: string) =>
        String.fromCharCode(parseInt(code, 16)),
    );
}

export const parseChapters = (
    $: CheerioAPI,
    sourceManga: SourceManga,
): Chapter[] => {
    const chapters: Chapter[] = [];
    let sortingIndex = 0;

    const scripts: string[] = $("script")
        .map((_, el) => $(el).html())
        .get()
        .filter((s): s is string => typeof s === "string");

    const flightPayloads: string[] = scripts.flatMap((script) =>
        Array.from(
            script.matchAll(/__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g),
            (m) => decodeUnicodeEscapes(unescapeJsString(m[1])),
        ),
    );

    // console.log(flightPayloads);

    const chapterPayload = flightPayloads.find((p) =>
        p.includes('"chapters":['),
    );

    if (!chapterPayload) {
        throw new Error("Chapters payload not found");
    }

    const jsonText = extractObjectContaining(chapterPayload, '"chapters":[');

    if (!jsonText) {
        throw new Error("Failed to extract chapters JSON");
    }

    const parsed = JSON.parse(jsonText) as AsuraChaptersPayload;
    // console.log(jsonText);
    if (parsed === null || !("chapters" in parsed)) {
        throw new Error("Invalid chapters payload structure");
    }
    parsed.chapters.forEach((chapter) => {
        if (!getShowUpcomingChapters() && chapter.is_early_access) return;
        // console.log(chapter.published_at);
        const date = new Date(chapter.published_at);
        let title = chapter.title ?? "";
        if (chapter.is_early_access) {
            if (!date) return;
            const hours = date.getHours() + 6;
            date.setHours(hours);
            title = `(Early Access) ${chapter.title ?? ""}`.trim();
        }
        chapters.push({
            chapterId: chapter.id.toString(),
            title: title,
            langCode: "🇬🇧",
            chapNum: chapter.name,
            volume: 0,
            publishDate: date,
            sortingIndex,
            sourceManga,
        });
        sortingIndex++;
    });

    // for (const chapter of $(
    //     "div",
    //     "div.pl-4.pr-2.pb-4.overflow-y-auto",
    // ).toArray()) {
    //     const id =
    //         $("a", chapter)
    //             .attr("href")
    //             ?.replace(/\/$/, "")
    //             ?.split("/")
    //             .pop()
    //             ?.trim() ?? "";

    //     const title = $("h3", chapter).first().text().trim().split(id)[1] ?? "";

    //     if (!id || isNaN(Number(id))) continue;
    //     const svg = $("svg", chapter);
    //     if (!getShowUpcomingChapters() && svg.toString() !== "") continue;

    //     const rawDate = $("h3", chapter).last().text().trim() ?? "";
    //     const date = new Date(rawDate.replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1"));

    // }

    if (chapters.length == 0) {
        throw new Error(
            `Couldn't find any chapters for mangaId: ${sourceManga.mangaId}!`,
        );
    }

    // return chapters.map((chapter) => {
    //     if (chapter.sortingIndex != undefined)
    //         chapter.sortingIndex += chapters.length;
    //     return chapter;
    // });
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

export const parseFeaturedSection = async (
    $: CheerioAPI,
): Promise<DiscoverSectionItem[]> => {
    // Featured
    const featuredSection_Array: DiscoverSectionItem[] = [];
    for (const manga of $("li.slide", "ul.slider.animated").toArray()) {
        const slug =
            $("a", manga).attr("href")?.replace(/\/$/, "")?.split("/").pop() ??
            "";
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
            const slug =
                $("a", item)
                    .attr("href")
                    ?.replace(/\/$/, "")
                    ?.split("/")
                    .pop() ?? "";
            if (!slug) continue;

            const id = await getMangaId(slug);

            const image: string = $("img", item).first().attr("src") ?? "";
            const title: string =
                $(".col-span-9 > .font-medium > a", item)
                    .first()
                    .text()
                    .trim() ?? "";
            let subtitle: string =
                $(".flex.flex-col .flex-row a", item).first().text().trim() ??
                "";
            const subtitleContext: string =
                $("p.flex.items-end", item).text().trim() ?? "";
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
            const slug =
                $(item).attr("href")?.replace(/\/$/, "")?.split("/").pop() ??
                "";
            if (!slug) continue;

            const id = await getMangaId(slug);

            const image: string = $("img", item).first().attr("src") ?? "";
            const title: string =
                $("span.block.font-bold", item).first().text().trim() ?? "";
            const subtitle: string =
                $("span.block.font-bold", item).first().next().text().trim() ??
                "";

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

export const parsePopularSection = async (
    $: CheerioAPI,
): Promise<DiscoverSectionItem[]> => {
    // Popular Today
    const popularSection_Array: DiscoverSectionItem[] = [];
    for (const manga of $("a", "div.flex-wrap.hidden").toArray()) {
        const slug =
            $(manga).attr("href")?.replace(/\/$/, "")?.split("/").pop() ?? "";
        if (!slug) continue;

        const id = await getMangaId(slug);

        const image: string = $("img", manga).first().attr("src") ?? "";
        const title: string =
            $("span.block.font-bold", manga).first().text().trim() ?? "";
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
        return filterItems.map(
            (item: { id: number | string; name: string }) => ({
                id: `${prefix}_${item.id ?? item.name}`,
                title: item.name,
            }),
        );
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

export const parseSearch = async (
    $: CheerioAPI,
): Promise<SearchResultItem[]> => {
    const collectedIds: string[] = [];
    const itemArray: SearchResultItem[] = [];

    for (const item of $("a", "div.grid.grid-cols-2").toArray()) {
        const slug =
            $(item).attr("href")?.replace(/\/$/, "")?.split("/").pop() ?? "";
        if (!slug) continue;

        const id = await getMangaId(slug);

        const image: string = $("img", item).first().attr("src") ?? "";
        const title: string =
            $("span.block.font-bold", item).first().text().trim() ?? "";
        const subtitle: string =
            $("span.block.font-bold", item).first().next().text().trim() ?? "";

        itemArray.push({
            imageUrl: image,
            title: load(title).text(),
            mangaId: id,
            subtitle: subtitle,
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
