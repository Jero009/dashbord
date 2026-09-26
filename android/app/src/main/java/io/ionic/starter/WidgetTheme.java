package io.ionic.starter;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

/**
 * Widget theme support: the JS side rides a `themeStyle` field in the shared
 * snapshot ("classic" | "os5"); providers ask this helper which skin to
 * render. Classic stays the default for every missing/unknown value so an
 * old snapshot can never half-theme a widget.
 */
final class WidgetTheme {

    static final String STYLE_OS5 = "os5";

    private WidgetTheme() {}

    static boolean isOs5(String snapshotJson) {
        try {
            JSONObject data = new JSONObject(snapshotJson);
            return STYLE_OS5.equals(data.optString("themeStyle", ""));
        } catch (Exception e) {
            return false;
        }
    }

    /** Track color for gauges/timelines: lighter in OS 5 (frost needs more contrast under blur). */
    static int trackColor(boolean os5) {
        return os5 ? 0x38FFFFFF : 0x26FFFFFF;
    }
}
