package io.ionic.starter;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Sleep Stages widget: summary row (total / deep / REM) plus a horizontal
 * stacked timeline of the night's stages, colored with the app-wide fixed
 * stage palette. Data comes from the shared snapshot pushed by
 * DashboardWidgetPlugin (stageSegments JSON array).
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
        JSONArray segments = null;
        try {
            JSONObject data = new JSONObject(json);
            total = data.optString("sleepDuration", "--");
            deep = data.optString("deepDuration", "--");
            rem = data.optString("remDuration", "--");
            segments = data.optJSONArray("stageSegments");
        } catch (Exception ignored) {
            // Malformed snapshot → keep the fallback strings
        }

        views.setTextViewText(R.id.stages_total, total);
        views.setTextViewText(R.id.stages_deep, deep);
        views.setTextViewText(R.id.stages_rem, rem);
        views.setTextViewText(R.id.stages_bedtime, "--");
        views.setTextViewText(R.id.stages_waketime, "--");

        // Timeline: a horizontal LinearLayout of weighted colored views.
        // Rebuild it by removing children via a fresh layout index — RemoteViews
        // supports removeAllViews + addView with an outermost-layout stub.
        RemoteViews timeline = new RemoteViews(context.getPackageName(), R.layout.widget_stages_timeline);
        if (segments != null && segments.length() > 0) {
            try {
                JSONObject first = segments.getJSONObject(0);
                JSONObject last = segments.getJSONObject(segments.length() - 1);
                views.setTextViewText(R.id.stages_bedtime, compactTime(first.optString("start", "")));
                views.setTextViewText(R.id.stages_waketime, compactTime(last.optString("end", "")));
                for (int i = 0; i < segments.length() && i < 60; i++) {
                    JSONObject seg = segments.getJSONObject(i);
                    float weight = (float) Math.max(seg.optDouble("weight", 0), 0.001);
                    RemoteViews cell = new RemoteViews(context.getPackageName(), R.layout.widget_stage_cell);
                    // cell background color via setColorFilter isn't available; use setInt backgroundResource-free:
                    // RemoteViews can setInt(viewId, "setBackgroundColor", color) on any View.
                    cell.setInt(R.id.stage_cell, "setBackgroundColor", stageColor(seg.optString("stage", "")));
                    // weight must be set in the layout params — RemoteViews can't change LayoutParams,
                    // so width is expressed via the cell's layout_weight in a horizontal container:
                    // we encode weight through the cell layout's fixed attribute; per-cell variation uses
                    // setFloat on the parent's weightSum pattern is not supported either. Workaround:
                    // use setViewLayoutWidth when available (API 31+), else equal cells.
                    try {
                        cell.setViewLayoutWidth(R.id.stage_cell, weight, android.view.Gravity.START);
                    } catch (NoSuchMethodError legacy) {
                        // API < 31: equal-width cells (acceptable degradation)
                    }
                    timeline.addView(R.id.stages_bar, cell);
                }
            } catch (Exception ignored) {
                // Bad segment data → leave the empty bar
            }
        }
        views.removeAllViews(R.id.stages_bar_host);
        views.addView(R.id.stages_bar_host, timeline);

        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 2, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.stages_root, pi);
        }
        return views;
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

    /** "2026-09-16T23:14:00" → "23:14" */
    static String compactTime(String iso) {
        if (iso == null || iso.length() < 16 || !iso.contains("T")) return "--";
        return iso.substring(11, 16);
    }
}
