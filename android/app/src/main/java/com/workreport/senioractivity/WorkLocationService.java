package com.workreport.senioractivity;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// 💡 근무 중(출근~퇴근) 위치를 10분마다 새로 측위해 서버(/public/location)로 직접 보내는
// 포그라운드 서비스. 예전에는 위치 플러그인(25m 이동 시에만 좌표 전달) + WebView의 JS
// 10분 타이머로 보냈는데, 화면이 꺼지고 제자리에 있으면 CPU가 잠들어 JS 타이머가 멈추고
// 이동 콜백도 안 와서 보고가 수십 분~수 시간씩 끊겼다(허위 통신 끊김, 자동퇴근 "위치
// 확인 불가"). 여기서는 OS 위치 시스템에 "10분마다 측위"를 요청해 OS가 서비스를 직접
// 깨우게 하고, 전송도 WebView를 거치지 않는다.
//
// 새 권한(백그라운드 위치·정확한 알람·배터리 최적화 예외)은 쓰지 않는다 — 포그라운드
// 서비스 + 앱 사용 중 위치 권한만으로 동작해서 플레이스토어 추가 심사를 피한다.
public class WorkLocationService extends Service {
    static final String ACTION_START = "com.workreport.senioractivity.WORK_LOCATION_START";
    static final String ACTION_STOP = "com.workreport.senioractivity.WORK_LOCATION_STOP";
    static final String EXTRA_PARTICIPANT_ID = "participantId";
    static final String EXTRA_API_BASE_URL = "apiBaseUrl";

    // 서버의 통신 끊김 판정(checkSignalLoss.ts, 25분)과 JS 쪽 보고 주기(locationReporting.ts)와
    // 같은 10분 — 셋 중 하나를 바꾸면 같이 맞춰야 한다.
    private static final long REPORT_INTERVAL_MS = 10 * 60 * 1000L;
    // 근무시간 외 위치 수집을 막는 마지막 안전장치. 퇴근 버튼·자동퇴근 응답(working:false)으로
    // 못 멈춘 경우에도 출근 후 이 시간이 지나면 스스로 멈춘다.
    private static final long MAX_TRACKING_MS = 14 * 60 * 60 * 1000L;
    private static final int HTTP_TIMEOUT_MS = 15_000;
    // 위치 콜백이 CPU를 깨운 뒤 전송이 끝나기 전에 다시 잠들지 않게 잡는 시간
    private static final long SEND_WAKE_LOCK_MS = 30_000L;

    private static final int NOTIFICATION_ID = 7301;
    private static final String CHANNEL_ID = "work_location";
    private static final String PREFS = "work_location";
    private static final String PREF_PARTICIPANT_ID = "participantId";
    private static final String PREF_API_BASE_URL = "apiBaseUrl";
    private static final String PREF_STARTED_AT = "startedAt";

    // 보고 결과를 화면(JS)에 넘기는 통로 — 화면이 살아 있을 때만 WorkLocationPlugin이 채운다.
    interface ReportListener {
        void onReport(JSONObject result);
        void onFailure();
    }

    static volatile ReportListener reportListener;
    private static volatile boolean running = false;

    private FusedLocationProviderClient locationClient;
    private LocationCallback locationCallback;
    private final ExecutorService sendExecutor = Executors.newSingleThreadExecutor();

    static boolean isRunning() {
        return running;
    }

    static void start(Context context, long participantId, String apiBaseUrl) {
        Intent intent = new Intent(context, WorkLocationService.class)
                .setAction(ACTION_START)
                .putExtra(EXTRA_PARTICIPANT_ID, participantId)
                .putExtra(EXTRA_API_BASE_URL, apiBaseUrl);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    static void stop(Context context) {
        context.startService(new Intent(context, WorkLocationService.class).setAction(ACTION_STOP));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action) || intent == null) {
            stopTracking();
            return START_NOT_STICKY;
        }

        long participantId = intent.getLongExtra(EXTRA_PARTICIPANT_ID, 0);
        String apiBaseUrl = intent.getStringExtra(EXTRA_API_BASE_URL);
        if (participantId <= 0 || apiBaseUrl == null) {
            stopTracking();
            return START_NOT_STICKY;
        }

        // startForegroundService로 시작했으면 몇 초 안에 반드시 startForeground를 불러야 한다
        ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                buildNotification(),
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                        : 0
        );

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        boolean sameParticipant = running && prefs.getLong(PREF_PARTICIPANT_ID, 0) == participantId;
        // 앱을 다시 열거나 OTA로 화면이 다시 뜨면 JS가 start를 또 부른다 — 같은 참여자로
        // 이미 돌고 있으면 측위 요청과 출근 시각(안전장치 기준)을 그대로 둔다.
        if (sameParticipant) return START_NOT_STICKY;

        prefs.edit()
                .putLong(PREF_PARTICIPANT_ID, participantId)
                .putString(PREF_API_BASE_URL, apiBaseUrl)
                .putLong(PREF_STARTED_AT, System.currentTimeMillis())
                .apply();

        try {
            requestLocationUpdates();
            sendCurrentLocationNow();
            running = true;
        } catch (SecurityException exception) {
            // 위치 권한이 없으면 측위 자체를 못 한다 — 화면엔 전송 실패로 알리고 멈춘다
            notifyFailure();
            stopTracking();
        }
        return START_NOT_STICKY;
    }

    private void requestLocationUpdates() {
        if (locationClient == null) {
            locationClient = LocationServices.getFusedLocationProviderClient(this);
        }
        if (locationCallback != null) {
            locationClient.removeLocationUpdates(locationCallback);
        }

        // 이동 거리 조건 없이 10분마다 새 좌표를 받는다. 더 자주 들어오는 좌표(다른 앱이
        // 측위해서 공유되는 것)도 받지 않게 최소 간격도 10분으로 둔다 — 서버 보고는 이 주기
        // 그대로라 호출량이 10분에 1번을 넘지 않는다. 배치(모아서 늦게 전달)도 하지 않는다.
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, REPORT_INTERVAL_MS)
                .setMinUpdateIntervalMillis(REPORT_INTERVAL_MS)
                .setMaxUpdateDelayMillis(0)
                .setWaitForAccurateLocation(false)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(@NonNull LocationResult result) {
                Location location = result.getLastLocation();
                if (location != null) sendReport(location);
            }
        };
        locationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
    }

    // 10분 주기 요청의 첫 좌표가 언제 올지 OS가 보장하지 않아서, 시작 직후 한 번은 따로
    // 측위해 바로 보낸다 — 출근 직후 관제 공백을 만들지 않는다.
    private void sendCurrentLocationNow() {
        locationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener(location -> {
                    if (location != null && running) sendReport(location);
                });
    }

    private void sendReport(Location location) {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        long participantId = prefs.getLong(PREF_PARTICIPANT_ID, 0);
        String apiBaseUrl = prefs.getString(PREF_API_BASE_URL, null);
        long startedAt = prefs.getLong(PREF_STARTED_AT, 0);
        if (participantId <= 0 || apiBaseUrl == null) {
            stopTracking();
            return;
        }
        if (System.currentTimeMillis() - startedAt > MAX_TRACKING_MS) {
            stopTracking();
            return;
        }

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "WorkReport:WorkLocationSend"
        );
        wakeLock.acquire(SEND_WAKE_LOCK_MS);

        sendExecutor.execute(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("participantId", participantId);
                body.put("lat", location.getLatitude());
                body.put("lng", location.getLongitude());
                if (location.hasAccuracy()) body.put("accuracy", location.getAccuracy());
                if (location.hasAltitude()) body.put("altitude", location.getAltitude());
                body.put("locatedAtMs", location.getTime());
                body.put("simulated", isMock(location));

                JSONObject result = postJson(apiBaseUrl + "/public/location", body);
                if (result == null) {
                    notifyFailure();
                    return;
                }
                // 화면이 꺼진 사이 자동퇴근(또는 관리자 처리)으로 근무가 끝났으면 스스로 멈춘다
                if (result.has("working") && !result.optBoolean("working", true)) {
                    stopTracking();
                    return;
                }
                ReportListener listener = reportListener;
                if (listener != null) listener.onReport(result);
            } catch (Exception exception) {
                notifyFailure();
            } finally {
                if (wakeLock.isHeld()) wakeLock.release();
            }
        });
    }

    // 2xx면 응답 JSON, 그 외(네트워크 오류·서버 오류)는 null. 실패한 좌표를 쌓아뒀다가 나중에
    // 보내지 않는다 — 서버가 받은 시각 기준으로 판정해서, 밀린 좌표는 판정을 오히려 헷갈리게 한다.
    // 다음 주기의 새 좌표가 곧 들어온다.
    private JSONObject postJson(String url, JSONObject body) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(HTTP_TIMEOUT_MS);
            connection.setReadTimeout(HTTP_TIMEOUT_MS);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }

            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) return null;

            try (InputStream input = connection.getInputStream()) {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[4096];
                int read;
                while ((read = input.read(chunk)) != -1) buffer.write(chunk, 0, read);
                return new JSONObject(buffer.toString(StandardCharsets.UTF_8.name()));
            }
        } catch (Exception exception) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static boolean isMock(Location location) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return location.isMock();
        return location.isFromMockProvider();
    }

    private void notifyFailure() {
        ReportListener listener = reportListener;
        if (listener != null) listener.onFailure();
    }

    private void stopTracking() {
        running = false;
        if (locationClient != null && locationCallback != null) {
            locationClient.removeLocationUpdates(locationCallback);
        }
        locationCallback = null;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().clear().apply();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        running = false;
        if (locationClient != null && locationCallback != null) {
            locationClient.removeLocationUpdates(locationCallback);
        }
        sendExecutor.shutdown();
        super.onDestroy();
    }

    private Notification buildNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "근무 중 위치 확인",
                    NotificationManager.IMPORTANCE_LOW
            );
            manager.createNotificationChannel(channel);
        }

        // 알림을 누르면 앱 화면으로 돌아온다
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = launchIntent == null
                ? null
                : PendingIntent.getActivity(this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE);

        // 문구는 기존 위치 플러그인(backgroundLocation.ts)과 같게 둬서 참여자에게 보이는 게 바뀌지 않게 한다
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("안전을 위해 위치를 확인하고 있어요")
                .setContentText("퇴근을 등록하면 종료됩니다.")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .setContentIntent(contentIntent)
                .build();
    }
}
