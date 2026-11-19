package com.workreport.senioractivity;

import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 이 앱 모듈 안에 직접 만든 로컬 플러그인(별도 npm 패키지가 아님)이라 cap sync로
        // 자동 등록되지 않는다 — 여기서 직접 등록해야 한다.
        registerPlugin(LocationServicesPlugin.class);
        registerPlugin(WorkLocationPlugin.class);
        super.onCreate(savedInstanceState);

        // Android 15부터는 화면이 시스템 바 밑까지 강제로 넓어져서 키보드가 올라와도 웹 화면이
        // 줄어들지 않아 아래쪽 입력칸이 키보드에 가려진다 — 키보드가 떠 있는 동안만 그 높이만큼
        // 아래 여백을 준다. 위·옆 여백은 지금처럼 두고, 웹 화면이 받던 inset은 그대로 넘긴다.
        // Android 14 이하는 시스템이 알아서 줄여준다.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return;
        ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (view, windowInsets) -> {
            Insets keyboard = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
            if (params.bottomMargin != keyboard.bottom) {
                params.bottomMargin = keyboard.bottom;
                view.setLayoutParams(params);
            }
            return ViewCompat.onApplyWindowInsets(view, windowInsets);
        });
    }
}
