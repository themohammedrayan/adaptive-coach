package expo.modules.livewallpaper

import android.content.Context
import org.json.JSONObject

/**
 * Privacy-first debt bits — ratios/counts only, never amounts — see
 * FinanceWallpaperBits in src/finance/wallpaperBits.ts.
 */
data class FinanceBits(
  val payoffPct: Double,
  val daysToFreedom: Int?,
  val nextDueDays: Int?,
)

/** The small payload the RN side pushes and the wallpaper Engine reads — see src/wallpaper/types.ts. */
data class WallpaperSnapshot(
  val daysElapsed: Int,
  val daysRemaining: Int,
  val horizonDays: Int,
  val bankedKcal: Double,
  val totalBudgetKcal: Double,
  val percentComplete: Double?,
  val updatedAt: String,
  /** Null on snapshots written before the finance ring existed, or when there's no debt to show. */
  val finance: FinanceBits?,
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
      // optJSONObject returns null both when the key is absent (a snapshot written
      // before the finance ring existed) and when it's explicitly null — either way
      // the wallpaper just skips drawing the second ring.
      val financeObj = o.optJSONObject("finance")
      val finance = if (financeObj == null) null else FinanceBits(
        payoffPct = financeObj.getDouble("payoffPct"),
        daysToFreedom = if (financeObj.isNull("daysToFreedom")) null else financeObj.getInt("daysToFreedom"),
        nextDueDays = if (financeObj.isNull("nextDueDays")) null else financeObj.getInt("nextDueDays"),
      )
      WallpaperSnapshot(
        daysElapsed = o.getInt("daysElapsed"),
        daysRemaining = o.getInt("daysRemaining"),
        horizonDays = o.getInt("horizonDays"),
        bankedKcal = o.getDouble("bankedKcal"),
        totalBudgetKcal = o.getDouble("totalBudgetKcal"),
        percentComplete = if (o.isNull("percentComplete")) null else o.getDouble("percentComplete"),
        updatedAt = o.getString("updatedAt"),
        finance = finance,
      )
    } catch (e: Exception) {
      null
    }
  }
}
