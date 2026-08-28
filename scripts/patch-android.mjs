import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
if (!existsSync(android)) {
  console.log('android/ missing — run npx cap add android first');
  process.exit(0);
}

const javaDir = join(android, 'app/src/main/java/ai/dsh/agent');
mkdirSync(javaDir, { recursive: true });
copyFileSync(join(root, 'scripts/SsePlugin.java'), join(javaDir, 'SsePlugin.java'));
copyFileSync(join(root, 'scripts/VoicePlugin.java'), join(javaDir, 'VoicePlugin.java'));

const activityPath = join(javaDir, 'MainActivity.java');
if (existsSync(activityPath)) {
  let activity = readFileSync(activityPath, 'utf8');
  if (!activity.includes('registerPlugin(SsePlugin.class)')) {
    activity = activity.replace(
      'public class MainActivity extends BridgeActivity {}',
      `import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SsePlugin.class);
        registerPlugin(VoicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}`,
    );
    if (!activity.includes('import android.os.Bundle')) {
      activity = activity.replace(
        'import com.getcapacitor.BridgeActivity;',
        'import android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;',
      );
    }
  }
  if (!activity.includes('registerPlugin(VoicePlugin.class)')) {
    activity = activity.replace(
      'registerPlugin(SsePlugin.class);',
      'registerPlugin(SsePlugin.class);\n        registerPlugin(VoicePlugin.class);',
    );
  }
  writeFileSync(activityPath, activity);
}

const manifestPath = join(android, 'app/src/main/AndroidManifest.xml');
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, 'utf8');
  const perms = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.CAMERA',
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_EXTERNAL_STORAGE',
  ];
  for (const perm of perms) {
    if (!manifest.includes(`android:name="${perm}"`)) {
      const tag = `<uses-permission android:name="${perm}" />`;
      manifest = manifest.replace('<application', `${tag}\n    <application`);
    }
  }
  if (!manifest.includes('android:usesCleartextTraffic')) {
    manifest = manifest.replace('<application', '<application android:usesCleartextTraffic="true" ');
  }
  if (!manifest.includes('android.speech.RecognitionService')) {
    const queries = `    <queries>
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
    </queries>
`;
    if (manifest.includes('</manifest>')) {
      manifest = manifest.replace('</manifest>', `${queries}</manifest>`);
    }
  }
  writeFileSync(manifestPath, manifest);
}

const stringsPath = join(android, 'app/src/main/res/values/strings.xml');
if (existsSync(stringsPath)) {
  let xml = readFileSync(stringsPath, 'utf8');
  xml = xml.replace(/>dsh-agent</, '>DSH Agent<').replace(/>DSH Agent</, '>DSH Agent<');
  writeFileSync(stringsPath, xml);
}

console.log('patched android native SSE/Voice plugins and permissions');
