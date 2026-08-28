package ai.dsh.agent;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(
    name = "Voice",
    permissions = {
        @Permission(alias = "mic", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class VoicePlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("mic") != PermissionState.GRANTED) {
            requestPermissionForAlias("mic", call, "onMicPermission");
            return;
        }
        beginListening(call);
    }

    @PermissionCallback
    private void onMicPermission(PluginCall call) {
        if (getPermissionState("mic") != PermissionState.GRANTED) {
            call.reject("麦克风权限未授予，请在系统设置中允许录音");
            return;
        }
        beginListening(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(this::destroyRecognizer);
        call.resolve();
    }

    private void beginListening(PluginCall call) {
        main.post(() -> {
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                call.reject("系统未提供语音识别服务");
                return;
            }
            destroyRecognizer();
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) {}
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {}

                @Override
                public void onError(int error) {
                    if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                        emit("end", null);
                        return;
                    }
                    JSObject payload = new JSObject();
                    payload.put("message", mapError(error));
                    notifyListeners("error", payload);
                    emit("end", null);
                }

                @Override
                public void onResults(Bundle results) {
                    emitTranscript(results, true);
                    emit("end", null);
                }

                @Override
                public void onPartialResults(Bundle partialResults) {
                    emitTranscript(partialResults, false);
                }

                @Override public void onEvent(int eventType, Bundle params) {}
            });

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.SIMPLIFIED_CHINESE.toString());
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            recognizer.startListening(intent);
            call.resolve();
        });
    }

    private void emitTranscript(Bundle bundle, boolean isFinal) {
        if (bundle == null) return;
        ArrayList<String> texts = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (texts == null || texts.isEmpty()) return;
        String text = texts.get(0);
        if (text == null || text.trim().isEmpty()) return;
        JSObject payload = new JSObject();
        payload.put("text", text);
        notifyListeners(isFinal ? "final" : "partial", payload);
    }

    private void emit(String event, JSObject payload) {
        notifyListeners(event, payload == null ? new JSObject() : payload);
    }

    private void destroyRecognizer() {
        if (recognizer != null) {
            try {
                recognizer.stopListening();
            } catch (Exception ignored) {
            }
            try {
                recognizer.cancel();
            } catch (Exception ignored) {
            }
            recognizer.destroy();
            recognizer = null;
        }
    }

    private static String mapError(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "麦克风权限未授予，请在系统设置中允许录音";
            case SpeechRecognizer.ERROR_AUDIO:
                return "无法使用麦克风";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "语音识别需要网络，请检查连接";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "语音识别正忙，请稍后再试";
            case SpeechRecognizer.ERROR_CLIENT:
                return "语音识别启动失败";
            case SpeechRecognizer.ERROR_SERVER:
                return "语音识别服务不可用";
            default:
                return "语音识别失败";
        }
    }

    @Override
    protected void handleOnDestroy() {
        main.post(this::destroyRecognizer);
        super.handleOnDestroy();
    }
}
