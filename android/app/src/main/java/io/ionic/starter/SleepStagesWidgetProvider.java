package io.ionic.starter;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Sleep Stages widget: summary row (total / deep / REM) plus a horizontal
 * stacked timeline of the night's stages, colored with the app-wide fixed
 * stage palette. The timeline is pre-rendered to a bitmap at sync time —
 * nested RemoteViews layouts are fragile across launchers, bitmaps are not.
 * Data comes from the shared snapshot pushed by DashboardWidgetPlugin
 * (stageSegments JSON array with fractional weights).
 */
public class SleepStagesWidgetProvider extends AppWidgetProvider {

    // Fixed app-wide stage colors (match the Vue charts)
    private static final int COLOR_DEEP = 0xFF384860;
    private static final int COLOR_LIGHT = 0xFF71717A;
    private static final int COLOR_REM = 0xFFE5C158;
    private static final int COLOR_AWAKE = 0xFFD71A21;
    private static final int COLOR_ASLEEP = 0xFF555555;
    private static final int COLOR_INBED = 0xFF333333;

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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_sleep_stages);

        String total = "--";
        String deep = "--";
        String rem = "--";
        String bedtime = "--";
        String waketime = "--";
        JSONArray segments = null;
        try {
            JSONObject data = new JSONObject(json);
            total = data.optString("sleepDuration", "--");
            deep = data.optString("deepDuration", "--");
            rem = data.optString("remDuration", "--");
            bedtime = data.optString("bedtime", "--");
            waketime = data.optString("waketime", "--");
            segments = data.optJSONArray("stageSegments");
        } catch (Exception ignored) {
            // Malformed snapshot → keep the fallback strings
        }

        views.setTextViewText(R.id.stages_total, total);
        views.setTextViewText(R.id.stages_deep, deep);
        views.setTextViewText(R.id.stages_rem, rem);
        views.setTextViewText(R.id.stages_bedtime, bedtime);
        views.setTextViewText(R.id.stages_waketime, waketime);

        int density = (int) context.getResources().getDisplayMetrics().density;
        views.setImageViewBitmap(R.id.stages_bar_bitmap,
                drawTimeline(segments, 400 * density, 14 * density, density));

        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 2, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.stages_root, pi);
        }
        return views;
    }

    /** Stacked stage timeline as a bitmap; 1dp gaps between segments, 2dp corner radius. */
    static Bitmap drawTimeline(JSONArray segments, int width, int height, int density) {
        Bitmap bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        canvas.drawColor(0x00000000, android.graphics.PorterDuff.Mode.CLEAR);

        float gapPx = density;
        if (segments == null || segments.length() == 0) {
            Paint dim = new Paint(Paint.ANTI_ALIAS_FLAG);
            dim.setColor(0x1AFFFFFF);
            canvas.drawRoundRect(new RectF(0, 0, width, height), 2f * density, 2f * density, dim);
            return bmp;
        }

        float totalWeight = 0;
        for (int i = 0; i < segments.length(); i++) {
            try {
                totalWeight += Math.max((float) segments.getJSONObject(i).optDouble("weight", 0), 0);
            } catch (Exception ignored) {}
        }
        if (totalWeight <= 0) return bmp;

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float x = 0;
        int n = segments.length();
        for (int i = 0; i < n; i++) {
            try {
                JSONObject seg = segments.getJSONObject(i);
                float weight = Math.max((float) seg.optDouble("weight", 0), 0);
                float segWidth = (weight / totalWeight) * width;
                // Reserve gap after every segment except the last
                float drawWidth = (i == n - 1) ? (width - x) : Math.max(segWidth - gapPx, 1f);
                if (drawWidth <= 0) continue;
                paint.setColor(stageColor(seg.optString("stage", "")));
                canvas.drawRoundRect(new RectF(x, 0, x + drawWidth, height),
                        2f * density, 2f * density, paint);
                x += segWidth;
            } catch (Exception ignored) {}
        }
        return bmp;
    }

    static int stageColor(String stage) {
        switch (stage) {
            case "deep": return COLOR_DEEP;
            case "light": return COLOR_LIGHT;
            case "rem": return COLOR_REM;
            case "awake": return COLOR_AWAKE;
            case "asleep": return COLOR_ASLEEP;
            case "inBed": return COLOR_INBED;
            default: return COLOR_LIGHT;
        }
    }
}
