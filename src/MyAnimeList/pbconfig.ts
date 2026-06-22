import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
    name: "MyAnimeList",
    description: "Extension that pulls content from myanimelist.net.",
    version: "1.0.5",
    icon: "icon.png",
    language: "en",
    contentRating: ContentRating.EVERYONE,
    capabilities: [
        SourceIntents.PROGRESS_PROVIDING,
        SourceIntents.SETTINGS_FORM_PROVIDING,
        SourceIntents.SEARCH_RESULT_PROVIDING,
    ],
    badges: [],
    developers: [
        {
            name: "nyzzik",
            github: "https://github.com/nyzzik",
        },
    ],
} satisfies ExtensionInfo;
