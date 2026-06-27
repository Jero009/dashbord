package io.ionic.starter;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Rest-timer native helpers:
 *
 * 1. duckAndDing() — plays the end-of-rest ding while ducking other audio (the
 *    user's music) via transient AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK, then
 *    restores it.
 *
 * 2. showRestNotification()/clearRestNotification() — posts an ongoing
 *    notification with a live countdown (a system chronometer, so it ticks
 *    without per-second JS) and the current exercise name. The notification
 *    keeps counting down even if the app is backgrounded or killed, and
 *    setTimeoutAfter auto-clears it when the countdown reaches zero so it
 *    doesn't linger after a kill.
 */
@CapacitorPlugin(name = "RestTimerAudio")
public class RestTimerAudio extends Plugin {

    private static final int DING_DURATION_MS = 700;
    // Gap between ducking other audio and playing the ding, so the user's music
    // audibly dips *before* the beep lands rather than at the same instant.
    private static final int PRE_DUCK_DELAY_MS = 300;
    private static final int REST_NOTIFICATION_ID = 21;
    private static final String CHANNEL_ID = "rest_timer";

    @PluginMethod
    public void duckAndDing(final PluginCall call) {
        final AudioManager audioManager =
                (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) {
            call.reject("AudioManager unavailable");
            return;
        }

        final AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        final AudioFocusRequest focusRequest = new AudioFocusRequest.Builder(
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes)
                .build();

        audioManager.requestAudioFocus(focusRequest);

        final ToneGenerator toneGenerator;
        try {
            // STREAM_NOTIFICATION keeps the ding on the notification volume,
            // which is what the user expects an alert to follow.
            toneGenerator = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100);
        } catch (RuntimeException e) {
            // ToneGenerator can throw if the audio path is busy. Release focus
            // so we don't leave other apps ducked, then report failure.
            audioManager.abandonAudioFocusRequest(focusRequest);
            call.reject("ToneGenerator init failed", e);
            return;
        }

        // Audio focus was requested above (music starts ducking now). Wait a
        // short beat before the beep so the dip is audible first, then ding.
        final Handler handler = new Handler(Looper.getMainLooper());
        handler.postDelayed(
                () -> toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP2, DING_DURATION_MS),
                PRE_DUCK_DELAY_MS);

        // Release the tone generator and hand audio focus back so the user's
        // music returns to full volume once the ding has finished.
        handler.postDelayed(() -> {
            toneGenerator.release();
            audioManager.abandonAudioFocusRequest(focusRequest);
        }, PRE_DUCK_DELAY_MS + DING_DURATION_MS + 150);

        call.resolve();
    }

    @PluginMethod
    public void showRestNotification(final PluginCall call) {
        final String exerciseName = call.getString("exerciseName", "");
        final Integer durationMs = call.getInt("durationMs");
        if (durationMs == null || durationMs <= 0) {
            call.reject("durationMs is required and must be positive");
            return;
        }

        createChannel();

        final long endAt = System.currentTimeMillis() + durationMs;
        final String body = (exerciseName == null || exerciseName.isEmpty())
                ? "Rest in progress"
                : exerciseName;

        int iconId = getContext().getResources().getIdentifier(
                "ic_stat_icon_config_sample", "drawable", getContext().getPackageName());
        if (iconId == 0) iconId = android.R.drawable.ic_lock_idle_alarm;

        final NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(iconId)
                .setContentTitle("Resting")
                .setContentText(body)
                // System-rendered countdown — no per-second JS required.
                .setWhen(endAt)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                // Self-clear when the countdown hits zero, even if the app was killed.
                .setTimeoutAfter(durationMs)
                .setPriority(NotificationCompat.PRIORITY_LOW);

        try {
            NotificationManagerCompat.from(getContext()).notify(REST_NOTIFICATION_ID, builder.build());
        } catch (SecurityException e) {
            // POST_NOTIFICATIONS not granted — fail soft; the in-app timer still works.
            call.reject("Notification permission not granted", e);
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void clearRestNotification(final PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(REST_NOTIFICATION_ID);
        call.resolve();
    }

    private void createChannel() {
        final NotificationManager manager =
                (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
        final NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Rest timer", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Live rest-timer countdown");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }
}
