import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
if (!existsSync(android)) {
  console.log('android/ missing — run npx cap add android first');
  process.exit(0);
}

const pluginSrc = join(root, 'scripts/SsePlugin.java');
const pluginDest = join(android, 'app/src/main/java/ai/dsh/agent/SsePlugin.java');
mkdirSync(dirname(pluginDest), { recursive: true });
copyFileSync(pluginSrc, pluginDest);

const activityPath = join(android, 'app/src/main/java/ai/dsh/agent/MainActivity.java');
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
    writeFileSync(activityPath, activity);
  }
}

const manifestPath = join(android, 'app/src/main/AndroidManifest.xml');
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, 'utf8');
  const perms = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.RECORD_AUDIO',
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
  writeFileSync(manifestPath, manifest);
}

const stringsPath = join(android, 'app/src/main/res/values/strings.xml');
if (existsSync(stringsPath)) {
  let xml = readFileSync(stringsPath, 'utf8');
  xml = xml.replace(/>dsh-agent</, '>DSH Agent<').replace(/>DSH Agent</, '>DSH Agent<');
  writeFileSync(stringsPath, xml);
}

console.log('patched android native SSE plugin and permissions');
