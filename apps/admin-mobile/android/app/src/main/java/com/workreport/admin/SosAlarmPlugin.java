package com.workreport.admin;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// 설정 화면의 "SOS 풀스크린 알림" 토글이 쓰는 로컬 플러그인. 값은 앱이 꺼져 있을 때 알림을 띄우는
// 네이티브 쪽(SosAlarm)이 읽어야 해서 웹 저장소가 아니라 SharedPreferences에 둔다.
@CapacitorPlugin(name = "SosAlarm")
public class SosAlarmPlugin extends Plugin {
    @PluginMethod
    public void getSettings(PluginCall call) {
        JSObject result = new JSObject();
        result.put("fullScreenEnabled", SosAlarm.isFullScreenEnabled(getContext()));
        result.put("fullScreenPermitted", SosAlarm.canUseFullScreen(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void setFullScreenEnabled(PluginCall call) {
        SosAlarm.setFullScreenEnabled(getContext(), Boolean.TRUE.equals(call.getBoolean("enabled", false)));
        call.resolve();
    }

    // Android 14+ "풀스크린 알림 허용" 화면. 그 아래 버전은 따로 허용할 게 없어 앱 알림 설정을 연다.
    @PluginMethod
    public void openFullScreenSettings(PluginCall call) {
        Uri packageUri = Uri.parse("package:" + getContext().getPackageName());
        Intent intent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            ? new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, packageUri)
            : new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
