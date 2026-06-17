declare class Canvas {
    constructor(width: number, height: number);
    getContext(type: "2d"): CanvasRenderingContext2D;
    toDataURL(): string;
}

declare class Image {
    src: string | Uint8Array;
    width: number;
    height: number;
}
