import { DS_DOMAIN } from "./config";
import type { DynastyReaderDoujin, DynastyReaderSeries } from "./interfaces";

export async function getOrSetThumbnail(
    method: "GET" | "SET" | "FETCH",
    mangaId: string,
    coverURL?: string,
): Promise<string> {
    async function fetchThumbnail() {
        try {
            const request = {
                url: `${DS_DOMAIN}/${mangaId}.json`, // series/alice_quartet or doujins/alice_quartet
                method: "GET",
            };

            const [_, buffer] = await Application.scheduleRequest(request);
            const data: DynastyReaderDoujin | DynastyReaderSeries = JSON.parse(
                Application.arrayBufferToUTF8String(buffer),
            );

            return DS_DOMAIN + data.cover;
        } catch (error) {
            throw new Error(error as string);
        }
    }

    const hasCover = ((await Application.getState(mangaId)) as string) ?? "";

    let cover = "";
    switch (method) {
        case "GET":
            cover = hasCover;
            break;
        case "SET":
            if (!coverURL) {
                throw new Error("Cannot set new cover with providing a coverURL!");
            }

            Application.setState(coverURL, mangaId);
            cover = coverURL;
            break;
        case "FETCH":
            if (hasCover) {
                cover = hasCover;
                break;
            }

            cover = await fetchThumbnail();
            Application.setState(cover, mangaId);
            break;
    }

    return cover;
}
