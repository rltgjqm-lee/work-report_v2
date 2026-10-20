package com.workreport.senioractivity;

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
        Long participantId = call.getLong("participantId");
        String apiBaseUrl = call.getString("apiBaseUrl");
        if (participantId == null || apiBaseUrl == null) {
            call.reject("participantId와 apiBaseUrl이 필요합니다.");
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

    @PluginMethod
    public void stop(PluginCall call) {
        if (WorkLocationService.isRunning()) {
            WorkLocationService.stop(getContext());
        }
        call.resolve();
    }
}
