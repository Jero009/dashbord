package io.ionic.starter;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Sleep Battery widget: speedometer-style ring gauge showing sleep score as a
 * "battery" percentage. The arc is pre-rendered to a bitmap at sync time
 * (RemoteViews cannot draw arcs directly) and pushed via setImageViewBitmap.
 * Data comes from the shared snapshot pushed by DashboardWidgetPlugin.
 */
public class SleepBatteryWidgetProvider extends AppWidgetProvider {

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
                os5 ? R.layout.widget_sleep_battery_os5 : R.layout.widget_sleep_battery);

        double pct = -1;
        String duration = "--";
        String bedtime = "--";
        String waketime = "--";
        try {
            JSONObject data = new JSONObject(json);
            if (data.has("sleepScore")) {
                pct = Math.max(0, Math.min(100, data.getDouble("sleepScore")));
            }
            duration = data.optString("sleepDuration", "--");
            bedtime = data.optString("bedtime", "--");
            waketime = data.optString("waketime", "--");
        } catch (Exception ignored) {
            // Malformed snapshot → keep the fallback strings
        }

        views.setTextViewText(R.id.battery_pct, pct >= 0 ? Math.round(pct) + "%" : "--");
        views.setTextViewText(R.id.battery_duration, duration);
        views.setTextViewText(R.id.battery_bedtime, bedtime);
        views.setTextViewText(R.id.battery_waketime, waketime);

        int bitmapSize = (int) (context.getResources().getDisplayMetrics().density * 120);
        views.setImageViewBitmap(R.id.battery_ring,
                drawRing(bitmapSize, pct < 0 ? 0 : (float) pct, WidgetTheme.trackColor(os5)));

        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 1, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.battery_root, pi);
        }
        return views;
    }

    /**
     * Ring gauge: 270° sweep starting at the top-left (7 o'clock position,
     * speedometer style), clockwise. Track alpha is theme-aware (lighter
     * under the OS 5 frost); progress arc gold, red when under 40.
     */
    static Bitmap drawRing(int size, float pct, int trackColor) {
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        float stroke = size * 0.075f;
        float inset = stroke / 2f + 1f;
        RectF oval = new RectF(inset, inset, size - inset, size - inset);

        Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
        track.setStyle(Paint.Style.STROKE);
        track.setStrokeWidth(stroke);
        track.setStrokeCap(Paint.Cap.ROUND);
        track.setColor(trackColor);
        canvas.drawArc(oval, 135f, 270f, false, track);

        if (pct > 0) {
            Paint arc = new Paint(Paint.ANTI_ALIAS_FLAG);
            arc.setStyle(Paint.Style.STROKE);
            arc.setStrokeWidth(stroke);
            arc.setStrokeCap(Paint.Cap.ROUND);
            arc.setColor(pct < 40 ? 0xFFD71A21 : 0xFFFFD700); // red low, gold normal
            canvas.drawArc(oval, 135f, 270f * (pct / 100f), false, arc);
        }
        return bmp;
    }
}
