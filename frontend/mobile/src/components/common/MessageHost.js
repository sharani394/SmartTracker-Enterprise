import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const DISPLAY_MS = 5000;

export default function MessageHost() {
  const [message, setMessage] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const handleMessage = (event) => {
      const nextMessage = event.detail;
      setMessage(nextMessage);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), DISPLAY_MS);
    };

    window.addEventListener('smarttracker:message', handleMessage);
    return () => {
      window.removeEventListener('smarttracker:message', handleMessage);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (Platform.OS !== 'web' || !message) return null;

  const isError = message.tone === 'error';
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        onPress={() => setMessage(null)}
        style={[styles.toast, isError ? styles.errorToast : styles.successToast]}
      >
        <View style={[styles.indicator, isError ? styles.errorIndicator : styles.successIndicator]} />
        <View style={styles.copy}>
          <Text style={styles.title}>{message.title}</Text>
          <Text style={styles.body}>{message.message}</Text>
        </View>
        <Text style={styles.dismiss}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10000,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 520,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4EAF2',
    paddingVertical: 13,
    paddingHorizontal: 14,
    shadowColor: '#17233D',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  successToast: { borderLeftWidth: 4, borderLeftColor: '#16845B' },
  errorToast: { borderLeftWidth: 4, borderLeftColor: '#C0392B' },
  indicator: { width: 9, height: 9, borderRadius: 5, marginRight: 12 },
  successIndicator: { backgroundColor: '#16845B' },
  errorIndicator: { backgroundColor: '#C0392B' },
  copy: { flex: 1 },
  title: { color: '#17233D', fontSize: 13, fontWeight: '800' },
  body: { color: '#526078', fontSize: 12, lineHeight: 18, marginTop: 3 },
  dismiss: { color: '#8490A3', fontSize: 22, lineHeight: 24, marginLeft: 12, paddingHorizontal: 3 },
});
