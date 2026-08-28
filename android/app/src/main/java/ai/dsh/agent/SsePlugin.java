package ai.dsh.agent;

import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "Sse")
public class SsePlugin extends Plugin {
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String, HttpURLConnection> connections = new ConcurrentHashMap<>();

    @PluginMethod
    public void start(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url required");
            return;
        }
        String id = UUID.randomUUID().toString();
        String method = call.getString("method", "POST");
        String body = call.getString("body", "");
        JSObject headers = call.getObject("headers", new JSObject());
        JSObject ret = new JSObject();
        ret.put("id", id);
        call.resolve(ret);

        executor.execute(() -> stream(id, url, method, headers, body));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        String id = call.getString("id");
        HttpURLConnection conn = id == null ? null : connections.remove(id);
        if (conn != null) {
            conn.disconnect();
        }
        call.resolve();
    }

    private void stream(String id, String url, String method, JSObject headers, String body) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            connections.put(id, conn);
            conn.setRequestMethod(method);
            conn.setDoInput(true);
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(0);
            conn.setRequestProperty("Accept", "text/event-stream");
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                conn.setRequestProperty(key, headers.getString(key));
            }
            if ("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)) {
                conn.setDoOutput(true);
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                conn.setRequestProperty("Content-Type", "application/json");
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                }
            }
            int code = conn.getResponseCode();
            InputStream stream = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (stream == null) {
                emit(id, "error", "HTTP " + code);
                emitDone(id);
                return;
            }
            BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
            String line;
            StringBuilder block = new StringBuilder();
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty()) {
                    flushBlock(id, block.toString());
                    block.setLength(0);
                } else {
                    block.append(line).append('\n');
                }
            }
            if (block.length() > 0) {
                flushBlock(id, block.toString());
            }
            emitDone(id);
        } catch (Exception e) {
            emit(id, "error", e.getMessage() == null ? "sse failure" : e.getMessage());
            emitDone(id);
        } finally {
            connections.remove(id);
            if (conn != null) conn.disconnect();
        }
    }

    private void flushBlock(String id, String block) {
        String[] lines = block.split("\n");
        StringBuilder data = new StringBuilder();
        for (String line : lines) {
            if (line.startsWith("data:")) {
                if (data.length() > 0) data.append('\n');
                data.append(line.substring(5).trim());
            }
        }
        if (data.length() == 0) return;
        JSObject payload = new JSObject();
        payload.put("id", id);
        payload.put("data", data.toString());
        main.post(() -> notifyListeners("chunk", payload));
    }

    private void emit(String id, String event, String message) {
        JSObject payload = new JSObject();
        payload.put("id", id);
        payload.put("message", message);
        main.post(() -> notifyListeners(event, payload));
    }

    private void emitDone(String id) {
        JSObject payload = new JSObject();
        payload.put("id", id);
        main.post(() -> notifyListeners("done", payload));
    }
}
