package expo.modules.livewallpaper

import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LiveWallpaperModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LiveWallpaper")

    Function("writeSnapshot") { json: String ->
      val context = appContext.reactContext ?: return@Function
      WallpaperSnapshotStore.write(context, json)
      // Redraw immediately if the wallpaper happens to be on-screen right now, rather than
      // waiting for the next lock/unlock visibility change.
      LiveWallpaperService.requestRedraw()
    }

    Function("openWallpaperChooser") {
      val context = appContext.reactContext ?: return@Function Unit
      val componentName = ComponentName(context.packageName, LiveWallpaperService::class.java.name)
      val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER)
        .putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, componentName)

      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
  }
}
