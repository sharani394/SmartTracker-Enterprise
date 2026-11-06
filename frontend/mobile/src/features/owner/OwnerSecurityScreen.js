
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiMessage } from '../../utils/feedback';
import { authService } from '../../services/authService';

export default function OwnerSecurityScreen({ navigation }) {
  const { changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState('');

  const [savingPassword, setSavingPassword] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionError, setSessionError] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const loadSessions = async () => {
    setLoadingSessions(true); setSessionError('');
    try { const result = await authService.sessions(); setSessions(result.sessions || []); }
    catch (error) { setSessionError(apiMessage(error)); }
    finally { setLoadingSessions(false); }
  };
  useEffect(() => { loadSessions(); }, []);
  const savePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('Please complete all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setMessage('New password must contain at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setMessage('Choose a password different from your current password.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setMessage('Password updated successfully.');
    } catch (error) { setMessage(apiMessage(error)); }
    finally { setSavingPassword(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back to Owner Settings</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Password & Security</Text>
      <Text style={styles.subtitle}>
        Protect your SmartTracker owner account.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change Password</Text>
        <Text style={styles.description}>
          Choose a strong password with at least 8 characters.
        </Text>

        {[
          ['Current Password', currentPassword, setCurrentPassword],
          ['New Password', newPassword, setNewPassword],
          ['Confirm New Password', confirmPassword, setConfirmPassword],
        ].map(([label, value, setter]) => (
          <View style={styles.field} key={label}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={(text) => {
                setter(text);
                setMessage('');
              }}
              placeholder={label}
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPasswords}
              autoCapitalize="none"
            />
          </View>
        ))}

        <TouchableOpacity
          onPress={() => setShowPasswords(!showPasswords)}
        >
          <Text style={styles.link}>
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity disabled={savingPassword} style={styles.primaryButton} onPress={savePassword}>
          <Text style={styles.primaryButtonText}>Update Password</Text>
        </TouchableOpacity>

        {message !== '' && (
          <Text style={styles.message}>{message}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Protection</Text>
        <Text style={styles.description}>Two-factor authentication and login-alert preferences are not available in the connected backend yet.</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Two-Factor Authentication</Text>
            <Text style={styles.description}>
              Two-factor authentication is not available through the connected backend.
            </Text>
          </View>
          <Switch
            value={false}
            disabled
            trackColor={{ false: '#D5DCE8', true: '#3157D5' }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Login Alerts</Text>
            <Text style={styles.description}>
              Login alert preferences are not available through the connected backend.
            </Text>
          </View>
          <Switch
            value={false}
            disabled
            trackColor={{ false: '#D5DCE8', true: '#3157D5' }}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session Information</Text>
        {loadingSessions ? <Text style={styles.description}>Loading active sessions…</Text> : null}
        {sessionError ? <Text style={styles.message}>{sessionError}</Text> : null}
        {!loadingSessions && sessions.length === 0 && !sessionError ? <Text style={styles.description}>No active sessions were returned.</Text> : null}
        {sessions.map((session) => <View style={styles.sessionRow} key={session.id}>
          <Text style={styles.sessionIcon}>💻</Text><View style={styles.settingText}>
            <Text style={styles.settingTitle}>{session.current ? 'Current session' : 'Signed-in session'}</Text>
            <Text style={styles.description}>{session.userAgent || 'Device details unavailable'}</Text>
            <Text style={styles.description}>Signed in {new Date(session.createdAt).toLocaleString()} · Expires {new Date(session.expiresAt).toLocaleString()}</Text>
            <TouchableOpacity onPress={async () => { try { await authService.revokeSession(session.id); if (session.current) await logout(); else await loadSessions(); } catch (error) { setSessionError(apiMessage(error)); } }}><Text style={styles.link}>{session.current ? 'Sign out this session' : 'Revoke session'}</Text></TouchableOpacity>
          </View>
        </View>)}
      </View>

      <Text style={styles.footer}>SmartTracker · Account Security</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FC' },
  content: { padding: 20, paddingBottom: 40 },
  back: { color: '#3157D5', fontWeight: '700', marginBottom: 22 },
  title: { fontSize: 24, fontWeight: '800', color: '#17233D' },
  subtitle: { color: '#7B8799', fontSize: 13, marginTop: 7, marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 15, padding: 19,
    marginBottom: 16, borderWidth: 1, borderColor: '#EAEFF5',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#17233D' },
  description: { color: '#8490A3', fontSize: 11, lineHeight: 17, marginTop: 5 },
  field: { marginTop: 17 },
  label: { fontSize: 12, fontWeight: '700', color: '#34415A', marginBottom: 8 },
  input: {
    height: 48, borderWidth: 1, borderColor: '#DDE4EF',
    borderRadius: 10, paddingHorizontal: 13, color: '#27344D',
    backgroundColor: '#FFFFFF',
  },
  link: { color: '#3157D5', fontWeight: '700', fontSize: 12, marginTop: 13 },
  primaryButton: {
    backgroundColor: '#3157D5', borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 20,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  message: {
    color: '#3157D5', backgroundColor: '#EAF0FF',
    padding: 11, borderRadius: 8, marginTop: 13, fontSize: 12,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: '#EEF1F6', marginTop: 12,
  },
  settingText: { flex: 1, paddingRight: 12 },
  settingTitle: { color: '#27344D', fontSize: 13, fontWeight: '700' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 17 },
  sessionIcon: { fontSize: 25, marginRight: 13 },
  currentSession: { color: '#16845B', fontSize: 10, fontWeight: '700', marginTop: 5 },
  footer: { textAlign: 'center', color: '#A1AABA', fontSize: 10, marginTop: 15 },
});
