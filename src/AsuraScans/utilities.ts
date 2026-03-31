import type { TagSection } from "@paperback/types";

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
