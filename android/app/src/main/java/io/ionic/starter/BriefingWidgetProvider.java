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
 * Hermes daily-briefing widget. Renders the last snapshot JS pushed via
 * DashboardWidgetPlugin (fields: briefingTitle, briefingBody, briefingDate,
 * briefingLevel); tap opens the app. Static text views + a VU-meter verdict
 * bar (3 segments tinted from briefingLevel) — no nested RemoteViews, no
 * bitmap.
 */
public class BriefingWidgetProvider extends AppWidgetProvider {

    // VU-glyph levels pushed by daily_briefing.py. Fill bottom-up:
    // recover=1 (red), normal=2 (red+yellow), push=3 (red+yellow+green).
    // Overrides paint all three one color: sick=red, deload=yellow.
    private static final int COLOR_RED = 0xFFD71A21;
    private static final int COLOR_YELLOW = 0xFFFFD700;
    private static final int COLOR_GREEN = 0xFF22C55E;
    private static final int COLOR_DIM = 0xFF3A3A3A;

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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_briefing);

        String title = "No briefing yet";
        String body = "Opens with the app after the first sync";
        String date = "";
        String level = null;
        try {
            JSONObject data = new JSONObject(json);
            if (data.has("briefingTitle")) {
                String t = data.getString("briefingTitle");
                if (t != null && !t.isEmpty()) title = t;
            }
            if (data.has("briefingBody")) {
                String b = data.getString("briefingBody");
                if (b != null && !b.isEmpty()) {
                    // First line only — the widget shows two body lines max and
                    // Android ellipsizes, but a leading blank line looks broken.
                    int nl = b.indexOf('\n');
                    body = nl > 0 ? b.substring(0, nl) : b;
                }
            }
            if (data.has("briefingDate")) {
                String d = data.getString("briefingDate");
                if (d != null) date = d.toUpperCase();
            }
            if (data.has("briefingLevel")) {
                String l = data.getString("briefingLevel");
                if (l != null && !l.isEmpty()) level = l;
            }
        } catch (Exception ignored) {
            // Malformed snapshot → keep the fallback strings
        }

        views.setTextViewText(R.id.widget_briefing_title, title);
        views.setTextViewText(R.id.widget_briefing_body, body);
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
     * Paint the three VU segments. RemoteViews can't swap drawables per-view,
     * so we tint the dim segment drawable via setBackgroundTintList. The tint
     * API on RemoteViews is Android 12+ (the Nothing phones run 13+) — on
     * older devices the segments just stay dim, which is the safe fallback.
     */
    private static void applyVuBar(RemoteViews views, String level) {
        int red = COLOR_DIM, yellow = COLOR_DIM, green = COLOR_DIM;
        if ("push".equals(level)) {
            red = COLOR_RED; yellow = COLOR_YELLOW; green = COLOR_GREEN;
        } else if ("normal".equals(level)) {
            red = COLOR_RED; yellow = COLOR_YELLOW;
        } else if ("recover".equals(level)) {
            red = COLOR_RED;
        } else if ("sick".equals(level)) {
            red = COLOR_RED; yellow = COLOR_RED; green = COLOR_RED;
        } else if ("deload".equals(level)) {
            red = COLOR_YELLOW; yellow = COLOR_YELLOW; green = COLOR_YELLOW;
        }
        tint(views, R.id.widget_vu_red, red);
        tint(views, R.id.widget_vu_yellow, yellow);
        tint(views, R.id.widget_vu_green, green);
    }

    private static void tint(RemoteViews views, int viewId, int color) {
        if (android.os.Build.VERSION.SDK_INT >= 31) {
            views.setColorStateList(viewId, "setBackgroundTintList",
                    android.content.res.ColorStateList.valueOf(color));
        }
    }
}
