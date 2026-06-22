package io.ionic.starter;

import android.content.ComponentName;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.nothing.ketchum.Common;
import com.nothing.ketchum.Glyph;
import com.nothing.ketchum.GlyphException;
import com.nothing.ketchum.GlyphMatrixManager;

/**
 * Bridge to the Nothing Glyph Matrix (the dot-matrix LED display on the back of
 * the Nothing Phone (3) and (4a) Pro).
 *
 * This is intentionally a thin transport layer — it only connects to the matrix
 * and pushes raw per-LED brightness arrays. It does NOT decide what to draw;
 * callers build the pixel array in JS/TS and pass it down. The display is a
 * square LED grid: 13x13 (169 LEDs) on the (4a) Pro, 25x25 (625) on the (3).
 * Use getMatrixLength() to size the array for the current device.
 *
 * It uses "app matrix" mode (setAppMatrixFrame), which lets this foreground app
 * drive the matrix directly without registering a Glyph Toy. This requires a
 * Nothing phone on system version 20250801 or later; on any other device the
 * service never binds and init() rejects, so the rest of the app is unaffected.
 *
 * Method surface (all return via Capacitor promises):
 *   init()           — bind + register the device; resolves once ready
 *   draw({pixels})   — push an int[] of per-LED brightness (0–255)
 *   clear()          — stop driving the matrix (closeAppMatrix)
 *   turnOff()        — blank all LEDs
 *   getMatrixLength()— LED count for the current device
 *   isReady()        — whether the matrix is bound and registered
 *   deinit()         — release the binding
 */
@CapacitorPlugin(name = "GlyphMatrix")
public class GlyphMatrix extends Plugin {

    private static final int CONNECT_TIMEOUT_MS = 5000;

    private GlyphMatrixManager mGM;
    private boolean registered = false;

    // The in-flight init() call, resolved/rejected once the service connects or
    // the connection times out. Only one init may be in flight at a time.
    private PluginCall pendingInit;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable connectTimeout;

    @PluginMethod
    public void init(final PluginCall call) {
        if (registered) {
            // Already connected — nothing to do.
            call.resolve(readyResult(true));
            return;
        }
        if (pendingInit != null) {
            call.reject("Glyph init already in progress");
            return;
        }

        mainHandler.post(() -> {
            try {
                mGM = GlyphMatrixManager.getInstance(getContext().getApplicationContext());
            } catch (Exception t) {
                call.reject("Glyph Matrix SDK unavailable on this device", t);
                return;
            }

            pendingInit = call;
            call.setKeepAlive(true);

            // bindService() returns silently on non-Nothing devices and
            // onServiceConnected never fires, so guard with a timeout.
            connectTimeout = () -> {
                if (pendingInit != null) {
                    final PluginCall p = pendingInit;
                    pendingInit = null;
                    cleanup();
                    p.reject("Glyph Matrix service did not connect (not a supported Nothing device?)");
                }
            };
            mainHandler.postDelayed(connectTimeout, CONNECT_TIMEOUT_MS);

            mGM.init(new GlyphMatrixManager.Callback() {
                @Override
                public void onServiceConnected(ComponentName name) {
                    onConnected();
                }

                @Override
                public void onServiceDisconnected(ComponentName name) {
                    registered = false;
                }
            });
        });
    }

    private void onConnected() {
        mainHandler.removeCallbacks(connectTimeout);
        final PluginCall p = pendingInit;
        pendingInit = null;
        if (p == null) return;

        boolean ok;
        try {
            // Default to the Phone (4a) Pro; fall back to Phone (3) if detected.
            String device = Glyph.DEVICE_25111p;
            if (Common.is23112()) {
                device = Glyph.DEVICE_23112;
            }
            ok = mGM.register(device);
        } catch (Exception t) {
            cleanup();
            p.reject("Glyph register failed", t);
            return;
        }

        if (!ok) {
            cleanup();
            p.reject("Glyph register returned false (device not supported)");
            return;
        }

        registered = true;
        p.resolve(readyResult(true));
    }

    @PluginMethod
    public void draw(final PluginCall call) {
        if (!registered || mGM == null) {
            call.reject("Glyph Matrix not initialised — call init() first");
            return;
        }
        final JSArray arr = call.getArray("pixels");
        if (arr == null) {
            call.reject("pixels (number[]) is required");
            return;
        }

        final int[] pixels = new int[arr.length()];
        try {
            for (int i = 0; i < arr.length(); i++) {
                pixels[i] = arr.getInt(i);
            }
        } catch (org.json.JSONException e) {
            call.reject("pixels must be an array of integers", e);
            return;
        }

        try {
            mGM.setAppMatrixFrame(pixels);
            call.resolve();
        } catch (GlyphException e) {
            call.reject("Glyph draw failed (system version 20250801+ required for app matrix)", e);
        }
    }

    @PluginMethod
    public void clear(final PluginCall call) {
        if (mGM == null) {
            call.resolve();
            return;
        }
        try {
            mGM.closeAppMatrix();
            call.resolve();
        } catch (GlyphException e) {
            call.reject("Glyph clear failed", e);
        }
    }

    @PluginMethod
    public void turnOff(final PluginCall call) {
        if (mGM == null) {
            call.resolve();
            return;
        }
        mGM.turnOff();
        call.resolve();
    }

    @PluginMethod
    public void getMatrixLength(final PluginCall call) {
        // Length is only meaningful after the device is registered.
        int length = registered ? Common.getDeviceMatrixLength() : 0;
        final JSObject ret = new JSObject();
        ret.put("length", length);
        call.resolve(ret);
    }

    @PluginMethod
    public void isReady(final PluginCall call) {
        call.resolve(readyResult(registered));
    }

    @PluginMethod
    public void deinit(final PluginCall call) {
        cleanup();
        call.resolve();
    }

    private void cleanup() {
        registered = false;
        if (mGM != null) {
            try {
                mGM.unInit();
            } catch (Throwable ignored) {
                // best-effort release
            }
            mGM = null;
        }
    }

    private JSObject readyResult(boolean ready) {
        final JSObject ret = new JSObject();
        ret.put("ready", ready);
        return ret;
    }
}
