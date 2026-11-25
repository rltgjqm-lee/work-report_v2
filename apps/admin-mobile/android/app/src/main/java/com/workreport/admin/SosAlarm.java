package com.workreport.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.service.notification.StatusBarNotification;

import androidx.core.app.NotificationCompat;

import java.util.Map;

// SOS 알림을 앱이 직접 띄운다. FCM이 알아서 띄우는 알림(notification 메시지)으로는 풀스크린을
// 쓸 수 없어서, Worker가 관리자 앱에는 data만 보내고 여기서 알림을 만든다.
// SOS는 항상 풀스크린으로 띄운다 — 화면이 꺼져 있거나 잠겨 있으면 앱이 바로 SOS 화면으로 뜨고
// (폰을 쓰고 있을 때는 Android가 화면 위쪽 알림으로 대신 보여준다).
// 관리자가 고른 방식(소리 / 진동)으로 "끄기"(알림 버튼 / 앱 위쪽 막대)를 누르거나 알림을 누를 때까지 반복한다.
public final class SosAlarm {
    // 알림 채널의 소리·진동은 만든 뒤에 앱이 바꿀 수 없어서 방식마다 채널을 따로 둔다
    static final String SOUND_CHANNEL_ID = "sos_sound";
    static final String VIBRATE_CHANNEL_ID = "sos_vibrate";
    // 예전 빌드가 만든 채널 — 이제 안 쓰니 지운다
    private static final String[] LEGACY_CHANNEL_IDS = { "sos", "sos_silent" };

    static final String MODE_SOUND = "sound";
    static final String MODE_VIBRATE = "vibrate";
    // 풀스크린으로 열렸다는 표시 — MainActivity가 보고 잠금 화면 위로 뜬다
    static final String EXTRA_FULL_SCREEN = "sosFullScreen";
    static final String EXTRA_NOTIFICATION_ID = "sosNotificationId";

    private static final String PREFS = "sos_alarm";
    private static final String KEY_ALERT_MODE = "alertMode";

    // 계속 울리는 중인지가 바뀌면 화면(SosAlarmPlugin → JS 막대)에 알린다
    static volatile Runnable ringingListener = null;

    // 앱을 보고 있을 때 SOS가 오면 알림 대신 앱이 직접 내는 소리·진동(JS가 화면 전체로 SOS를 띄운다)
    private static final long[] VIBRATION_PATTERN = { 0, 800, 600 };
    private static Ringtone inAppRingtone = null;
    private static Vibrator inAppVibrator = null;

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

    static void show(Context context, Map<String, String> data) {
        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        ensureChannels(context);

        String sosEventId = data.get("sosEventId");
        int notificationId = parseIdOrZero(sosEventId);
        String title = data.containsKey("title") ? data.get("title") : "SOS 요청";
        String body = data.containsKey("body") ? data.get("body") : "참여자가 SOS를 눌렀어요";

        boolean isVibrate = MODE_VIBRATE.equals(getAlertMode(context));

        NotificationCompat.Builder builder = new NotificationCompat.Builder(
            context,
            isVibrate ? VIBRATE_CHANNEL_ID : SOUND_CHANNEL_ID
        )
            .setSmallIcon(R.drawable.ic_stat_sos)
            .setColor(0xFFDC2626)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // Android 8 미만은 채널이 없어서 알림마다 소리·진동을 정한다
            .setDefaults((isVibrate ? Notification.DEFAULT_VIBRATE : Notification.DEFAULT_SOUND) | Notification.DEFAULT_LIGHTS)
            .setAutoCancel(true)
            .setContentIntent(openSosIntent(context, data, notificationId, false))
            // Android 14+에서 풀스크린 허용 전이면 Android가 알아서 위쪽 알림으로 대신 보여준다
            .setFullScreenIntent(openSosIntent(context, data, notificationId, true), true)
            .addAction(0, isVibrate ? "진동 끄기" : "소리 끄기", silenceIntent(context));

        Notification notification = builder.build();
        notification.flags |= Notification.FLAG_INSISTENT;
        notificationManager.notify(notificationId, notification);
        notifyRingingChanged();
    }

    static void cancel(Context context, int notificationId) {
        context.getSystemService(NotificationManager.class).cancel(notificationId);
        notifyRingingChanged();
    }

    // 알림처럼 끄기를 누를 때까지 반복한다. 폰이 무음·방해금지면 알림과 똑같이 소리가 나지 않는다.
    static synchronized void startInApp(Context context) {
        stopInApp();
        if (MODE_VIBRATE.equals(getAlertMode(context))) {
            inAppVibrator = context.getSystemService(Vibrator.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                inAppVibrator.vibrate(VibrationEffect.createWaveform(VIBRATION_PATTERN, 0));
            } else {
                inAppVibrator.vibrate(VIBRATION_PATTERN, 0);
            }
        } else {
            inAppRingtone = RingtoneManager.getRingtone(
                context,
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            );
            if (inAppRingtone != null) {
                inAppRingtone.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
                // Android 9 미만은 반복이 안 돼서 한 번만 울린다
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) inAppRingtone.setLooping(true);
                inAppRingtone.play();
            }
        }
        notifyRingingChanged();
    }

    private static synchronized boolean isInAppRinging() {
        return inAppVibrator != null || (inAppRingtone != null && inAppRingtone.isPlaying());
    }

    private static synchronized void stopInApp() {
        if (inAppRingtone != null) inAppRingtone.stop();
        if (inAppVibrator != null) inAppVibrator.cancel();
        inAppRingtone = null;
        inAppVibrator = null;
    }

    static boolean isRinging(Context context) {
        if (isInAppRinging()) return true;
        for (StatusBarNotification active : context.getSystemService(NotificationManager.class).getActiveNotifications()) {
            if ((active.getNotification().flags & Notification.FLAG_INSISTENT) != 0) return true;
        }
        return false;
    }

    // 울리는 알림의 소리·진동만 멈추고 알림은 남겨둔다(나중에 눌러서 SOS 화면을 열 수 있게).
    // 알림을 그대로 고쳐 올리면 이미 울리는 소리가 안 멈추는 기기가 있어서, 지웠다가 조용히 다시 올린다.
    static void silenceAll(Context context) {
        stopInApp();
        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        for (StatusBarNotification active : notificationManager.getActiveNotifications()) {
            Notification ringing = active.getNotification();
            if ((ringing.flags & Notification.FLAG_INSISTENT) == 0) continue;
            notificationManager.cancel(active.getId());
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) continue;
            Notification quiet = Notification.Builder.recoverBuilder(context, ringing)
                .setActions()
                .setFullScreenIntent(null, false)
                // 혼자 든 그룹의 하위 알림으로 올려서 소리·진동 없이 조용히 올라가게 한다
                .setGroup("sos-silenced-" + active.getId())
                .setGroupAlertBehavior(Notification.GROUP_ALERT_SUMMARY)
                .build();
            quiet.flags &= ~Notification.FLAG_INSISTENT;
            notificationManager.notify(active.getId(), quiet);
        }
        notifyRingingChanged();
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

    // 설정 화면에서 바로 보이도록 플러그인이 뜰 때도 부른다(SosAlarmPlugin.load)
    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        for (String legacyChannelId : LEGACY_CHANNEL_IDS) {
            notificationManager.deleteNotificationChannel(legacyChannelId);
        }
        if (notificationManager.getNotificationChannel(SOUND_CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                SOUND_CHANNEL_ID,
                "SOS 알림 (소리)",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("참여자가 SOS를 누르면 소리로 알려드려요");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.enableVibration(false);
            channel.enableLights(true);
            notificationManager.createNotificationChannel(channel);
        }
        if (notificationManager.getNotificationChannel(VIBRATE_CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                VIBRATE_CHANNEL_ID,
                "SOS 알림 (진동)",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("참여자가 SOS를 누르면 진동으로 알려드려요");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setSound(null, null);
            channel.enableVibration(true);
            channel.enableLights(true);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private static int parseIdOrZero(String value) {
        try {
            return value == null ? 0 : Integer.parseInt(value);
        } catch (NumberFormatException error) {
            return 0;
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
