import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiMessage, showMessage } from '../../utils/feedback';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PasswordResetScreen({ navigation, route }) {
  const [email, setEmail] = useState(route.params?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const { requestPasswordReset, confirmPasswordReset } = useAuth();
  const destination = route.params?.destination || 'MemberLogin';

  const requestCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      showMessage('Check your email', 'Enter a valid company email address.');
      return;
    }

    setLoading(true);
    try {
      const result = await requestPasswordReset(cleanEmail);
      setEmail(cleanEmail);
      setCodeRequested(true);
      showMessage('Check your inbox', result.message);
    } catch (error) {
      showMessage('Could not request reset code', apiMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      showMessage('Check your code', 'Enter the six-digit password reset code from your email.');
      return;
    }
    if (password.length < 8) {
      showMessage('Password is too short', 'Use at least eight characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      showMessage('Passwords do not match', 'Re-enter the same password in both fields.');
      return;
    }

    setLoading(true);
    try {
      const result = await confirmPasswordReset(email, code.trim(), password);
      showMessage('Password updated', result.message || 'Sign in with your new password.');
      navigation.replace(destination, route.params?.destinationParams);
    } catch (error) {
      showMessage('Could not reset password', apiMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.back}>‹ Back to sign in</Text>
        </TouchableOpacity>
        <View style={styles.card}>
          <View style={styles.logo}><Text style={styles.logoText}>ST</Text></View>
          <Text style={styles.brand}>SmartTracker</Text>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>
            {codeRequested
              ? `Enter the code sent to ${email} and choose a new password.`
              : 'We will email a one-time code to your company email address.'}
          </Text>

          <Text style={styles.label}>Company email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!codeRequested}
            returnKeyType={codeRequested ? 'next' : 'send'}
            onSubmitEditing={codeRequested ? undefined : requestCode}
          />

          {codeRequested && (
            <>
              <Text style={styles.label}>Six-digit code</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                returnKeyType="next"
              />
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                autoComplete="new-password"
                maxLength={128}
                returnKeyType="next"
              />
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                secureTextEntry
                autoComplete="new-password"
                maxLength={128}
                returnKeyType="done"
                onSubmitEditing={resetPassword}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={codeRequested ? resetPassword : requestCode}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.buttonText}>{codeRequested ? 'Update password' : 'Send reset code'}</Text>}
          </TouchableOpacity>

          {codeRequested && (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={requestCode}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={styles.link}>Send a new code</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.privacyNote}>
            For your security, we show the same confirmation whether or not an active account uses that email.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FC' },
  content: { flexGrow: 1, padding: 22, justifyContent: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' },
  back: { color: '#3157D5', fontWeight: '700', marginBottom: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 26, borderWidth: 1, borderColor: '#E8EDF5' },
  logo: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#3157D5', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  brand: { color: '#3157D5', fontWeight: '800', marginTop: 12 },
  title: { color: '#17233D', fontSize: 25, fontWeight: '800', marginTop: 22 },
  subtitle: { color: '#6B778C', fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 20 },
  label: { color: '#344054', fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 7 },
  input: { borderWidth: 1, borderColor: '#DCE3EE', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: '#17233D', backgroundColor: '#FFFFFF' },
  button: { minHeight: 50, backgroundColor: '#3157D5', borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 13, marginTop: 22 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  linkButton: { alignItems: 'center', padding: 14 },
  link: { color: '#3157D5', fontWeight: '700', fontSize: 13 },
  privacyNote: { color: '#7B8799', fontSize: 11, lineHeight: 16, marginTop: 9, textAlign: 'center' },
});
