package com.workreport.senioractivity;

import android.Manifest;
import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

// 💡 근무 중 위치 보고 네이티브 서비스(WorkLocationService)를 JS에서 켜고 끄는 로컬 플러그인.
// 보고 결과(이탈 여부 등)는 화면이 살아 있을 때만 "report" 이벤트로 넘겨서 근무 중 배너를
// 지금처럼 갱신한다. 서비스 자체는 화면(WebView)과 무관하게 돈다.
@CapacitorPlugin(name = "WorkLocation")
public class WorkLocationPlugin extends Plugin {
    @Override
    public void load() {
        WorkLocationService.reportListener = new WorkLocationService.ReportListener() {
            @Override
            public void onReport(JSONObject result) {
                JSObject event = new JSObject();
                event.put("ok", true);
                event.put("escaped", result.optBoolean("escaped", false));
                event.put("demandSiteName", result.optString("demandSiteName", null));
                notifyListeners("report", event);
            }

            @Override
            public void onFailure() {
                JSObject event = new JSObject();
                event.put("ok", false);
                notifyListeners("report", event);
            }
        };
    }

    @Override
    protected void handleOnDestroy() {
        WorkLocationService.reportListener = null;
        super.handleOnDestroy();
    }

    @PluginMethod
    public void start(PluginCall call) {
        // JS 숫자는 범위에 따라 Integer로 들어와서 getLong이면 null이 된다 — 참여자 id는 int 범위다
        Integer participantId = call.getInt("participantId");
        String apiBaseUrl = call.getString("apiBaseUrl");
        if (participantId == null || apiBaseUrl == null) {
            call.reject("participantId와 apiBaseUrl이 필요합니다.");
            return;
        }
        // 위치 권한 없이 위치 유형 포그라운드 서비스를 시작하면 OS가 예외를 던져 앱이 죽는다 —
        // 권한이 아직 없으면(첫 실행에 권한 팝업 응답 전 등) 거부해서 JS가 기존 방식으로 대신
        // 보고하게 한다(기존 위치 플러그인은 권한을 직접 요청한다). 다음에 앱을 열면 다시 시도된다.
        if (!hasLocationPermission()) {
            call.reject("위치 권한이 없습니다.");
            return;
        }
        try {
            WorkLocationService.start(getContext(), participantId, apiBaseUrl);
            call.resolve();
        } catch (Exception exception) {
            // 안드로이드 12+는 앱이 백그라운드일 때 포그라운드 서비스 시작을 막는다 — JS가
            // 이 reject를 보고 기존 방식(위치 플러그인 + JS 타이머)으로 대신 보고한다.
            call.reject("위치 서비스를 시작하지 못했습니다.", exception);
        }
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (WorkLocationService.isRunning()) {
            WorkLocationService.stop(getContext());
        }
        call.resolve();
    }
}
