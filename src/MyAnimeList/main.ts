import {
    type Extension,
    type Form,
    type SearchQuery,
    type SearchResultItem,
    type Metadata,
    type PagedResults,
    type SearchResultsProviding,
    type SettingsFormProviding,
    type SortingOption,
    type SourceManga,
    type MangaProgressProviding,
    type ChapterReadActionQueueProcessingResult,
    type MangaProgress,
    type TrackedMangaChapterReadAction,
    type Request,
    ContentRating,
} from "@paperback/types";
import { MALSettingsForm } from "./forms/settings";
import { URLBuilder } from "../utils/url-builder/base";
import type {
    MyAnimeListManga,
    MyAnimeListMangaListPost,
    MyAnimeListMangaListResponse,
    MyAnimeListMetadata,
} from "./interfaces";
import { MyAnimeListInterceptor } from "./interceptor";
import { TrackingForm } from "./forms/tracking";

export class MyAnimeListExtension
    implements Extension, SearchResultsProviding, SettingsFormProviding, MangaProgressProviding
{
    globalInterceptor = new MyAnimeListInterceptor("main");

    async initialise(): Promise<void> {
        this.globalInterceptor.registerInterceptor();
    }
    async getMangaProgressManagementForm(sourceManga: SourceManga): Promise<Form> {
        if (!Application.getState("malAccessToken")) throw new Error("You are not signed in.");
        return new TrackingForm(sourceManga.mangaId);
    }
    async getMangaProgress(sourceManga: SourceManga): Promise<MangaProgress | undefined> {
        if (!Application.getState("malAccessToken")) throw new Error("You are not signed in.");
        const url = `https://api.myanimelist.net/v2/manga/${sourceManga.mangaId}?fields=my_list_status`;

        const request: Request = {
            url,
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);
        const json = JSON.parse(Application.arrayBufferToUTF8String(buffer)) as MyAnimeListManga;
        if (json?.my_list_status?.num_chapters_read === undefined) {
            throw new Error("Not yet tracking.");
        }

        return {
            sourceManga,
            lastReadChapter: {
                chapterId: json?.my_list_status?.num_chapters_read.toString(),
                sourceManga,
                langCode: "unknown",
                chapNum: json?.my_list_status?.num_chapters_read,
            },
        };
    }
    async processChapterReadActionQueue(
        actions: TrackedMangaChapterReadAction[],
    ): Promise<ChapterReadActionQueueProcessingResult> {
        const trackedReadActions: ChapterReadActionQueueProcessingResult = {
            successfulItems: [],
            failedItems: [],
        };

        if (!Application.getState("malAccessToken")) {
            return trackedReadActions;
        }
        const highestChapters: Map<string, number> = new Map();
        for (const action of actions) {
            if ((highestChapters.get(action.sourceManga.mangaId) ?? 0) < action.chapterNum) {
                highestChapters.set(action.sourceManga.mangaId, action.chapterNum);
            }
        }

        for (const action of actions) {
            if (highestChapters.get(action.sourceManga.mangaId) != action.chapterNum) {
                trackedReadActions.successfulItems.push(action.id);
                continue;
            }

            const url = `https://api.myanimelist.net/v2/manga/${action.sourceManga.mangaId}?fields=my_list_status`;

            const request: Request = {
                url,
                method: "GET",
            };

            const [_, buffer] = await Application.scheduleRequest(request);
            const json = JSON.parse(
                Application.arrayBufferToUTF8String(buffer),
            ) as MyAnimeListManga;

            if ((json.my_list_status?.num_chapters_read ?? 0) >= action.chapterNum) {
                trackedReadActions.successfulItems.push(action.id);
                continue;
            }

            const data: MyAnimeListMangaListPost = {
                num_chapters_read: action.chapterNum,
                status: "reading",
            };

            if (action.chapterVolume && action.chapterVolume > 0) {
                data.num_volumes_read = action.chapterVolume;
            }

            const formBody = Object.keys(data)
                .map(
                    (key) =>
                        encodeURIComponent(key) +
                        "=" +
                        encodeURIComponent(data[key as keyof MyAnimeListMangaListPost] as string),
                )
                .join("&");

            const put: Request = {
                url: `https://api.myanimelist.net/v2/manga/${action.sourceManga.mangaId}/my_list_status`,
                method: "PUT",
                body: formBody,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            };

            const [res, _2] = await Application.scheduleRequest(put);
            if (res.status === 200) {
                trackedReadActions.successfulItems.push(action.id);
            } else {
                trackedReadActions.failedItems.push(action.id);
            }
        }

        return trackedReadActions;
    }
    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        //  let urlBuilder = new URLBuilder("https://api.myanimelist.net/v2/manga");
        // urlBuilder = urlBuilder.addPath(mangaId);

        const request: Request = {
            url: `https://api.myanimelist.net/v2/manga/${mangaId}?fields=id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,rank,popularity,num_list_users,num_scoring_users,nsfw,created_at,updated_at,media_type,status,genres,my_list_status,num_volumes,num_chapters,authors{first_name,last_name},pictures,background,related_anime,related_manga,recommendations,serialization{name}`,
            method: "GET",
        };

        const [_, buffer] = await Application.scheduleRequest(request);
        const response: MyAnimeListManga = JSON.parse(
            Application.arrayBufferToUTF8String(buffer),
        ) as MyAnimeListManga;

        return {
            mangaId,
            mangaInfo: {
                thumbnailUrl: response.main_picture.medium,
                synopsis: response.synopsis ?? "",
                primaryTitle: response.title,
                secondaryTitles: response.alternative_titles?.synonyms ?? [],
                contentRating: ContentRating.EVERYONE,
                status: response.status,
                rating: (response.mean ?? 0) / 10,
                artworkUrls: response.pictures.map((p) => p.medium),
            },
        };
    }
    async getSearchResults(
        query: SearchQuery<Metadata>,
        metadata: MyAnimeListMetadata,
        _sortingOption: SortingOption | undefined,
    ): Promise<PagedResults<SearchResultItem>> {
        let urlBuilder;
        if (metadata && metadata.next && metadata.next.length > 0) {
            urlBuilder = new URLBuilder(metadata.next);
        } else {
            metadata = {};
            if (query.title.length < 3) {
                urlBuilder = new URLBuilder("https://api.myanimelist.net/v2/manga/ranking");
            } else {
                urlBuilder = new URLBuilder("https://api.myanimelist.net/v2/manga");
                urlBuilder = urlBuilder.addQuery("q", query?.title ?? "");
            }
            urlBuilder = urlBuilder.addQuery("limit", 30);
            urlBuilder = urlBuilder.addQuery(
                "nsfw",
                (Application.getState("nsfw") as boolean) ?? false,
            );
        }
        const request: Request = {
            url: urlBuilder.build(),
            method: "GET",
        };
        let items: SearchResultItem[] = [];
        const [_, buffer] = await Application.scheduleRequest(request);
        const response = JSON.parse(
            Application.arrayBufferToUTF8String(buffer),
        ) as MyAnimeListMangaListResponse;
        metadata.next = response.paging.next;
        for (const item of response.data) {
            items.push({
                mangaId: item.node.id.toString(),
                imageUrl: item.node.main_picture.medium,
                title: item.node.title,
            });
        }

        return {
            items,
            metadata,
        };
    }
    async getSettingsForm(): Promise<Form> {
        return new MALSettingsForm();
    }
}

export const MyAnimeList = new MyAnimeListExtension();
