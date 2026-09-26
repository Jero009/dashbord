package io.ionic.starter;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * GitHub-style workout activity widget: an 8-week (56-day) grid of rounded
 * squares rendered as ONE pre-rendered bitmap (never nested RemoteViews —
 * many launchers fail to inflate those). Day shade is the app's fixed level
 * encoding: dim grey empty, single red accent alpha for 1 workout, solid
 * accent for 2+. Data comes from the shared snapshot's `activityCounts`
 * array (56 per-day counts, oldest→newest, last entry = today) pushed by
 * widgetBridge.updateActivityWidget from the same queryWorkoutFrequency
 * data the in-app HealthHeatmap uses.
 */
public class ActivityWidgetProvider extends AppWidgetProvider {

    // Mirror of the Vue shadeFor() levels in HealthHeatmap.vue: red is the
    // ONE accent, alpha encodes density. Keep in sync with the app side.
    private static final int CELL_DIM = 0x1FFFFFFF;    // rgba(--nt-ink, ~12%)
    private static final int CELL_L1 = 0x59D71A21;     // 1 workout — 35% accent
    private static final int CELL_L2 = 0xFFD71A21;     // 2+ workouts — solid accent

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        String json = context.getSharedPreferences(
                DashboardWidgetPlugin.PREFS, Context.MODE_PRIVATE)
                .getString("snapshot", "{}");
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context, json));
        }
    }

    static RemoteViews buildViews(Context context, String json) {
        boolean os5 = WidgetTheme.isOs5(json);
        RemoteViews views = new RemoteViews(context.getPackageName(),
                os5 ? R.layout.widget_activity_os5 : R.layout.widget_activity);

        int[] counts = new int[56];
        int total = 0;
        int streak = 0;
        try {
            JSONObject data = new JSONObject(json);
            JSONArray arr = data.optJSONArray("activityCounts");
            if (arr != null) {
                int n = Math.min(arr.length(), counts.length);
                // Copy to the END of the array so today stays the last cell
                // even when a short array arrives (e.g. fresh install).
                for (int i = 0; i < n; i++) {
                    int v = Math.max(0, arr.getInt(i));
                    counts[counts.length - n + i] = v;
                    total += v;
                    if (v > 0) streak++;
                }
            }
        } catch (Exception ignored) {
            // Malformed snapshot → empty grid with fallback strings
        }

        views.setTextViewText(R.id.activity_total, String.valueOf(total));
        views.setTextViewText(R.id.activity_streak, streak + "d");

        views.setImageViewBitmap(R.id.activity_grid, drawGrid(context, counts, os5));

        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 2, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.activity_root, pi);
        }
        return views;
    }

    /**
     * 8 columns (weeks, oldest→newest, left→right) × 7 rows (Sun–Sat, top→
     * bottom), rounded-square cells. Mirrors the HealthHeatmap grid layout;
     * one bitmap inflates on every launcher.
     */
    static Bitmap drawGrid(Context context, int[] counts, boolean os5) {
        float density = context.getResources().getDisplayMetrics().density;
        float cell = 12f * density;
        float gap = 3f * density;
        int size = (int) ((cell + gap) * 7 - gap + 2 * 4 * density); // 7 columns + padding

        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        float pad = 4f * density;

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.FILL);

        float radius = 3f * density;
        for (int week = 0; week < 8; week++) {
            for (int dow = 0; dow < 7; dow++) {
                int idx = week * 7 + dow;
                if (idx >= counts.length) continue;
                int c = counts[idx];
                paint.setColor(c >= 2 ? CELL_L2 : c == 1 ? CELL_L1 : CELL_DIM);
                float left = pad + week * (cell + gap);
                float top = pad + dow * (cell + gap);
                canvas.drawRoundRect(new RectF(left, top, left + cell, top + cell), radius, radius, paint);
            }
        }
        return bmp;
    }
}
