package com.workreport.admin;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// SOS 알림의 "소리 끄기" 버튼 — 앱을 열지 않고 울리는 소리만 멈춘다
public class SosAlarmSilenceReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        SosAlarm.silenceAll(context);
    }
}
