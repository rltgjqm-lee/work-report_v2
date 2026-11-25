package com.workreport.admin;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.WindowManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // 앱이 화면에 떠 있는지 — 떠 있으면 SOS 알림을 직접 띄우지 않고 JS 배너에 맡긴다(SosMessagingService)
    static volatile boolean isInForeground = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 이 앱 모듈 안에 직접 만든 로컬 플러그인이라 cap sync로 자동 등록되지 않는다 — 여기서 등록한다
        registerPlugin(SosAlarmPlugin.class);
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

    // 앱을 처음 켤 때(BridgeActivity.load)와 이미 켜져 있을 때 둘 다 여기로 온다
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (!intent.hasExtra(SosAlarm.EXTRA_NOTIFICATION_ID)) return;
        // 풀스크린으로 열렸으면 잠금 화면 위로 화면을 켜서 띄운다. 앱 자체 잠금(지문/PIN)은 그대로 거친다.
        // 알림은 지우지 않아서 소리는 앱 위쪽 "소리 끄기"를 누를 때까지 계속 울린다.
        if (intent.getBooleanExtra(SosAlarm.EXTRA_FULL_SCREEN, false)) {
            setShowOverLockScreen(true);
            return;
        }
        // 관리자가 알림을 직접 눌러 들어왔다 — 확인했으니 알림을 지우고 소리도 멈춘다
        SosAlarm.cancel(this, intent.getIntExtra(SosAlarm.EXTRA_NOTIFICATION_ID, 0));
    }

    @Override
    public void onResume() {
        super.onResume();
        isInForeground = true;
    }

    @Override
    public void onPause() {
        super.onPause();
        isInForeground = false;
    }

    // 한 번 잠금 화면 위로 띄운 뒤 앱을 벗어나면 원래대로 — 다음부터는 폰 잠금을 먼저 풀어야 보인다
    @Override
    public void onStop() {
        super.onStop();
        setShowOverLockScreen(false);
    }

    private void setShowOverLockScreen(boolean show) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(show);
            setTurnScreenOn(show);
            return;
        }
        int flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON;
        if (show) getWindow().addFlags(flags);
        else getWindow().clearFlags(flags);
    }
}
