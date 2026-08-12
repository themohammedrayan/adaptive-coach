package expo.modules.livewallpaper

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
import java.lang.ref.WeakReference
import kotlin.math.max
import kotlin.math.min

/**
 * Static challenge meter on a black background — days remaining + calories banked,
 * matching what src/dashboard/components/ChallengeCard.tsx shows on the Dashboard.
 * There is no animation loop: the Engine only redraws on visibility changes and when
 * writeSnapshot() pushes fresh data while it happens to be on-screen (see companion object).
 */
class LiveWallpaperService : WallpaperService() {

  companion object {
    private var activeEngine: WeakReference<ChallengeEngine>? = null

    fun requestRedraw() {
      activeEngine?.get()?.redraw()
    }
  }

  override fun onCreateEngine(): Engine = ChallengeEngine()

  inner class ChallengeEngine : Engine() {
    private val density = resources.displayMetrics.density

    private val titlePaint = Paint().apply {
      color = Color.WHITE
      isAntiAlias = true
      textAlign = Paint.Align.CENTER
      typeface = Typeface.DEFAULT_BOLD
      textSize = 30f * density
    }
    private val labelPaint = Paint().apply {
      color = Color.LTGRAY
      isAntiAlias = true
      textAlign = Paint.Align.CENTER
      textSize = 15f * density
    }
    private val trackPaint = Paint().apply { color = Color.DKGRAY }
    private val fillPaint = Paint().apply { color = Color.WHITE }
    private val captionPaint = Paint().apply {
      color = Color.GRAY
      isAntiAlias = true
      textAlign = Paint.Align.CENTER
      textSize = 12f * density
    }

    // Unlabeled second ring for the finance payoff bit — deliberately styled
    // as a plain progress ring + bare number, with no "debt"/"payoff" text
    // anywhere, so it reads as generic to anyone but the owner.
    private val financeRingTrackPaint = Paint().apply {
      color = Color.DKGRAY
      style = Paint.Style.STROKE
      strokeWidth = 5f * density
      strokeCap = Paint.Cap.ROUND
      isAntiAlias = true
    }
    private val financeRingFillPaint = Paint().apply {
      color = Color.rgb(0x4F, 0xC3, 0xF7)
      style = Paint.Style.STROKE
      strokeWidth = 5f * density
      strokeCap = Paint.Cap.ROUND
      isAntiAlias = true
    }
    private val financeRingNumberPaint = Paint().apply {
      color = Color.LTGRAY
      isAntiAlias = true
      textAlign = Paint.Align.CENTER
      textSize = 13f * density
    }

    private var visible = false

    override fun onCreate(surfaceHolder: SurfaceHolder) {
      super.onCreate(surfaceHolder)
      activeEngine = WeakReference(this)
    }

    override fun onVisibilityChanged(visible: Boolean) {
      this.visible = visible
      if (visible) redraw()
    }

    override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
      super.onSurfaceChanged(holder, format, width, height)
      if (visible) redraw()
    }

    override fun onDestroy() {
      super.onDestroy()
      if (activeEngine?.get() === this) activeEngine = null
    }

    fun redraw() {
      if (!visible) return
      val holder = surfaceHolder ?: return
      var canvas: Canvas? = null
      try {
        canvas = holder.lockCanvas()
        if (canvas != null) draw(canvas)
      } catch (e: Exception) {
        // A WallpaperService crash takes down the home screen — never let a draw error escape.
      } finally {
        if (canvas != null) {
          try {
            holder.unlockCanvasAndPost(canvas)
          } catch (e: Exception) {
          }
        }
      }
    }

    private fun draw(canvas: Canvas) {
      canvas.drawColor(Color.BLACK)
      val w = canvas.width.toFloat()
      val h = canvas.height.toFloat()
      val centerX = w / 2f
      val snapshot = WallpaperSnapshotStore.read(applicationContext)

      if (snapshot == null) {
        canvas.drawText("Open Adaptive Coach to set up your challenge", centerX, h * 0.42f, labelPaint)
        return
      }

      var y = h * 0.42f
      canvas.drawText("${snapshot.daysRemaining} days left", centerX, y, titlePaint)

      y += 28f * density
      canvas.drawText("of ${snapshot.horizonDays}-day challenge", centerX, y, labelPaint)

      y += 48f * density
      val barWidth = w * 0.7f
      val barHeight = 14f * density
      val left = centerX - barWidth / 2f
      val radius = barHeight / 2f
      canvas.drawRoundRect(RectF(left, y, left + barWidth, y + barHeight), radius, radius, trackPaint)

      val pct = snapshot.percentComplete?.let { max(0.0, min(1.0, it)) } ?: 0.0
      if (pct > 0.0) {
        val fillRight = left + (barWidth * pct).toFloat()
        canvas.drawRoundRect(RectF(left, y, fillRight, y + barHeight), radius, radius, fillPaint)
      }

      y += barHeight + 26f * density
      val bankedText = if (snapshot.percentComplete != null) {
        "${snapshot.bankedKcal.toInt()} / ${snapshot.totalBudgetKcal.toInt()} kcal banked (${(pct * 100).toInt()}%)"
      } else {
        "${snapshot.bankedKcal.toInt()} kcal banked"
      }
      canvas.drawText(bankedText, centerX, y, labelPaint)

      canvas.drawText("Updated ${snapshot.updatedAt}", centerX, h * 0.9f, captionPaint)

      // Isolated from the fitness draw above — a bad finance payload must not
      // blank out the meter that already rendered successfully.
      val finance = snapshot.finance
      if (finance != null) {
        try {
          drawFinanceRing(canvas, w, h, finance)
        } catch (e: Exception) {
        }
      }
    }

    private fun drawFinanceRing(canvas: Canvas, w: Float, h: Float, finance: FinanceBits) {
      val ringRadius = 22f * density
      val cx = w - ringRadius - 24f * density
      val cy = h * 0.12f
      val rect = RectF(cx - ringRadius, cy - ringRadius, cx + ringRadius, cy + ringRadius)
      canvas.drawArc(rect, 0f, 360f, false, financeRingTrackPaint)
      val sweep = (max(0.0, min(1.0, finance.payoffPct)) * 360.0).toFloat()
      if (sweep > 0f) {
        canvas.drawArc(rect, -90f, sweep, false, financeRingFillPaint)
      }
      val days = finance.daysToFreedom
      if (days != null) {
        canvas.drawText("$days", cx, cy + 5f * density, financeRingNumberPaint)
      }
    }
  }
}
