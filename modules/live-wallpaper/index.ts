import LiveWallpaperModule from './src/LiveWallpaperModule';

export function writeSnapshot(json: string): void {
  LiveWallpaperModule.writeSnapshot(json);
}

export function openWallpaperChooser(): void {
  LiveWallpaperModule.openWallpaperChooser();
}
