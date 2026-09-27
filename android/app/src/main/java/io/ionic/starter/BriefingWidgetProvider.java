package io.ionic.starter;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Hermes daily-briefing widget — MINIMALIST. Renders the last snapshot JS
 * pushed via DashboardWidgetPlugin (briefingLevel, briefingDate); tap opens
 * the app. Layout: big square VU verdict bar + ONE verdict word (GO / OK /
 * REST / SICK / DELOAD) + date. No title, no body text.
 */
public class BriefingWidgetProvider extends AppWidgetProvider {

    // VU-glyph levels pushed by daily_briefing.py. Fill bottom-up:
    // recover=1 (red), normal=2 (red+yellow), push=3 (red+yellow+green).
    // Overrides paint all three one color: sick=red, deload=yellow.
    // (Colors live in the opaque widget_vu_seg_* drawables, not here.)

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        String json = context.getSharedPreferences(
                DashboardWidgetPlugin.PREFS, Context.MODE_PRIVATE)
                .getString("snapshot", "{}");
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context, json));
        }
    }

    // One-word verdict per VU-glyph level (the widget is deliberately
    // minimalist: bar + one word + date, nothing else).
    private static String verdictWord(String level) {
        if (level == null) return "—";
        switch (level) {
            case "push":    return "GO";
            case "normal":  return "OK";
            case "recover": return "REST";
            case "sick":    return "SICK";
            case "deload":  return "DELOAD";
            default:        return "—";
        }
    }

    static RemoteViews buildViews(Context context, String json) {
        boolean os5 = WidgetTheme.isOs5(json);
        RemoteViews views = new RemoteViews(context.getPackageName(),
                os5 ? R.layout.widget_briefing_os5 : R.layout.widget_briefing);

        String verdict = "—";
        String date = "";
        String level = null;
        try {
            JSONObject data = new JSONObject(json);
            if (data.has("briefingLevel")) {
                String l = data.getString("briefingLevel");
                if (l != null && !l.isEmpty()) level = l;
            }
            if (data.has("briefingDate")) {
                String d = data.getString("briefingDate");
                if (d != null) date = d.toUpperCase();
            }
        } catch (Exception ignored) {
            // Malformed snapshot → keep the fallback strings
        }
        verdict = verdictWord(level);

        views.setTextViewText(R.id.widget_briefing_verdict, verdict);
        views.setTextViewText(R.id.widget_briefing_date, date);
        applyVuBar(views, level);

        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }
        return views;
    }

    /**
     * Paint the three VU segments by swapping the background drawable per
     * segment. Drawables are fully OPAQUE (no tint, no alpha compositing —
     * the earlier tint-over-dim-drawable approach rendered ~grey on black).
     * `setBackgroundResource` is settable on RemoteViews on every API level.
     *
     * Glyph-LED unlit state: an unlit segment shows its own color DIMMED
     * (dim red / dim yellow / dim green), never grey — the hue encodes
     * WHICH segment it is, brightness encodes off/on.
     */
    private static void applyVuBar(RemoteViews views, String level) {
        int red = R.drawable.widget_vu_seg_red_dim, yellow = R.drawable.widget_vu_seg_yellow_dim, green = R.drawable.widget_vu_seg_green_dim;
        if ("push".equals(level)) {
            red = R.drawable.widget_vu_seg_red; yellow = R.drawable.widget_vu_seg_yellow; green = R.drawable.widget_vu_seg_green;
        } else if ("normal".equals(level)) {
            red = R.drawable.widget_vu_seg_red; yellow = R.drawable.widget_vu_seg_yellow;
        } else if ("recover".equals(level)) {
            red = R.drawable.widget_vu_seg_red;
        } else if ("sick".equals(level)) {
            red = R.drawable.widget_vu_seg_red; yellow = R.drawable.widget_vu_seg_red; green = R.drawable.widget_vu_seg_red;
        } else if ("deload".equals(level)) {
            red = R.drawable.widget_vu_seg_yellow; yellow = R.drawable.widget_vu_seg_yellow; green = R.drawable.widget_vu_seg_yellow;
        }
        views.setInt(R.id.widget_vu_red, "setBackgroundResource", red);
        views.setInt(R.id.widget_vu_yellow, "setBackgroundResource", yellow);
        views.setInt(R.id.widget_vu_green, "setBackgroundResource", green);
    }
}
