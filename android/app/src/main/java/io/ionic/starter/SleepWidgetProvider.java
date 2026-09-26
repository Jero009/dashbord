package io.ionic.starter;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Sleep score widget. Renders the last snapshot JS pushed via
 * DashboardWidgetPlugin; tap opens the app.
 */
public class SleepWidgetProvider extends AppWidgetProvider {

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
                os5 ? R.layout.widget_sleep_os5 : R.layout.widget_sleep);

        String score = "--";
        String meta = "NO DATA";
        String delta = "";
        try {
            JSONObject data = new JSONObject(json);
            if (data.has("sleepScore")) {
                score = String.valueOf(Math.round(data.getDouble("sleepScore")));
                String date = data.optString("date", "");
                meta = date.isEmpty() ? "" : date.toUpperCase();
                double dur = data.optDouble("sleepHours", Double.NaN);
                if (!Double.isNaN(dur)) {
                    meta = meta + " · " + formatHours(dur);
                }
                double deltaVal = data.optDouble("delta7d", Double.NaN);
                if (!Double.isNaN(deltaVal)) {
                    delta = (deltaVal >= 0 ? "▲" : "▼") + Math.abs(Math.round(deltaVal));
                }
            }
        } catch (Exception ignored) {
            // Malformed snapshot → keep the fallback strings
        }

        views.setTextViewText(R.id.widget_score, score);
        views.setTextViewText(R.id.widget_meta, meta);
        views.setTextViewText(R.id.widget_delta, delta);

        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }
        return views;
    }

    private static String formatHours(double h) {
        int total = (int) Math.round(h * 60);
        return (total / 60) + "H " + (total % 60) + "M";
    }
}
