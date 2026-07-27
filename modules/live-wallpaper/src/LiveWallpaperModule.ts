import { NativeModule, requireNativeModule } from 'expo';

declare class LiveWallpaperModule extends NativeModule<{}> {
  /** Writes a JSON-serialized WallpaperSnapshot to the private file the wallpaper's Engine reads. */
  writeSnapshot(json: string): void;
  /** Launches the system "set as wallpaper" picker pointed at this app's LiveWallpaperService. */
  openWallpaperChooser(): void;
}

export default requireNativeModule<LiveWallpaperModule>('LiveWallpaper');
