package com.workreport.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import java.util.Map;

// SOS 알림을 앱이 직접 띄운다. FCM이 알아서 띄우는 알림(notification 메시지)으로는 풀스크린을
// 쓸 수 없어서, Worker가 관리자 앱에는 data만 보내고 여기서 알림을 만든다.
// 풀스크린을 켜 두면 화면이 꺼져 있거나 잠겨 있을 때 앱이 바로 SOS 화면으로 뜬다
// (폰을 쓰고 있을 때는 Android가 화면 위쪽 알림으로 대신 보여준다).
public final class SosAlarm {
    // JS(pushNotifications.ts)가 만드는 채널과 같은 id — 채널이 아직 없으면 여기서 같은 설정으로 만든다
    static final String CHANNEL_ID = "sos";
    // 풀스크린으로 열렸다는 표시 — MainActivity가 보고 잠금 화면 위로 뜬다
    static final String EXTRA_FULL_SCREEN = "sosFullScreen";
    static final String EXTRA_NOTIFICATION_ID = "sosNotificationId";

    private static final String PREFS = "sos_alarm";
    private static final String KEY_FULL_SCREEN = "fullScreen";

    private SosAlarm() {}

    // 기본값은 켬 — SOS는 놓치면 안 되니 끄고 싶은 관리자만 설정에서 끈다
    static boolean isFullScreenEnabled(Context context) {
        return prefs(context).getBoolean(KEY_FULL_SCREEN, true);
    }

    static void setFullScreenEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_FULL_SCREEN, enabled).apply();
    }

    // Android 14부터는 전화·알람 앱이 아니면 사용자가 설정에서 풀스크린 알림을 허용해야 한다
    static boolean canUseFullScreen(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true;
        return context.getSystemService(NotificationManager.class).canUseFullScreenIntent();
    }

    static void show(Context context, Map<String, String> data) {
        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        ensureChannel(notificationManager);

        String sosEventId = data.get("sosEventId");
        int notificationId = parseIdOrZero(sosEventId);
        String title = data.containsKey("title") ? data.get("title") : "SOS 요청";
        String body = data.containsKey("body") ? data.get("body") : "참여자가 SOS를 눌렀어요";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_sos)
            .setColor(0xFFDC2626)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(Notification.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(openSosIntent(context, data, notificationId, false));

        if (isFullScreenEnabled(context) && canUseFullScreen(context)) {
            builder.setFullScreenIntent(openSosIntent(context, data, notificationId, true), true);
        }

        notificationManager.notify(notificationId, builder.build());
    }

    static void cancel(Context context, int notificationId) {
        context.getSystemService(NotificationManager.class).cancel(notificationId);
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

    private static void ensureChannel(NotificationManager notificationManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (notificationManager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "SOS 알림",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("참여자가 SOS를 누르면 바로 알려드려요");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        channel.enableLights(true);
        notificationManager.createNotificationChannel(channel);
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
