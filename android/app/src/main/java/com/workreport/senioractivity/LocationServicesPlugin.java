package com.workreport.senioractivity;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.IntentSender;
import android.location.LocationManager;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.LocationSettingsResponse;
import com.google.android.gms.location.SettingsClient;
import com.google.android.gms.tasks.Task;

// 💡 기기 위치 서비스(OS 전역 GPS 토글) 켜짐 여부를, 실제 위치를 기다리지 않고 즉시
// 확인/제어하기 위한 전용 플러그인. @capacitor-community/background-geolocation의
// addWatcher는 "감시 시작"이라 위치가 켜져있을 땐 실제 위치 업데이트가 올 때까지
// 기다려서 "빠른 확인" 용도로 못 쓴다 — 그래서 별도로 둔다.
// 💡 requestCodes를 반드시 선언해야 한다 — Capacitor의 Bridge.onActivityResult는
// 이 어노테이션에 등록된 requestCode만 보고 어느 플러그인의 handleOnActivityResult를
// 부를지 정한다(getPluginWithRequestCode). startResolutionForResult를 Activity에
// 직접 호출하는 것만으로는 Bridge가 이 요청을 우리 플러그인 것으로 인식 못 해서,
// 실제로는 위치가 켜져도(OS가 바로 처리하니까) 그 결과가 JS로 영영 안 돌아오고
// PluginCall이 멈춰버린다.
@CapacitorPlugin(name = "LocationServices", requestCodes = { LocationServicesPlugin.REQUEST_CHECK_SETTINGS })
public class LocationServicesPlugin extends Plugin {
    static final int REQUEST_CHECK_SETTINGS = 9327;
    private String pendingCallbackId = null;

    private static boolean isLocationEnabled(Context context) {
        LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return lm != null && lm.isLocationEnabled();
        }
        int locationMode = Settings.Secure.getInt(
                context.getContentResolver(),
                Settings.Secure.LOCATION_MODE,
                Settings.Secure.LOCATION_MODE_OFF
        );
        return locationMode != Settings.Secure.LOCATION_MODE_OFF;
    }

    // 부작용 없이 즉시(동기) 결과를 준다 — 출근 버튼을 눌렀을 때 실제 위치를 읽기 전에
    // 먼저 이걸로 켜져있는지부터 확인해서, 꺼져있으면 5초 타임아웃을 기다리지 않고
    // 바로 안내할 수 있다.
    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", isLocationEnabled(getContext()));
        call.resolve(result);
    }

    // 설정 화면으로 보내지 않고, 앱 안에서 "위치를 켤까요?" 시스템 다이얼로그를 띄워
    // 한 번의 터치로 위치를 켤 수 있게 한다. 안드로이드 전용이다 — iOS는 애플 정책상
    // 앱이 위치를 대신 켤 수 없어 항상 설정 화면으로 보내야 한다(그건 기존
    // capacitor-native-settings 경로를 그대로 쓴다).
    @PluginMethod
    public void requestEnable(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available.");
            return;
        }

        LocationRequest locationRequest = LocationRequest.create()
                .setPriority(LocationRequest.PRIORITY_BALANCED_POWER_ACCURACY);
        LocationSettingsRequest settingsRequest = new LocationSettingsRequest.Builder()
                .addLocationRequest(locationRequest)
                .build();

        SettingsClient client = LocationServices.getSettingsClient(activity);
        Task<LocationSettingsResponse> task = client.checkLocationSettings(settingsRequest);

        task.addOnSuccessListener(activity, response -> {
            // 이미 켜져있다.
            JSObject result = new JSObject();
            result.put("enabled", true);
            call.resolve(result);
        });

        task.addOnFailureListener(activity, exception -> {
            if (exception instanceof ResolvableApiException) {
                try {
                    pendingCallbackId = call.getCallbackId();
                    bridge.saveCall(call);
                    ((ResolvableApiException) exception).startResolutionForResult(activity, REQUEST_CHECK_SETTINGS);
                } catch (IntentSender.SendIntentException sendException) {
                    JSObject result = new JSObject();
                    result.put("enabled", isLocationEnabled(getContext()));
                    call.resolve(result);
                }
            } else {
                // 이 기기엔 켤 수 있는 위치 제공자가 아예 없는 등 — 켤 방법이 없다.
                JSObject result = new JSObject();
                result.put("enabled", false);
                call.resolve(result);
            }
        });
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_CHECK_SETTINGS || pendingCallbackId == null) return;

        PluginCall call = bridge.getSavedCall(pendingCallbackId);
        bridge.releaseCall(pendingCallbackId);
        pendingCallbackId = null;
        if (call == null) return;

        // 사용자가 다이얼로그에서 뭘 눌렀든(켬/취소) 실제 설정값을 다시 읽어서 정확히 알려준다.
        JSObject result = new JSObject();
        result.put("enabled", isLocationEnabled(getContext()));
        call.resolve(result);
    }
}
