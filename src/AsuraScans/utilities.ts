import type { TagSection } from "@paperback/types";
import type { PageData, TagSectionId } from "./interfaces/interfaces";

export async function setFilters(data: TagSection[]): Promise<void> {
    for (const section of data) {
        Application.setState(section, section.title.toUpperCase());
    }
}

export async function getFilter(filter: string): Promise<TagSection> {
    const section = (await Application.getState(filter.toUpperCase())) as TagSection;
    return section;
}

export async function getMangaId(slug: string): Promise<string> {
    const id = idCleaner(slug);

    return id;
}

function idCleaner(str: string): string {
    let cleanId: string | null = str;
    cleanId = cleanId.replace(/\/$/, "");
    cleanId = cleanId.split("/").pop() ?? null;
    // Remove randomised slug part
    cleanId = cleanId?.substring(0, cleanId?.lastIndexOf("-")) ?? null;

    if (!cleanId) {
        throw new Error(`Unable to parse id for ${str}`);
    }

    return cleanId;
}

export function getTagFromTagStore(tagId: TagSectionId, tags: TagSection[]): TagSection {
    const tag = tags.find((x) => (x.id as TagSectionId) === tagId);
    if (tag === undefined) {
        throw new Error(`${tagId} Tag section not found`);
    }
    return tag;
}

export async function unscramble(this: void, data: PageData): Promise<string> {
    const config = data;
    if (!config.url || !config.tiles || !config.tile_cols || !config.tile_rows) {
        return config.url;
    }

    const [res, buffer] = await Application.scheduleRequest({ url: config.url, method: "GET" });
    let contentType = res.headers["Content-Type"];

    let str: string = `data:${contentType};base64,${Application.base64Encode(buffer)}`;

    return new Promise((res, reject) => {
        const image = new Image();
        // image.crossOrigin = "Anonymous";
        image.onload = () => {
            const canvas = new CanvasAPI(image.width, image.height);
            const ctx = canvas.getContext("2d");

            const tileW = image.width / config.tile_cols;
            const tileH = image.height / config.tile_rows;

            config.tiles.forEach((destIndex, sourceIndex) => {
                const sx = (sourceIndex % config.tile_cols) * tileW;
                const sy = Math.floor(sourceIndex / config.tile_cols) * tileH;

                const dx = (destIndex % config.tile_cols) * tileW;
                const dy = Math.floor(destIndex / config.tile_cols) * tileH;

                ctx.drawImage(image, sx, sy, tileW, tileH, dx, dy, tileW, tileH);
            });
            res(canvas.toDataURL());
        };
        image.onerror = () => {
            reject(new Error("Failed to load image for unscrambling."));
        };
        image.src = str;
    });
    return "";
}

declare class CanvasAPI {
    constructor(width: number, height: number);
    getContext(contextId: "2d"): CanvasRenderingContext2D;
    toDataURL(): string;
}
