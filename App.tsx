/**
 * Local Insights demo — plays a sample stream through withGumletInsights.
 *
 * Set WORKSPACE_ID below to a real Gumlet video-source Mongo _id before testing ingest.
 *
 * @format
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Video from 'react-native-video';
import { fullCustomAnalyticsConfig } from '@gumlet/insights-js-core';
import withGumletInsights from '@gumlet/insights-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Replace with your Gumlet workspace / video-source id (required by core 3.x). */
const WORKSPACE_ID = '<WORKSPACE_ID>';

/** Gumlet HLS — use on real devices; many Android emulators fail HLS AVC decode. */
const DEMO_SOURCE_HLS = {
  uri: '<HLS_URI>',
};

/** Progressive MP4 fallback for Android emulators (ExoPlayer MediaCodec issue). */
const DEMO_SOURCE_MP4 = {
  uri: '<MP4_URI>',
};

const TrackedVideo = withGumletInsights(Video);

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [paused, setPaused] = useState(true);
  const [source, setSource] = useState(DEMO_SOURCE_HLS);
  const [sourceNote, setSourceNote] = useState('HLS');

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    void DeviceInfo.isEmulator().then(isEmulator => {
      if (!isEmulator) return;
      setSource(DEMO_SOURCE_MP4);
      setSourceNote('MP4 (emulator fallback — HLS often hits ERROR_CODE_DECODING_FAILED)');
    });
  }, []);

  const insightsConfig = useMemo(
    () => ({
      ...fullCustomAnalyticsConfig,
      workspace_id: WORKSPACE_ID,
      debug: true,
      screen_name: 'GumletInsightsRNDemo',
      screen_type: 'demo',
    }),
    [],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <Text style={styles.title}>Gumlet Insights RN Demo</Text>
        <Text style={styles.subtitle}>
          Local `@gumlet/insights-react-native` + `@gumlet/insights-js-core`
        </Text>
        <Text style={styles.hint}>
          workspace_id: {WORKSPACE_ID}
          {'\n'}
          source: {sourceNote}
          {'\n'}
          Set WORKSPACE_ID in App.tsx, then play and watch Metro / network for
          /license + beacons. Beacons include fullCustomAnalyticsConfig
          (customData1–10, user, video, player metadata).
        </Text>

        <View style={styles.playerWrap}>
          <TrackedVideo
            config={insightsConfig}
            source={source}
            paused={paused}
            muted={false}
            resizeMode="contain"
            style={styles.player}
            onError={error => {
              const err = error as { errorString?: string };
              console.warn('[demo] video error', error);
              if (
                Platform.OS === 'android' &&
                String(err.errorString ?? '').includes('DECODING_FAILED')
              ) {
                console.warn(
                  '[demo] Android emulator MediaCodec failed — use a physical device or API 34+ emulator for HLS.',
                );
              }
            }}
          />
        </View>

        <View style={styles.row}>
          <Button
            title={paused ? 'Play' : 'Pause'}
            onPress={() => setPaused(value => !value)}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
  },
  hint: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
  playerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  player: {
    width: '100%',
    height: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});

export default App;
