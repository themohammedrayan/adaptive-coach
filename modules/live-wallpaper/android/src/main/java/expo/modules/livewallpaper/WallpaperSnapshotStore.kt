package expo.modules.livewallpaper

import android.content.Context
import org.json.JSONObject

/** The small payload the RN side pushes and the wallpaper Engine reads — see src/wallpaper/types.ts. */
data class WallpaperSnapshot(
  val daysElapsed: Int,
  val daysRemaining: Int,
  val horizonDays: Int,
  val bankedKcal: Double,
  val totalBudgetKcal: Double,
  val percentComplete: Double?,
  val updatedAt: String,
)

/**
 * Shared read/write for the wallpaper snapshot file. Both LiveWallpaperModule (writer, called
 * from RN) and LiveWallpaperService (reader, drawn on the home screen) run in the same
 * app process/UID, so a private app file is enough — no content provider or IPC needed.
 */
object WallpaperSnapshotStore {
  private const val FILE_NAME = "wallpaper_snapshot.json"

  fun write(context: Context, json: String) {
    context.openFileOutput(FILE_NAME, Context.MODE_PRIVATE).use { it.write(json.toByteArray(Charsets.UTF_8)) }
  }

  /** Null when nothing has been written yet (fresh install) or the file is unreadable/corrupt —
   * callers must render a placeholder rather than crash, since this runs inside a WallpaperService. */
  fun read(context: Context): WallpaperSnapshot? {
    return try {
      val text = context.openFileInput(FILE_NAME).use { it.readBytes().toString(Charsets.UTF_8) }
      val o = JSONObject(text)
      WallpaperSnapshot(
        daysElapsed = o.getInt("daysElapsed"),
        daysRemaining = o.getInt("daysRemaining"),
        horizonDays = o.getInt("horizonDays"),
        bankedKcal = o.getDouble("bankedKcal"),
        totalBudgetKcal = o.getDouble("totalBudgetKcal"),
        percentComplete = if (o.isNull("percentComplete")) null else o.getDouble("percentComplete"),
        updatedAt = o.getString("updatedAt"),
      )
    } catch (e: Exception) {
      null
    }
  }
}
