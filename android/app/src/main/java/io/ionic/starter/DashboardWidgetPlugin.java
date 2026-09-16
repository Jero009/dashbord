package io.ionic.starter;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Receives widget state snapshots from JS and persists them so the
 * AppWidgetProviders can render without the web app running.
 * Transport only — all data shaping happens in TypeScript.
 */
@CapacitorPlugin(name = "DashboardWidget")
public class DashboardWidgetPlugin extends Plugin {

    static final String PREFS = "WidgetData";
    private static final Class<?>[] WIDGET_PROVIDERS = {
            SleepWidgetProvider.class,
            SleepBatteryWidgetProvider.class,
            SleepStagesWidgetProvider.class,
    };

    @PluginMethod
    public void sync(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("data is required");
            return;
        }

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString("snapshot", data).apply();

        for (Class<?> provider : WIDGET_PROVIDERS) {
            int[] ids = AppWidgetManager.getInstance(context)
                    .getAppWidgetIds(new ComponentName(context, provider));
            if (ids.length > 0) {
                @SuppressWarnings("unchecked")
                Intent intent = new Intent(context, (Class<? extends android.content.BroadcastReceiver>) provider);
                intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                context.sendBroadcast(intent);
            }
        }

        call.resolve();
    }
}
