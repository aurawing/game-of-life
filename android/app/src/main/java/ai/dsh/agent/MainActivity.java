package ai.dsh.agent;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SsePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
