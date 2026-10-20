export const SOURCE_PAGE_WIDTH = 1300;

export const imageWidthPercent = (naturalWidth: number) => Math.min(100, naturalWidth / SOURCE_PAGE_WIDTH * 100);
export const imageViewerWidth = (naturalWidth: number) => naturalWidth / 2;
