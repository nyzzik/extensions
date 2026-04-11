import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
    name: "Asura Scans",
    description: "Extension that pulls content from asurascans.com.",
    version: "1.0.0-alpha.26",
    icon: "icon.png",
    language: "en",
    contentRating: ContentRating.EVERYONE,
    capabilities: [
        SourceIntents.CHAPTER_PROVIDING,
        SourceIntents.DISCOVER_SECTION_PROVIDING,
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
