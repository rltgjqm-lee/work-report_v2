package com.workreport.admin;

import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import java.util.HashMap;
import java.util.Map;

// SOS 알람이 울리는 동안만 도는 포그라운드 서비스 — 앱이 백그라운드여도 끄기를 누를 때까지 소리·진동이
// 멈추지 않게 프로세스를 붙잡아 둔다. SOS 알림(풀스크린 포함)을 이 서비스의 알림으로 띄운다.
public class SosAlarmService extends Service {
    static final String EXTRA_DATA = "sosData";

    @Override
    @SuppressWarnings("unchecked")
    public int onStartCommand(Intent intent, int flags, int startId) {
        Map<String, String> data = intent == null ? null : (HashMap<String, String>) intent.getSerializableExtra(EXTRA_DATA);
        if (data == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        SosAlarm.isServiceRunning = true;
        int notificationId = SosAlarm.notificationIdOf(data);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                notificationId,
                SosAlarm.buildAlarmNotification(this, data, notificationId),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            );
        } else {
            startForeground(notificationId, SosAlarm.buildAlarmNotification(this, data, notificationId));
        }
        SosAlarm.startPlayback(this);
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        SosAlarm.stopPlayback();
        // 서비스에 묶인 알림을 지운 뒤, 아직 확인 안 한 SOS는 조용한 알림으로 다시 올린다
        // (확인한 SOS는 SosAlarm.cancel이 목록에서 빼 두어 다시 올라가지 않는다)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        SosAlarm.isServiceRunning = false;
        SosAlarm.repostQuietly(this);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
