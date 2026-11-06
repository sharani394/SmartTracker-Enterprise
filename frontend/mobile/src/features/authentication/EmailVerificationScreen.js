import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiMessage, showMessage } from '../../utils/feedback';

export default function EmailVerificationScreen({ navigation, route }) {
  const email = route.params?.email || '';
  const destination = route.params?.destination || 'MemberLogin';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [message, setMessage] = useState('Enter the six-digit code sent to your company email.');
  const { confirmEmail, resendVerification } = useAuth();

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      showMessage('Invalid code', 'Enter the six-digit verification code from your email.');
      return;
    }
    setLoading(true);
    try {
      const result = await confirmEmail(email, code.trim());
      setVerifiedUser(result.user);
      setMessage(result.user?.status === 'PENDING_APPROVAL'
        ? 'Your email is verified. Your organisation administrator must approve your account before you can sign in.'
        : 'Your email is verified. You can now sign in.');
    } catch (error) {
      showMessage('Verification failed', apiMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setLoading(true);
    try {
      const result = await resendVerification(email);
      setMessage(result.message || 'If this account requires verification, a new code will be sent.');
    } catch (error) {
      showMessage('Could not resend code', apiMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <View style={styles.card}>
          <Text style={styles.brand}>SmartTracker</Text>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>We sent a verification code to {email || 'your company email'}.</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            autoCapitalize="none"
            accessibilityLabel="Six-digit email verification code"
          />
          <Text style={styles.message}>{message}</Text>
          {verifiedUser ? (
            <TouchableOpacity style={styles.button} onPress={() => navigation.replace(destination, route.params?.destinationParams)}>
              <Text style={styles.buttonText}>Continue to sign in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={verify} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Email</Text>}
            </TouchableOpacity>
          )}
          {!verifiedUser && <TouchableOpacity style={styles.linkButton} onPress={resend} disabled={loading}><Text style={styles.link}>Resend verification code</Text></TouchableOpacity>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FC' }, content: { flexGrow: 1, padding: 22, justifyContent: 'center' },
  back: { color: '#3157D5', fontWeight: '700', marginBottom: 18 }, card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#EAEFF5' },
  brand: { color: '#3157D5', fontSize: 15, fontWeight: '800' }, title: { color: '#17233D', fontSize: 23, fontWeight: '800', marginTop: 20 },
  subtitle: { color: '#788499', fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 20 }, input: { borderWidth: 1, borderColor: '#DCE3EE', borderRadius: 10, padding: 13, fontSize: 18, letterSpacing: 6 },
  message: { color: '#64728A', fontSize: 12, lineHeight: 18, marginTop: 14 }, button: { backgroundColor: '#3157D5', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 18 }, disabled: { opacity: 0.65 }, buttonText: { color: '#fff', fontWeight: '700' },
  linkButton: { alignItems: 'center', padding: 15 }, link: { color: '#3157D5', fontWeight: '700', fontSize: 12 },
});
