package com.workreport.admin;

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
        super.onCreate(savedInstanceState);

        // Android 15부터는 화면이 시스템 바 밑까지 강제로 넓어져서 키보드가 올라와도 웹 화면이
        // 줄어들지 않는다. Capacitor(adjustMarginsForEdgeToEdge)는 시스템 바 높이만 여백으로 빼고
        // 키보드 높이는 빼지 않아 아래쪽 입력칸이 키보드에 가려진다 — 그 여백 계산을 덮어써서
        // 아래 여백에 키보드 높이도 반영한다. Android 14 이하는 시스템이 알아서 줄여준다.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return;
        ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets keyboard = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
            params.setMargins(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            view.setLayoutParams(params);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
