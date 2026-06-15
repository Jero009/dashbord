package io.ionic.starter;

import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plays the rest-timer "ding" while ducking any other audio (e.g. the user's
 * music) so the alert is audible, then restores the original volume.
 *
 * Ducking is done the Android-blessed way: request transient audio focus with
 * AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK. The system lowers other apps' streams for
 * the duration we hold focus and brings them back the moment we abandon it — no
 * manual volume math, and it cooperates with whatever else is playing.
 */
@CapacitorPlugin(name = "RestTimerAudio")
public class RestTimerAudio extends Plugin {

    private static final int DING_DURATION_MS = 700;

    @PluginMethod
    public void duckAndDing(final PluginCall call) {
        final AudioManager audioManager =
                (AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
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

        toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP2, DING_DURATION_MS);

        // Release the tone generator and hand audio focus back so the user's
        // music returns to full volume once the ding has finished.
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            toneGenerator.release();
            audioManager.abandonAudioFocusRequest(focusRequest);
        }, DING_DURATION_MS + 150);

        call.resolve();
    }
}
