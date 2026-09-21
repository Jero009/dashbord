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
 * DashboardWidgetPlugin (fields: briefingTitle, briefingBody, briefingDate);
 * tap opens the app. Static text views only — no nested RemoteViews, no bitmap.
 */
public class BriefingWidgetProvider extends AppWidgetProvider {

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
        } catch (Exception ignored) {
            // Malformed snapshot → keep the fallback strings
        }

        views.setTextViewText(R.id.widget_briefing_title, title);
        views.setTextViewText(R.id.widget_briefing_body, body);
        views.setTextViewText(R.id.widget_briefing_date, date);

        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }
        return views;
    }
}
