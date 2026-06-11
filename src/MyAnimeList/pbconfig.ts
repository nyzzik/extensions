import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
    name: "MyAnimeList",
    description: "Extension that pulls content from myanimelist.net.",
    version: "1.0.0-alpha.1",
    icon: "icon.png",
    language: "en",
    contentRating: ContentRating.EVERYONE,
    capabilities: [
        SourceIntents.DISCOVER_SECTION_PROVIDING,
        SourceIntents.PROGRESS_PROVIDING,
        SourceIntents.SETTINGS_FORM_PROVIDING,
        SourceIntents.SEARCH_RESULT_PROVIDING,
        SourceIntents.MANAGED_COLLECTION_PROVIDING,
    ],
    badges: [],
    developers: [
        {
            name: "nyzzik",
            github: "https://github.com/nyzzik",
        },
    ],
} satisfies ExtensionInfo;
