// Chapters
export interface DynastyReaderChapters {
    title: string;
    long_title: string;
    permalink: string;
    tags: DynastyReaderTag[];
    pages: DynastyReaderPage[];
    released_on: Date;
    added_on: Date;
}

export interface DynastyReaderPage {
    name: string;
    url: string;
}

export interface DynastyReaderTag {
    type: string;
    name: string;
    permalink: string;
}

// Series
export interface DynastyReaderSeries {
    name: string;
    type: string;
    permalink: string;
    tags: DynastyReaderTag[];
    cover: string;
    link: string;
    description: string;
    aliases: string[];
    taggings: DynastyReaderTagging[];
    current_page?: number;
    total_pages?: number;
}

export interface DynastyReaderTagging {
    title: string;
    permalink: string;
    released_on: Date;
    tags: DynastyReaderTag[];
    header?: string;
}

// Doujin
export interface DynastyReaderDoujin {
    name: string;
    type: string;
    permalink: string;
    tags: DynastyReaderTag[];
    cover: string;
    link: string;
    description: string;
    aliases: string[];
    taggings: DynastyReaderTagging[];
    current_page: number;
    total_pages: number;
}

// Recently Added
export interface DynastyReaderRecentlyAdded {
    chapters: DynastyReaderChapter[];
    current_page: number;
    total_pages: number;
}

export interface DynastyReaderTagResponse {
    tags: DynastyReaderTag[];
    current_page: number;
    total_pages: number;
}

export interface DynastyReaderChapter {
    title: string;
    series: null | string;
    permalink: string;
    tags: DynastyReaderTag[];
}
