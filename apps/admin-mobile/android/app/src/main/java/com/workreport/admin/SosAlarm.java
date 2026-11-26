package com.workreport.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

import java.util.HashMap;
import java.util.Map;

// SOS 알람. FCM이 알아서 띄우는 알림(notification 메시지)으로는 풀스크린을 쓸 수 없어서, Worker가
// 관리자 앱에는 data만 보내고 여기서 알림을 만든다.
// - 화면: 항상 풀스크린 — 화면이 꺼져 있거나 잠겨 있으면 앱이 바로 SOS 화면으로 뜬다
//   (폰을 쓰고 있을 때는 Android가 화면 위쪽 알림으로 대신 보여준다).
// - 소리·진동: 알림 채널에 맡기면 무음 모드에서 Android가 막아서, 알람 시계처럼 앱이 "알람"으로 직접
//   낸다(무음이어도 울린다). 관리자가 고른 방식(소리 / 진동)으로 끄기를 누를 때까지 반복한다.
public final class SosAlarm {
    // 소리·진동은 앱이 직접 내므로 채널은 조용한 것 하나만 둔다(중요도는 풀스크린을 위해 높게)
    static final String CHANNEL_ID = "sos_alarm";
    // 예전 빌드가 만든 채널 — 이제 안 쓰니 지운다
    private static final String[] LEGACY_CHANNEL_IDS = { "sos", "sos_silent", "sos_sound", "sos_vibrate" };

    static final String MODE_SOUND = "sound";
    static final String MODE_VIBRATE = "vibrate";

    // 풀스크린으로 열렸다는 표시 — MainActivity가 보고 잠금 화면 위로 뜬다
    static final String EXTRA_FULL_SCREEN = "sosFullScreen";
    static final String EXTRA_NOTIFICATION_ID = "sosNotificationId";

    private static final String PREFS = "sos_alarm";
    private static final String KEY_ALERT_MODE = "alertMode";
    private static final long[] VIBRATION_PATTERN = { 0, 800, 600 };

    // 울리는 중인지가 바뀌면 화면(SosAlarmPlugin → JS 막대)에 알린다
    static volatile Runnable ringingListener = null;
    // 서비스가 떠 있는 동안 그 SOS 알림은 서비스에 묶여 있어 지우거나 고쳐도 Android가 무시한다 —
    // 그때는 서비스가 내려가면서(SosAlarmService.onDestroy) 알림을 정리한다
    static volatile boolean isServiceRunning = false;

    private static MediaPlayer player = null;
    private static Vibrator vibrator = null;
    // 지금 울리고 있는 SOS 알림들 — 끄면 "끄기" 버튼 없는 조용한 알림으로 바꿔 남겨둔다
    private static final Map<Integer, Map<String, String>> ringingNotifications = new HashMap<>();

    private SosAlarm() {}

    // 기본값은 소리 — 진동으로 바꾸고 싶은 관리자만 설정에서 바꾼다
    static String getAlertMode(Context context) {
        return MODE_VIBRATE.equals(prefs(context).getString(KEY_ALERT_MODE, MODE_SOUND)) ? MODE_VIBRATE : MODE_SOUND;
    }

    static void setAlertMode(Context context, String mode) {
        prefs(context).edit().putString(KEY_ALERT_MODE, MODE_VIBRATE.equals(mode) ? MODE_VIBRATE : MODE_SOUND).apply();
    }

    // Android 14부터는 전화·알람 앱이 아니면 사용자가 설정에서 풀스크린 알림을 허용해야 한다
    static boolean canUseFullScreen(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true;
        return context.getSystemService(NotificationManager.class).canUseFullScreenIntent();
    }

    // SOS data 메시지를 받았다(SosMessagingService). 앱을 보고 있으면 알림 없이 소리·진동만 내고 JS가
    // 화면 전체로 SOS를 띄운다. 아니면 울리는 동안 꺼지지 않게 서비스(SosAlarmService)로 띄운다.
    static void onSosReceived(Context context, Map<String, String> data) {
        if (MainActivity.isInForeground) {
            startPlayback(context);
            return;
        }
        Intent intent = new Intent(context, SosAlarmService.class)
            .putExtra(SosAlarmService.EXTRA_DATA, new HashMap<>(data));
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
            else context.startService(intent);
        } catch (RuntimeException error) {
            // 백그라운드 서비스 시작이 막힌 경우 — 알림을 그냥 띄우고 소리·진동은 프로세스가 살아 있는 동안 낸다
            int notificationId = notificationIdOf(data);
            context.getSystemService(NotificationManager.class)
                .notify(notificationId, buildAlarmNotification(context, data, notificationId));
            startPlayback(context);
        }
    }

    static int notificationIdOf(Map<String, String> data) {
        try {
            String sosEventId = data.get("sosEventId");
            return sosEventId == null ? 0 : Integer.parseInt(sosEventId);
        } catch (NumberFormatException error) {
            return 0;
        }
    }

    static synchronized Notification buildAlarmNotification(Context context, Map<String, String> data, int notificationId) {
        ensureChannels(context);
        ringingNotifications.put(notificationId, data);
        return baseBuilder(context, data, notificationId)
            .setFullScreenIntent(openSosIntent(context, data, notificationId, true), true)
            .addAction(0, "알람 끄기", silenceIntent(context))
            .setOngoing(true)
            .build();
    }

    // 알람 소리·진동을 시작한다. 이미 울리고 있으면 그대로 둔다(SOS가 여러 건 와도 한 번만 울린다).
    static synchronized void startPlayback(Context context) {
        if (player != null || vibrator != null) return;
        if (MODE_VIBRATE.equals(getAlertMode(context))) {
            vibrator = context.getSystemService(Vibrator.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                vibrator.vibrate(
                    VibrationEffect.createWaveform(VIBRATION_PATTERN, 0),
                    VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM)
                );
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(VIBRATION_PATTERN, 0), alarmAudioAttributes());
            } else {
                vibrator.vibrate(VIBRATION_PATTERN, 0, alarmAudioAttributes());
            }
        } else {
            try {
                MediaPlayer mediaPlayer = new MediaPlayer();
                mediaPlayer.setAudioAttributes(alarmAudioAttributes());
                mediaPlayer.setDataSource(context, alarmSoundUri());
                mediaPlayer.setLooping(true);
                mediaPlayer.prepare();
                mediaPlayer.start();
                player = mediaPlayer;
            } catch (Exception error) {
                player = null;
            }
        }
        notifyRingingChanged();
    }

    static synchronized boolean isRinging() {
        return player != null || vibrator != null;
    }

    // 소리·진동을 멈추고 서비스를 내린다. 알림은 지우지 않고 조용한 알림으로 바꿔 남겨둔다
    // (나중에 눌러서 SOS 화면을 열 수 있게).
    static void silenceAll(Context context) {
        stopPlayback();
        if (isServiceRunning) context.stopService(new Intent(context, SosAlarmService.class));
        else repostQuietly(context);
        notifyRingingChanged();
    }

    // 울리던 SOS 알림을 "끄기" 버튼 없는 조용한 알림으로 바꿔 올린다(소리·진동·위쪽 알림 없이)
    static synchronized void repostQuietly(Context context) {
        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        for (Map.Entry<Integer, Map<String, String>> entry : ringingNotifications.entrySet()) {
            notificationManager.notify(
                entry.getKey(),
                baseBuilder(context, entry.getValue(), entry.getKey()).setSilent(true).build()
            );
        }
        ringingNotifications.clear();
    }

    // 관리자가 그 SOS를 확인했다(알림을 직접 누름 / SOS 화면의 "SOS 확인하기" / 처리 완료) —
    // 알람을 멈추고 그 SOS 알림을 지운다. 다른 SOS 알림은 조용한 알림으로 남긴다.
    static void cancel(Context context, int notificationId) {
        synchronized (SosAlarm.class) {
            ringingNotifications.remove(notificationId);
        }
        // 서비스에 묶인 알림이면 여기서 지워도 무시되고, 서비스가 내려가면서 지운다
        context.getSystemService(NotificationManager.class).cancel(notificationId);
        silenceAll(context);
    }

    static synchronized void stopPlayback() {
        if (player != null) {
            player.stop();
            player.release();
        }
        if (vibrator != null) vibrator.cancel();
        player = null;
        vibrator = null;
    }

    // 설정 화면에서 바로 보이도록 플러그인이 뜰 때도 부른다(SosAlarmPlugin.load)
    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        for (String legacyChannelId : LEGACY_CHANNEL_IDS) {
            notificationManager.deleteNotificationChannel(legacyChannelId);
        }
        if (notificationManager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "SOS 알람",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("참여자가 SOS를 누르면 화면 전체로 알려드려요. 소리·진동은 앱 설정에서 골라요");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.enableLights(true);
        notificationManager.createNotificationChannel(channel);
    }

    private static NotificationCompat.Builder baseBuilder(Context context, Map<String, String> data, int notificationId) {
        String title = data.containsKey("title") ? data.get("title") : "SOS 요청";
        String body = data.containsKey("body") ? data.get("body") : "참여자가 SOS를 눌렀어요";
        return new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_sos)
            .setColor(0xFFDC2626)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // Android 8 미만은 채널이 없어서 알림마다 소리·진동을 끈다(앱이 직접 낸다)
            .setDefaults(0)
            .setSound(null)
            .setVibrate(null)
            .setAutoCancel(true)
            .setContentIntent(openSosIntent(context, data, notificationId, false));
    }

    private static AudioAttributes alarmAudioAttributes() {
        return new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
    }

    // 폰의 기본 알람음 — 없는 폰이면 벨소리, 그것도 없으면 알림음
    private static Uri alarmSoundUri() {
        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        return uri;
    }

    private static void notifyRingingChanged() {
        Runnable listener = ringingListener;
        if (listener != null) listener.run();
    }

    // 알림을 누르면 Capacitor 푸시 플러그인이 "google.message_id"가 든 Intent를 보고
    // pushNotificationActionPerformed로 data를 JS에 넘긴다 — JS는 그걸 보고 SOS 화면을 연다
    private static PendingIntent openSosIntent(
        Context context,
        Map<String, String> data,
        int notificationId,
        boolean isFullScreen
    ) {
        Intent intent = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("google.message_id", "sos-" + notificationId)
            .putExtra(EXTRA_NOTIFICATION_ID, notificationId)
            .putExtra(EXTRA_FULL_SCREEN, isFullScreen);
        for (Map.Entry<String, String> entry : data.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }
        // 같은 SOS의 눌렀을 때/풀스크린 Intent가 서로 덮어쓰지 않게 requestCode를 나눈다
        int requestCode = notificationId * 2 + (isFullScreen ? 1 : 0);
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static PendingIntent silenceIntent(Context context) {
        return PendingIntent.getBroadcast(
            context,
            0,
            new Intent(context, SosAlarmSilenceReceiver.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
