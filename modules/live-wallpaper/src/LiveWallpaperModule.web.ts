import { registerWebModule, NativeModule } from 'expo';

// Android-only feature — web builds never call these (src/wallpaper/sync.ts guards on
// Platform.OS !== 'android' before importing this module at all). Stubs exist only so
// web bundling of the module doesn't error.
class LiveWallpaperModule extends NativeModule<{}> {
  writeSnapshot(_json: string): void {}
  openWallpaperChooser(): void {}
}

export default registerWebModule(LiveWallpaperModule, 'LiveWallpaperModule');
