package com.workreport.senioractivity;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 이 앱 모듈 안에 직접 만든 로컬 플러그인(별도 npm 패키지가 아님)이라 cap sync로
        // 자동 등록되지 않는다 — 여기서 직접 등록해야 한다.
        registerPlugin(LocationServicesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
