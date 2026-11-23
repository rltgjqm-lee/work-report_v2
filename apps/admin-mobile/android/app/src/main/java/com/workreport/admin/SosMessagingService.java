package com.workreport.admin;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

// Capacitor 푸시 플러그인의 FCM 서비스를 대신한다(AndroidManifest에서 원래 서비스를 뺐다).
// SOS data 메시지가 오면 앱이 화면에 없을 때만 알림(풀스크린 포함)을 직접 띄우고, 앱이 떠 있으면
// 지금처럼 JS가 화면 위 배너로 보여준다. JS로 넘기는 건 원래 서비스(super)가 그대로 한다.
public class SosMessagingService extends MessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        boolean isSosData = remoteMessage.getNotification() == null
            && "sos".equals(remoteMessage.getData().get("type"));
        if (isSosData && !MainActivity.isInForeground) {
            SosAlarm.show(this, remoteMessage.getData());
        }
        super.onMessageReceived(remoteMessage);
    }
}
